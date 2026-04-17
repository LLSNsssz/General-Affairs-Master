import "server-only";

export function getServerEnv() {
  return {
    legacyApiBaseUrl: process.env.LEGACY_API_BASE_URL ?? "http://127.0.0.1:8000",
    marketDataProvider:
      process.env.MARKET_DATA_PROVIDER ??
      (process.env.POLYGON_API_KEY ? "polygon" : "yahoo-public"),
    polygonApiKey: process.env.POLYGON_API_KEY ?? "",
    nextPublicSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    nextPublicSupabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}
