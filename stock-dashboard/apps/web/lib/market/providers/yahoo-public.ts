import { fetchJson } from "@/lib/http";
import { readCache, writeCache } from "@/lib/market/cache";
import { normalizeRequest, quoteKey } from "@/lib/market/requests";
import type {
  ChartPoint,
  MarketQuote,
  QuoteBundle,
  QuoteProvider,
  QuoteRequest,
} from "@/lib/market/types";
import { resolveUniverseEntry } from "@/lib/market/universe";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketVolume?: number;
        longName?: string;
        shortName?: string;
        regularMarketTime?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: {
      description?: string;
    } | null;
  };
};

const QUOTE_TTL_MS = 2_500;
const CHART_TTL_MS = 45_000;

function getYahooSymbol(request: QuoteRequest) {
  return resolveUniverseEntry(request)?.yahooSymbol ?? request.symbol;
}

function getChartRange(days: number) {
  if (days <= 5) {
    return "5d";
  }
  if (days <= 30) {
    return "1mo";
  }
  if (days <= 90) {
    return "3mo";
  }
  if (days <= 180) {
    return "6mo";
  }
  return "1y";
}

function buildChartUrl(request: QuoteRequest, days: number) {
  const yahooSymbol = getYahooSymbol(request);
  const range = getChartRange(days);
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=${range}`;
}

function coerceNumber(value: number | null | undefined, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildEmptyQuote(request: QuoteRequest): MarketQuote {
  const normalized = normalizeRequest(request);
  return {
    key: quoteKey(normalized),
    market: normalized.market,
    symbol: normalized.symbol,
    name: normalized.name ?? normalized.symbol,
    currency: normalized.market === "KR" ? "KRW" : "USD",
    price: 0,
    previousClose: 0,
    changeValue: 0,
    changePercent: 0,
    volume: 0,
    open: 0,
    high: 0,
    low: 0,
    updatedAt: new Date().toISOString(),
    source: "yahoo-public",
    mode: "low-latency",
    isStale: true,
  };
}

function extractQuote(request: QuoteRequest, payload: YahooChartResponse): MarketQuote {
  const normalized = normalizeRequest(request);
  const result = payload.chart?.result?.[0];
  if (!result) {
    return buildEmptyQuote(normalized);
  }

  const meta = result.meta ?? {};
  const series = result.indicators?.quote?.[0];
  const close = (series?.close ?? []).filter((value): value is number => typeof value === "number");
  const open = (series?.open ?? []).filter((value): value is number => typeof value === "number");
  const high = (series?.high ?? []).filter((value): value is number => typeof value === "number");
  const low = (series?.low ?? []).filter((value): value is number => typeof value === "number");
  const volume = (series?.volume ?? []).filter((value): value is number => typeof value === "number");
  const price = coerceNumber(meta.regularMarketPrice, close.at(-1) ?? 0);
  const previousClose = coerceNumber(meta.chartPreviousClose, close.length > 1 ? close.at(-2) ?? price : price);
  const changeValue = price - previousClose;
  const changePercent = previousClose ? (changeValue / previousClose) * 100 : 0;

  return {
    key: quoteKey(normalized),
    market: normalized.market,
    symbol: normalized.symbol,
    name: normalized.name ?? meta.longName ?? meta.shortName ?? normalized.symbol,
    currency: meta.currency === "KRW" ? "KRW" : "USD",
    price,
    previousClose,
    changeValue,
    changePercent,
    volume: coerceNumber(meta.regularMarketVolume, volume.at(-1) ?? 0),
    open: coerceNumber(open.at(-1), price),
    high: coerceNumber(meta.regularMarketDayHigh, high.at(-1) ?? price),
    low: coerceNumber(meta.regularMarketDayLow, low.at(-1) ?? price),
    updatedAt: new Date(coerceNumber(meta.regularMarketTime, Date.now() / 1_000) * 1_000).toISOString(),
    source: "yahoo-public",
    mode: "low-latency",
    isStale: price <= 0,
  };
}

function extractChart(payload: YahooChartResponse) {
  const result = payload.chart?.result?.[0];
  const series = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp ?? [];
  if (!series || !timestamps.length) {
    return [];
  }

  return timestamps
    .map((timestamp, index) => {
      const open = series.open?.[index];
      const high = series.high?.[index];
      const low = series.low?.[index];
      const close = series.close?.[index];
      const volume = series.volume?.[index];
      if ([open, high, low, close].some((value) => typeof value !== "number")) {
        return null;
      }

      return {
        time: new Date(timestamp * 1_000).toISOString().slice(0, 10),
        open: coerceNumber(open),
        high: coerceNumber(high),
        low: coerceNumber(low),
        close: coerceNumber(close),
        volume: coerceNumber(volume),
      } satisfies ChartPoint;
    })
    .filter((point): point is ChartPoint => Boolean(point));
}

async function fetchYahooChart(request: QuoteRequest, days: number) {
  const normalized = normalizeRequest(request);
  const cacheKey = `chart:${quoteKey(normalized)}:${getChartRange(days)}`;
  const cached = readCache<YahooChartResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  const payload = await fetchJson<YahooChartResponse>(buildChartUrl(normalized, days), {
    timeoutMs: 5_000,
    headers: {
      "User-Agent": "stock-dashboard/2026",
    },
  });
  writeCache(cacheKey, payload, days <= 7 ? QUOTE_TTL_MS : CHART_TTL_MS);
  return payload;
}

export class YahooPublicQuoteProvider implements QuoteProvider {
  readonly info = {
    id: "yahoo-public",
    name: "Yahoo public market adapter",
    mode: "low-latency" as const,
    latencyLabel: "public market data",
    notes: "Direct KR/US chart endpoint adapter with short in-memory caching. Good for dashboarding, not exchange-grade.",
    capabilities: {
      streaming: true,
      charts: true,
      us: true,
      kr: true,
    },
  };

  async getQuotes(requests: QuoteRequest[]): Promise<QuoteBundle> {
    const normalized = requests.map(normalizeRequest);
    const quotes = await Promise.all(
      normalized.map(async (request) => {
        const cacheKey = `quote:${quoteKey(request)}`;
        const cached = readCache<MarketQuote>(cacheKey);
        if (cached) {
          return cached;
        }

        try {
          const payload = await fetchYahooChart(request, 5);
          const quote = extractQuote(request, payload);
          writeCache(cacheKey, quote, QUOTE_TTL_MS);
          return quote;
        } catch {
          return buildEmptyQuote(request);
        }
      }),
    );

    return {
      provider: this.info,
      quotes,
      updatedAt: new Date().toISOString(),
    };
  }

  async getChart(request: QuoteRequest, days: number): Promise<ChartPoint[]> {
    try {
      const payload = await fetchYahooChart(request, days);
      return extractChart(payload);
    } catch {
      return [];
    }
  }
}
