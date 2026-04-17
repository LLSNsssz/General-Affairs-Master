import type { QuoteRequest } from "@/lib/market/types";

export const SYMBOL_UNIVERSE: QuoteRequest[] = [
  { market: "KR", symbol: "005930", name: "삼성전자" },
  { market: "KR", symbol: "000660", name: "SK하이닉스" },
  { market: "KR", symbol: "035420", name: "NAVER" },
  { market: "KR", symbol: "035720", name: "카카오" },
  { market: "KR", symbol: "051910", name: "LG화학" },
  { market: "KR", symbol: "068270", name: "셀트리온" },
  { market: "US", symbol: "AAPL", name: "Apple" },
  { market: "US", symbol: "MSFT", name: "Microsoft" },
  { market: "US", symbol: "NVDA", name: "NVIDIA" },
  { market: "US", symbol: "META", name: "Meta" },
  { market: "US", symbol: "AMZN", name: "Amazon" },
  { market: "US", symbol: "TSM", name: "TSMC" },
];

export const DEFAULT_SYMBOLS: QuoteRequest[] = [
  SYMBOL_UNIVERSE[0],
  SYMBOL_UNIVERSE[1],
  SYMBOL_UNIVERSE[6],
  SYMBOL_UNIVERSE[7],
  SYMBOL_UNIVERSE[8],
  SYMBOL_UNIVERSE[11],
];

export const SYMBOL_NAME_INDEX = new Map(
  SYMBOL_UNIVERSE.map((symbol) => [`${symbol.market}:${symbol.symbol}`, symbol.name]),
);
