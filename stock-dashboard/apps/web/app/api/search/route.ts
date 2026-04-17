import { NextRequest } from "next/server";
import { searchUniverse } from "@/lib/market/universe";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const results = searchUniverse(query, 12);
  return Response.json(
    { results },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
