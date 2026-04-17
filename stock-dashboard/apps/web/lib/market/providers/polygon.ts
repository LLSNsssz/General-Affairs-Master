import { getServerEnv } from "@/lib/env";
import { fetchJson } from "@/lib/http";
import { normalizeRequest, quoteKey } from "@/lib/market/requests";
import type {
  MarketQuote,
  QuoteBundle,
  QuoteProvider,
  QuoteRequest,
} from "@/lib/market/types";

type PolygonSnapshotResponse = {
  ticker?: {
    ticker?: string;
    todaysChange?: number;
    todaysChangePerc?: number;
    updated?: number | string;
    day?: {
      o?: number;
      h?: number;
      l?: number;
      c?: number;
      v?: number;
    };
    min?: {
      o?: number;
      h?: number;
      l?: number;
      c?: number;
      v?: number;
    };
    prevDay?: {
      c?: number;
    };
  };
};

function coerceNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeTimestamp(value: number | string | undefined) {
  if (typeof value === "string" && value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  const numeric = coerceNumber(value, Date.now());
  if (numeric > 10_000_000_000_000) {
    return new Date(Math.floor(numeric / 1_000_000)).toISOString();
  }
  if (numeric > 10_000_000_000) {
    return new Date(numeric).toISOString();
  }
  return new Date(numeric * 1_000).toISOString();
}

function toPolygonQuote(request: QuoteRequest, payload: PolygonSnapshotResponse): MarketQuote {
  const normalized = normalizeRequest(request);
  const ticker = payload.ticker ?? {};
  const price = coerceNumber(ticker.day?.c ?? ticker.min?.c);
  const previousClose = coerceNumber(ticker.prevDay?.c, price);
  const changeValue = coerceNumber(ticker.todaysChange, price - previousClose);
  const changePercent = coerceNumber(
    ticker.todaysChangePerc,
    previousClose ? (changeValue / previousClose) * 100 : 0,
  );

  return {
    key: quoteKey(normalized),
    market: "US",
    symbol: normalized.symbol,
    name: normalized.name ?? normalized.symbol,
    currency: "USD",
    price,
    previousClose,
    changeValue,
    changePercent,
    volume: coerceNumber(ticker.day?.v ?? ticker.min?.v),
    open: coerceNumber(ticker.day?.o, previousClose),
    high: coerceNumber(ticker.day?.h, price),
    low: coerceNumber(ticker.day?.l, price),
    updatedAt: normalizeTimestamp(ticker.updated),
    source: "polygon",
    mode: "low-latency",
    isStale: price <= 0,
  };
}

export class PolygonQuoteProvider implements QuoteProvider {
  readonly info = {
    id: "polygon",
    name: "Polygon snapshot adapter",
    mode: "low-latency" as const,
    latencyLabel: "vendor snapshot",
    notes: "Paid vendor feed for US stocks. Current implementation uses snapshot polling, not direct websocket ticks.",
    capabilities: {
      streaming: false,
      charts: false,
      us: true,
      kr: false,
    },
  };

  constructor(private readonly fallbackProvider: QuoteProvider) {}

  async getQuotes(requests: QuoteRequest[]): Promise<QuoteBundle> {
    const env = getServerEnv();
    if (!env.polygonApiKey) {
      return this.fallbackProvider.getQuotes(requests);
    }

    const normalized = requests.map(normalizeRequest);
    const usRequests = normalized.filter((request) => request.market === "US");
    const fallbackRequests = normalized.filter((request) => request.market !== "US");
    const quoteMap = new Map<string, MarketQuote>();
    const failedUsRequests: QuoteRequest[] = [];

    await Promise.all(
      usRequests.map(async (request) => {
        try {
          const payload = await fetchJson<PolygonSnapshotResponse>(
            `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${request.symbol}?apiKey=${env.polygonApiKey}`,
            { timeoutMs: 4_000 },
          );
          quoteMap.set(quoteKey(request), toPolygonQuote(request, payload));
        } catch {
          failedUsRequests.push(request);
        }
      }),
    );

    const fallbackBundle =
      fallbackRequests.length || failedUsRequests.length
        ? await this.fallbackProvider.getQuotes([...fallbackRequests, ...failedUsRequests])
        : null;

    for (const quote of fallbackBundle?.quotes ?? []) {
      quoteMap.set(quote.key, quote);
    }

    return {
      provider: this.info,
      quotes: normalized.map((request) => {
        return (
          quoteMap.get(quoteKey(request)) ?? {
            key: quoteKey(request),
            market: request.market,
            symbol: request.symbol,
            name: request.name ?? request.symbol,
            currency: request.market === "KR" ? "KRW" : "USD",
            price: 0,
            previousClose: 0,
            changeValue: 0,
            changePercent: 0,
            volume: 0,
            open: 0,
            high: 0,
            low: 0,
            updatedAt: new Date().toISOString(),
            source: "polygon",
            mode: "low-latency",
            isStale: true,
          }
        );
      }),
      updatedAt: new Date().toISOString(),
    };
  }

  async getChart(request: QuoteRequest, days: number) {
    return this.fallbackProvider.getChart ? this.fallbackProvider.getChart(request, days) : [];
  }
}
