import { getServerEnv } from "@/lib/env";
import { getQuoteProvider } from "@/lib/market/provider";

export const runtime = "nodejs";

export async function GET() {
  const env = getServerEnv();
  const provider = getQuoteProvider();
  const legacyBackend = {
    configured: Boolean(env.legacyApiBaseUrl),
    reachable: false,
    status: "optional",
    required: false,
  };

  return Response.json(
    {
      provider: provider.info,
      services: {
        legacyBackend,
        polygon: {
          configured: Boolean(env.polygonApiKey),
        },
        yahooPublic: {
          configured: true,
        },
        supabase: {
          configured: Boolean(
            env.nextPublicSupabaseUrl && env.nextPublicSupabaseAnonKey,
          ),
        },
      },
      updatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
