import { getServerEnv } from "@/lib/env";
import { PolygonQuoteProvider } from "@/lib/market/providers/polygon";
import { YahooPublicQuoteProvider } from "@/lib/market/providers/yahoo-public";

export function getPublicProvider() {
  return new YahooPublicQuoteProvider();
}

export function getQuoteProvider() {
  const env = getServerEnv();
  const publicProvider = getPublicProvider();

  if (env.marketDataProvider === "polygon" && env.polygonApiKey) {
    return new PolygonQuoteProvider(publicProvider);
  }

  return publicProvider;
}
