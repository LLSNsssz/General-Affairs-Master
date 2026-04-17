import { NextRequest } from "next/server";
import { DEFAULT_SYMBOLS } from "@/lib/default-symbols";
import { parseQuoteRequests } from "@/lib/market/requests";
import { getQuoteProvider } from "@/lib/market/provider";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parsed = parseQuoteRequests(searchParams.get("symbols"));
  const requests = parsed.length ? parsed : DEFAULT_SYMBOLS;
  const provider = getQuoteProvider();
  const bundle = await provider.getQuotes(requests);

  return Response.json(bundle, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
