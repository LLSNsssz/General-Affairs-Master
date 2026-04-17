"use client";

import type { QuoteProviderInfo } from "@/lib/market/types";
import { cn } from "@/lib/utils";

type StreamBadgeProps = {
  provider: QuoteProviderInfo;
  status: "connecting" | "live" | "reconnecting" | "error";
  intervalMs: number;
};

const statusTone: Record<StreamBadgeProps["status"], string> = {
  connecting: "bg-amber-300",
  live: "bg-emerald-400",
  reconnecting: "bg-orange-400",
  error: "bg-rose-400",
};

const statusLabel: Record<StreamBadgeProps["status"], string> = {
  connecting: "connecting",
  live: "live",
  reconnecting: "retrying",
  error: "error",
};

export function StreamBadge({ provider, status, intervalMs }: StreamBadgeProps) {
  return (
    <div className="panel inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm text-white/86">
      <span className={cn("h-2.5 w-2.5 rounded-full", statusTone[status])} />
      <span className="font-medium">{provider.name}</span>
      <span className="text-white/34">/</span>
      <span className="mono text-xs uppercase tracking-[0.24em] text-white/62">
        {provider.mode}
      </span>
      <span className="text-white/34">/</span>
      <span className="mono text-xs text-white/62">{intervalMs}ms</span>
      <span className="text-white/34">/</span>
      <span className="mono text-xs uppercase tracking-[0.24em] text-white/62">
        {statusLabel[status]}
      </span>
    </div>
  );
}
