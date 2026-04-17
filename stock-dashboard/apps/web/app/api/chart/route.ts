import { NextRequest } from "next/server";
import { DEFAULT_SYMBOLS } from "@/lib/default-symbols";
import { normalizeRequest } from "@/lib/market/requests";
import { getQuoteProvider } from "@/lib/market/provider";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fallback = DEFAULT_SYMBOLS[0];
  const chartRequest = normalizeRequest({
    symbol: searchParams.get("symbol") ?? fallback.symbol,
    market: (searchParams.get("market")?.toUpperCase() ?? fallback.market) as "KR" | "US",
    name: searchParams.get("name") ?? fallback.name,
  });
  const days = Number(searchParams.get("days") ?? 60);
  const provider = getQuoteProvider();
  const chart = provider.getChart
    ? await provider.getChart(chartRequest, days)
    : [];

  return Response.json(
    {
      provider: provider.info,
      chart,
      updatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
