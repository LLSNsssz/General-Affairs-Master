"use client";

import { motion } from "motion/react";
import { X } from "lucide-react";
import type { MarketQuote } from "@/lib/market/types";
import { cn, formatCompactNumber, formatPrice, formatSignedNumber } from "@/lib/utils";

type QuoteCardProps = {
  quote: MarketQuote;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
};

export function QuoteCard({
  quote,
  selected,
  onSelect,
  onRemove,
}: QuoteCardProps) {
  const isPositive = quote.changePercent >= 0;

  return (
    <motion.article
      layout
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      role="button"
      className={cn(
        "group panel relative overflow-hidden rounded-[28px] p-5 text-left outline-none transition hover:-translate-y-0.5 hover:border-[rgba(233,199,138,0.34)] focus-visible:border-[rgba(233,199,138,0.45)]",
        selected && "panel-strong border-[rgba(233,199,138,0.42)]",
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
    >
      <div className="absolute right-3 top-3">
        <button
          type="button"
          className="rounded-full border border-white/10 bg-black/10 p-2 text-white/45 transition hover:border-white/20 hover:text-white"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          aria-label={`${quote.name} remove`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mono mb-2 text-[11px] uppercase tracking-[0.28em] text-white/42">
            {quote.market} / {quote.symbol}
          </p>
          <h3 className="max-w-[13rem] text-2xl font-semibold tracking-[-0.04em] text-white">
            {quote.name}
          </h3>
        </div>

        <div
          className={cn(
            "mono rounded-full px-3 py-1 text-xs uppercase tracking-[0.24em]",
            quote.mode === "delayed"
              ? "bg-white/6 text-white/58"
              : "bg-emerald-400/12 text-emerald-300",
          )}
        >
          {quote.mode}
        </div>
      </div>

      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="mono mb-2 text-xs uppercase tracking-[0.24em] text-white/42">
            Last
          </div>
          <div className="text-3xl font-semibold tracking-[-0.05em] text-white">
            {formatPrice(quote.price, quote.currency)}
          </div>
        </div>

        <div
          className={cn(
            "rounded-[18px] px-3 py-2 text-right",
            isPositive ? "bg-emerald-400/10" : "bg-rose-400/10",
          )}
        >
          <div
            className={cn(
              "mono text-xs uppercase tracking-[0.18em]",
              isPositive ? "positive" : "negative",
            )}
          >
            {formatSignedNumber(quote.changeValue)}
          </div>
          <div
            className={cn(
              "text-lg font-semibold tracking-[-0.04em]",
              isPositive ? "positive" : "negative",
            )}
          >
            {formatSignedNumber(quote.changePercent)}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm text-white/68">
        <Metric label="Open" value={formatPrice(quote.open, quote.currency)} />
        <Metric label="High" value={formatPrice(quote.high, quote.currency)} />
        <Metric label="Volume" value={formatCompactNumber(quote.volume)} />
      </div>
    </motion.article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/4 px-3 py-3">
      <div className="mono mb-1 text-[10px] uppercase tracking-[0.24em] text-white/38">
        {label}
      </div>
      <div className="text-sm font-medium text-white/82">{value}</div>
    </div>
  );
}
