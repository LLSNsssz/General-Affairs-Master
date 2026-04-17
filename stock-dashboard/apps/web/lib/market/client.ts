import {
  chartResponseSchema,
  healthResponseSchema,
  quoteBundleSchema,
  searchResponseSchema,
} from "@/lib/market/schema";
import { serializeQuoteRequests } from "@/lib/market/requests";
import type { QuoteRequest } from "@/lib/market/types";
import { fetchJson } from "@/lib/http";

export async function fetchQuoteBundle(requests: QuoteRequest[]) {
  const symbols = serializeQuoteRequests(requests);
  const response = await fetchJson(`/api/quotes?symbols=${encodeURIComponent(symbols)}`);
  return quoteBundleSchema.parse(response);
}

export async function fetchChart(request: QuoteRequest, days = 60) {
  const params = new URLSearchParams({
    symbol: request.symbol,
    market: request.market,
    days: String(days),
  });
  const response = await fetchJson(`/api/chart?${params.toString()}`);
  return chartResponseSchema.parse(response);
}

export async function fetchHealth() {
  const response = await fetchJson("/api/health");
  return healthResponseSchema.parse(response);
}

export async function fetchSearch(query: string) {
  const response = await fetchJson(`/api/search?q=${encodeURIComponent(query)}`);
  return searchResponseSchema.parse(response);
}
