"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { BarChart3 } from "lucide-react";
import { useEffect, useRef } from "react";
import { fetchChart } from "@/lib/market/client";
import type { QuoteRequest } from "@/lib/market/types";
import { formatPrice } from "@/lib/utils";

type QuoteChartProps = {
  request: QuoteRequest;
  currency: "KRW" | "USD";
};

export function QuoteChart({ request, currency }: QuoteChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const chartQuery = useQuery({
    queryKey: ["chart", request.market, request.symbol],
    queryFn: () => fetchChart(request, 90),
    placeholderData: (previousData) => previousData,
    staleTime: 45_000,
  });

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(244, 239, 230, 0.72)",
        fontFamily: "var(--font-mono)",
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        vertLine: {
          color: "rgba(240,179,95,0.45)",
        },
        horzLine: {
          color: "rgba(240,179,95,0.45)",
        },
      },
    });

    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#4ade80",
      downColor: "#fb7185",
      borderVisible: false,
      wickUpColor: "#4ade80",
      wickDownColor: "#fb7185",
      priceFormat: {
        type: "price",
        precision: currency === "KRW" ? 0 : 2,
        minMove: currency === "KRW" ? 1 : 0.01,
      },
    });

    volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
      color: "rgba(240,179,95,0.28)",
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
    });

    volumeSeriesRef.current.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    return () => {
      chart.remove();
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [currency]);

  useEffect(() => {
    if (!chartQuery.data || !candleSeriesRef.current || !volumeSeriesRef.current) {
      return;
    }

    candleSeriesRef.current.setData(
      chartQuery.data.chart.map((point) => ({
        time: point.time as Time,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
      })),
    );

    volumeSeriesRef.current.setData(
      chartQuery.data.chart.map((point) => ({
        time: point.time as Time,
        value: point.volume,
        color:
          point.close >= point.open ? "rgba(69, 212, 131, 0.28)" : "rgba(255, 124, 106, 0.28)",
      })),
    );
  }, [chartQuery.data]);

  const latestCandle = chartQuery.data?.chart.at(-1);

  return (
    <section className="panel-strong rounded-[32px] p-6 sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mono mb-2 text-[11px] uppercase tracking-[0.28em] text-white/42">
            Price structure
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-white">
            {request.name}
          </h2>
        </div>

        <div className="rounded-full border border-white/10 bg-white/4 px-4 py-2 text-sm text-white/74">
          90D candlestick / volume overlay
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Close" value={formatPrice(latestCandle?.close ?? 0, currency)} />
        <StatCard
          label="Range"
          value={`${formatPrice(latestCandle?.low ?? 0, currency)} - ${formatPrice(latestCandle?.high ?? 0, currency)}`}
        />
        <StatCard
          label="Volume"
          value={(latestCandle?.volume ?? 0).toLocaleString("en-US")}
        />
      </div>

      <div
        ref={containerRef}
        className="min-h-[420px] rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-2"
      />

      {chartQuery.isPending ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-white/56">
          <BarChart3 className="h-4 w-4" />
          차트 데이터 로딩 중
        </div>
      ) : null}

      {chartQuery.isFetching && !chartQuery.isPending ? (
        <div className="mt-4 text-sm text-white/52">새 종목 데이터로 전환 중</div>
      ) : null}

      {chartQuery.isError ? (
        <div className="mt-4 text-sm text-rose-300">차트 데이터를 가져오지 못했다.</div>
      ) : null}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4">
      <div className="mono mb-2 text-[10px] uppercase tracking-[0.26em] text-white/40">
        {label}
      </div>
      <div className="text-lg font-medium text-white/86">{value}</div>
    </div>
  );
}
