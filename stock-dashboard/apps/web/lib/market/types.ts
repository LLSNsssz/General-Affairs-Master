export type Market = "KR" | "US";
export type ProviderMode = "delayed" | "low-latency" | "realtime";
export type QuoteKey = string;

export type QuoteRequest = {
  market: Market;
  symbol: string;
  name?: string;
};

export type MarketUniverseEntry = {
  market: Market;
  symbol: string;
  name: string;
  exchange: string;
  yahooSymbol: string;
};

export type MarketQuote = {
  key: QuoteKey;
  market: Market;
  symbol: string;
  name: string;
  currency: "KRW" | "USD";
  price: number;
  previousClose: number;
  changeValue: number;
  changePercent: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  updatedAt: string;
  source: string;
  mode: ProviderMode;
  isStale: boolean;
};

export type QuoteProviderInfo = {
  id: string;
  name: string;
  mode: ProviderMode;
  latencyLabel: string;
  notes: string;
  capabilities: {
    streaming: boolean;
    charts: boolean;
    us: boolean;
    kr: boolean;
  };
};

export type QuoteBundle = {
  provider: QuoteProviderInfo;
  quotes: MarketQuote[];
  updatedAt: string;
};

export type ChartPoint = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export interface QuoteProvider {
  readonly info: QuoteProviderInfo;
  getQuotes(requests: QuoteRequest[]): Promise<QuoteBundle>;
  getChart?(request: QuoteRequest, days: number): Promise<ChartPoint[]>;
}
