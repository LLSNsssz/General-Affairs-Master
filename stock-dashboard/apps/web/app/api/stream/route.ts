import { NextRequest } from "next/server";
import { DEFAULT_SYMBOLS } from "@/lib/default-symbols";
import { parseQuoteRequests } from "@/lib/market/requests";
import { getQuoteProvider } from "@/lib/market/provider";

export const runtime = "nodejs";

function encodeEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function clampIntervalMs(requested: number, mode: "delayed" | "low-latency" | "realtime") {
  if (mode === "delayed") {
    return Math.max(requested, 5_000);
  }
  if (mode === "low-latency") {
    return Math.max(requested, 2_500);
  }
  return Math.max(requested, 750);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parsed = parseQuoteRequests(searchParams.get("symbols"));
  const requests = parsed.length ? parsed : DEFAULT_SYMBOLS;
  const provider = getQuoteProvider();
  const requestedIntervalMs = Number(searchParams.get("interval") ?? 1_500);
  const effectiveIntervalMs = clampIntervalMs(
    Number.isFinite(requestedIntervalMs) ? requestedIntervalMs : 1_500,
    provider.info.mode,
  );
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let active = false;

      const send = (event: string, payload: unknown) => {
        if (closed) {
          return;
        }
        controller.enqueue(encoder.encode(encodeEvent(event, payload)));
      };

      const publish = async () => {
        if (closed || active) {
          return;
        }

        active = true;
        try {
          const bundle = await provider.getQuotes(requests);
          send("quote", bundle);
        } catch (error) {
          send("error", {
            message: error instanceof Error ? error.message : "Unknown stream error",
          });
        } finally {
          active = false;
        }
      };

      send("status", {
        provider: provider.info,
        effectiveIntervalMs,
      });

      void publish();

      const timer = setInterval(() => {
        void publish();
      }, effectiveIntervalMs);

      const shutdown = () => {
        if (closed) {
          return;
        }
        closed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          return;
        }
      };

      request.signal.addEventListener("abort", shutdown);
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
