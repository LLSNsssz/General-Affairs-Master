import "server-only";
import type { MarketUniverseEntry, QuoteRequest } from "@/lib/market/types";
import { normalizeRequest, quoteKey } from "@/lib/market/requests";
import universe from "@/lib/market/universe.generated.json";

const entries = universe as MarketUniverseEntry[];
const entryByKey = new Map(entries.map((entry) => [`${entry.market}:${entry.symbol}`, entry]));

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function resolveUniverseEntry(request: QuoteRequest) {
  const normalized = normalizeRequest(request);
  return entryByKey.get(quoteKey(normalized));
}

export function searchUniverse(query: string, limit = 12) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return [];
  }

  return entries
    .map((entry) => {
      const symbol = normalizeText(entry.symbol);
      const name = normalizeText(entry.name);
      let score = 0;

      if (symbol === normalizedQuery) {
        score += 100;
      } else if (symbol.startsWith(normalizedQuery)) {
        score += 60;
      } else if (symbol.includes(normalizedQuery)) {
        score += 40;
      }

      if (name === normalizedQuery) {
        score += 95;
      } else if (name.startsWith(normalizedQuery)) {
        score += 55;
      } else if (name.includes(normalizedQuery)) {
        score += 30;
      }

      if (entry.market === "KR" && /[0-9]{2,6}/.test(normalizedQuery)) {
        score += 6;
      }

      return {
        entry,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.entry.name.localeCompare(right.entry.name, "ko");
    })
    .slice(0, limit)
    .map((item) => item.entry);
}
