"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useState } from "react";
import { quoteBundleSchema, quoteProviderInfoSchema } from "@/lib/market/schema";
import { serializeQuoteRequests } from "@/lib/market/requests";
import type { QuoteRequest } from "@/lib/market/types";

type StreamState = "connecting" | "live" | "reconnecting" | "error";

type StreamStatusPayload = {
  provider: unknown;
  effectiveIntervalMs: number;
};

export function useLiveQuotes(requests: QuoteRequest[], intervalMs = 1_500) {
  const queryClient = useQueryClient();
  const serialized = serializeQuoteRequests(requests);
  const [status, setStatus] = useState<StreamState>("connecting");
  const [effectiveIntervalMs, setEffectiveIntervalMs] = useState(intervalMs);
  const [lastMessageAt, setLastMessageAt] = useState<string | null>(null);

  const onQuote = useEffectEvent((event: MessageEvent<string>) => {
    const bundle = quoteBundleSchema.parse(JSON.parse(event.data));
    queryClient.setQueryData(["quotes", serialized], bundle);
    setLastMessageAt(bundle.updatedAt);
    setStatus("live");
  });

  const onStatus = useEffectEvent((event: MessageEvent<string>) => {
    const payload = JSON.parse(event.data) as StreamStatusPayload;
    quoteProviderInfoSchema.parse(payload.provider);
    setEffectiveIntervalMs(payload.effectiveIntervalMs);
  });

  useEffect(() => {
    if (!serialized) {
      return;
    }

    const source = new EventSource(
      `/api/stream?symbols=${encodeURIComponent(serialized)}&interval=${intervalMs}`,
    );
    source.onopen = () => {
      setStatus("connecting");
    };

    source.addEventListener("quote", onQuote as unknown as EventListener);
    source.addEventListener("status", onStatus as unknown as EventListener);
    source.onerror = () => {
      setStatus("reconnecting");
    };

    return () => {
      source.close();
    };
  }, [intervalMs, serialized]);

  return {
    status,
    effectiveIntervalMs,
    lastMessageAt,
  };
}
