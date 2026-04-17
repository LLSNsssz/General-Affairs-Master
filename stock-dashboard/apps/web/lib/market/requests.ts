import { SYMBOL_NAME_INDEX } from "@/lib/default-symbols";
import type { QuoteKey, QuoteRequest } from "@/lib/market/types";
import { quoteRequestSchema } from "@/lib/market/schema";

export function quoteKey(request: QuoteRequest): QuoteKey {
  return `${request.market}:${request.symbol.toUpperCase()}`;
}

export function normalizeRequest(request: QuoteRequest): QuoteRequest {
  const normalized = quoteRequestSchema.parse({
    ...request,
    market: request.market.toUpperCase(),
    symbol: request.symbol.toUpperCase(),
  });
  const key = quoteKey(normalized);

  return {
    ...normalized,
    name: normalized.name ?? SYMBOL_NAME_INDEX.get(key) ?? normalized.symbol,
  };
}

export function serializeQuoteRequests(requests: QuoteRequest[]) {
  return requests.map((request) => quoteKey(normalizeRequest(request))).join(",");
}

export function parseQuoteRequests(raw: string | null | undefined) {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [market, symbol] = item.split(":");
      return normalizeRequest({
        market: (market ?? "").toUpperCase() as QuoteRequest["market"],
        symbol: (symbol ?? "").toUpperCase(),
      });
    });
}
