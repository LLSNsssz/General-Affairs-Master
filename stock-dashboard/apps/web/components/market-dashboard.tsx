"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Activity,
  ChevronRight,
  Clock3,
  DatabaseZap,
  Plus,
  Search,
  ServerCog,
  TrendingUp,
  Wifi,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { ko } from "date-fns/locale";
import { startTransition, useDeferredValue, useTransition } from "react";
import { toast } from "sonner";
import { QuoteChart } from "@/components/quote-chart";
import { StreamBadge } from "@/components/stream-badge";
import { fetchChart, fetchHealth, fetchQuoteBundle, fetchSearch } from "@/lib/market/client";
import { quoteKey, serializeQuoteRequests } from "@/lib/market/requests";
import type { MarketQuote, MarketUniverseEntry, QuoteRequest } from "@/lib/market/types";
import { useDashboardStore } from "@/hooks/use-dashboard-store";
import { useLiveQuotes } from "@/hooks/use-live-quotes";
import {
  average,
  cn,
  formatCompactNumber,
  formatPrice,
  formatSignedNumber,
} from "@/lib/utils";

export function MarketDashboard() {
  const {
    symbols,
    search,
    selectedKey,
    setSearch,
    selectSymbol,
    addSymbol,
    removeSymbol,
  } = useDashboardStore();
  const queryClient = useQueryClient();
  const [isSwitching, startSelectionTransition] = useTransition();
  const deferredSearch = useDeferredValue(search.trim());
  const serializedSymbols = serializeQuoteRequests(symbols);

  const quotesQuery = useQuery({
    queryKey: ["quotes", serializedSymbols],
    queryFn: () => fetchQuoteBundle(symbols),
    enabled: symbols.length > 0,
    placeholderData: (previousData) => previousData,
  });

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    staleTime: 30_000,
  });

  const searchQuery = useQuery({
    queryKey: ["search", deferredSearch],
    queryFn: () => fetchSearch(deferredSearch),
    enabled: deferredSearch.length > 0,
    staleTime: 60_000,
  });

  const provider = quotesQuery.data?.provider ?? healthQuery.data?.provider;
  const liveQuotes = useLiveQuotes(symbols, 2_500);
  const quotesByKey = new Map((quotesQuery.data?.quotes ?? []).map((quote) => [quote.key, quote]));
  const orderedQuotes = symbols.map((symbol) => {
    const key = quoteKey(symbol);
    return quotesByKey.get(key) ?? buildPendingQuote(symbol, provider?.id, provider?.mode);
  });

  const selectedQuote =
    orderedQuotes.find((quote) => quote.key === selectedKey) ?? orderedQuotes[0];
  const selectedRequest = selectedQuote
    ? {
        market: selectedQuote.market,
        symbol: selectedQuote.symbol,
        name: selectedQuote.name,
      }
    : null;

  const activeKeys = new Set(symbols.map((symbol) => quoteKey(symbol)));
  const searchResults = (searchQuery.data?.results ?? []).filter((entry) => {
    return !activeKeys.has(`${entry.market}:${entry.symbol}`);
  });

  const sortedByChange = [...orderedQuotes].sort(
    (left, right) => right.changePercent - left.changePercent,
  );
  const gainers = sortedByChange.slice(0, 3);
  const losers = [...sortedByChange].reverse().slice(0, 3);
  const averageChange = average(orderedQuotes.map((quote) => quote.changePercent));
  const totalVolume = orderedQuotes.reduce((total, quote) => total + quote.volume, 0);
  const premiumCount = orderedQuotes.filter((quote) => quote.mode !== "delayed").length;

  const prefetchChart = (request: QuoteRequest) => {
    void queryClient.prefetchQuery({
      queryKey: ["chart", request.market, request.symbol],
      queryFn: () => fetchChart(request, 90),
      staleTime: 45_000,
    });
  };

  const onAddSymbol = (request: QuoteRequest) => {
    const key = quoteKey(request);
    if (activeKeys.has(key)) {
      toast.info("이미 추적 중인 종목이다.");
      return;
    }

    prefetchChart(request);
    startTransition(() => {
      addSymbol(request);
    });
    toast.success(`${request.name ?? request.symbol} 추가 완료`);
  };

  const onRemoveSymbol = (key: string, label: string) => {
    if (symbols.length <= 1) {
      toast.error("최소 1개 종목은 남겨둬야 한다.");
      return;
    }

    startTransition(() => {
      removeSymbol(key);
    });
    toast.message(`${label} 제거`);
  };

  const onSelectSymbol = (quote: MarketQuote) => {
    prefetchChart({
      market: quote.market,
      symbol: quote.symbol,
      name: quote.name,
    });

    startSelectionTransition(() => {
      selectSymbol(quote.key);
    });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
      <div className="flex w-full flex-col gap-6">
        <section className="panel-strong rounded-[34px] p-6 sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <p className="mono mb-3 text-xs uppercase tracking-[0.28em] text-[var(--accent)]">
                Stock Command Center / Dashboard Runtime
              </p>
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
                읽기 쉬운 종목 리스트와 빠른 상세 전환
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/64 sm:text-base">
                `apps/web`는 dashboard 기준으로 legacy 시세 브리지를 직접 쓰지 않는다. KR/US 시세와
                차트는 public provider로 가져오고, 검색은 전체 종목 유니버스를 로컬 인덱스로 처리한다.
              </p>
            </div>

            {provider ? (
              <StreamBadge
                provider={provider}
                status={liveQuotes.status}
                intervalMs={liveQuotes.effectiveIntervalMs}
              />
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard icon={Activity} label="Tracked" value={`${orderedQuotes.length}`} detail="active instruments" />
              <SummaryCard
                icon={TrendingUp}
                label="Avg Move"
                value={`${formatSignedNumber(averageChange)}%`}
                detail="basket average"
                accent={averageChange >= 0 ? "positive" : "negative"}
              />
              <SummaryCard
                icon={DatabaseZap}
                label="Premium Feed"
                value={`${premiumCount}/${orderedQuotes.length || 1}`}
                detail="non-delayed quotes"
              />
              <SummaryCard
                icon={Wifi}
                label="Flow"
                value={formatCompactNumber(totalVolume)}
                detail="aggregate volume"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <InfoTile
                icon={ServerCog}
                title="Search Universe"
                body="KRX + NASDAQ + NYSE + AMEX full index"
              />
              <InfoTile
                icon={Clock3}
                title="Switch State"
                body={isSwitching ? "detail panel switching" : "ready"}
              />
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[460px_minmax(0,1fr)]">
          <section className="flex flex-col gap-6">
            <div className="panel rounded-[30px] p-5 sm:p-6">
              <label className="mono mb-3 block text-[10px] uppercase tracking-[0.24em] text-white/40">
                Search all companies
              </label>
              <div className="mb-4 flex items-center gap-3 rounded-[20px] border border-white/10 bg-black/18 px-4 py-3">
                <Search className="h-4 w-4 text-white/40" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="회사명 또는 티커 입력"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/28"
                />
              </div>

              <div className="space-y-2">
                {deferredSearch.length === 0 ? (
                  <div className="rounded-[20px] border border-white/8 bg-white/4 px-4 py-4 text-sm text-white/54">
                    종목 검색은 전체 유니버스 기준이다. 예: `삼성전자`, `005930`, `AAPL`, `NVIDIA`
                  </div>
                ) : null}

                {searchQuery.isFetching && deferredSearch.length > 0 ? (
                  <div className="rounded-[20px] border border-white/8 bg-white/4 px-4 py-4 text-sm text-white/54">
                    검색 중
                  </div>
                ) : null}

                {searchResults.map((entry) => (
                  <SearchResultRow
                    key={`${entry.market}:${entry.symbol}`}
                    entry={entry}
                    onHover={() =>
                      prefetchChart({
                        market: entry.market,
                        symbol: entry.symbol,
                        name: entry.name,
                      })
                    }
                    onAdd={() =>
                      onAddSymbol({
                        market: entry.market,
                        symbol: entry.symbol,
                        name: entry.name,
                      })
                    }
                  />
                ))}

                {!searchQuery.isFetching &&
                deferredSearch.length > 0 &&
                searchResults.length === 0 ? (
                  <div className="rounded-[20px] border border-white/8 bg-white/4 px-4 py-4 text-sm text-white/54">
                    검색 결과가 없다.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="panel rounded-[30px] p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="mono text-[10px] uppercase tracking-[0.24em] text-white/40">
                    Active deck
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                    추적 종목
                  </h2>
                </div>
                <div className="text-sm text-white/44">{orderedQuotes.length} items</div>
              </div>

              <div className="space-y-2">
                {orderedQuotes.map((quote) => (
                  <TrackedRow
                    key={quote.key}
                    quote={quote}
                    selected={selectedQuote?.key === quote.key}
                    onHover={() =>
                      prefetchChart({
                        market: quote.market,
                        symbol: quote.symbol,
                        name: quote.name,
                      })
                    }
                    onSelect={() => onSelectSymbol(quote)}
                    onRemove={() => onRemoveSymbol(quote.key, quote.name)}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <RankingPanel title="Top Gainers" items={gainers} />
              <RankingPanel title="Top Laggards" items={losers} />
            </div>
          </section>

          {selectedRequest && selectedQuote ? (
            <section className="flex flex-col gap-6">
              <DetailHeader
                quote={selectedQuote}
                switching={isSwitching || quotesQuery.isFetching}
                providerName={provider?.name ?? "provider"}
                lastMessageAt={liveQuotes.lastMessageAt}
              />
              <QuoteChart request={selectedRequest} currency={selectedQuote.currency} />
            </section>
          ) : (
            <div className="panel flex min-h-[420px] items-center justify-center rounded-[32px] p-6 text-white/52">
              종목을 선택하면 상세 패널을 표시한다.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function buildPendingQuote(
  request: QuoteRequest,
  source = "pending",
  mode: MarketQuote["mode"] = "delayed",
): MarketQuote {
  return {
    key: quoteKey(request),
    market: request.market,
    symbol: request.symbol,
    name: request.name ?? request.symbol,
    currency: request.market === "KR" ? "KRW" : "USD",
    price: 0,
    previousClose: 0,
    changeValue: 0,
    changePercent: 0,
    volume: 0,
    open: 0,
    high: 0,
    low: 0,
    updatedAt: new Date().toISOString(),
    source,
    mode,
    isStale: true,
  };
}

function SearchResultRow({
  entry,
  onHover,
  onAdd,
}: {
  entry: MarketUniverseEntry;
  onHover: () => void;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onClick={onAdd}
      className="flex w-full items-center justify-between rounded-[20px] border border-white/8 bg-white/4 px-4 py-4 text-left transition hover:border-[rgba(233,199,138,0.28)] hover:bg-white/6"
    >
      <div>
        <div className="text-base font-medium text-white">{entry.name}</div>
        <div className="mono mt-1 text-[10px] uppercase tracking-[0.24em] text-white/40">
          {entry.market} / {entry.exchange} / {entry.symbol}
        </div>
      </div>
      <Plus className="h-4 w-4 text-[var(--accent)]" />
    </button>
  );
}

function TrackedRow({
  quote,
  selected,
  onHover,
  onSelect,
  onRemove,
}: {
  quote: MarketQuote;
  selected: boolean;
  onHover: () => void;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={onHover}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex w-full items-center justify-between rounded-[22px] border px-4 py-4 text-left transition",
        selected
          ? "border-[rgba(233,199,138,0.34)] bg-[rgba(240,179,95,0.08)]"
          : "border-white/8 bg-white/4 hover:border-white/16 hover:bg-white/6",
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-base font-medium text-white">{quote.name}</div>
        <div className="mono mt-1 text-[10px] uppercase tracking-[0.24em] text-white/40">
          {quote.market} / {quote.symbol}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-base font-medium text-white">
            {formatPrice(quote.price, quote.currency)}
          </div>
          <div
            className={cn(
              "mono mt-1 text-xs",
              quote.changePercent >= 0 ? "positive" : "negative",
            )}
          >
            {formatSignedNumber(quote.changePercent)}%
          </div>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="rounded-full border border-white/10 px-2.5 py-1.5 text-xs text-white/54 transition hover:border-white/20 hover:text-white"
        >
          삭제
        </button>
      </div>
    </div>
  );
}

function InfoTile({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof ServerCog;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/4 p-5">
      <Icon className="mb-3 h-4 w-4 text-[var(--accent)]" />
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="mt-2 text-sm text-white/56">{body}</div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  accent?: "positive" | "negative";
}) {
  return (
    <motion.div
      className="rounded-[26px] border border-white/8 bg-white/4 p-5"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="mb-8 flex items-center justify-between">
        <span className="mono text-[10px] uppercase tracking-[0.26em] text-white/40">
          {label}
        </span>
        <Icon className="h-4 w-4 text-[var(--accent)]" />
      </div>
      <div
        className={cn(
          "text-3xl font-semibold tracking-[-0.05em] text-white",
          accent === "positive" && "positive",
          accent === "negative" && "negative",
        )}
      >
        {value}
      </div>
      <div className="mt-2 text-sm text-white/52">{detail}</div>
    </motion.div>
  );
}

function DetailHeader({
  quote,
  switching,
  providerName,
  lastMessageAt,
}: {
  quote: MarketQuote;
  switching: boolean;
  providerName: string;
  lastMessageAt: string | null;
}) {
  return (
    <section className="panel-strong rounded-[32px] p-6 sm:p-7">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mono mb-2 text-[11px] uppercase tracking-[0.26em] text-white/40">
            Selected instrument
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-white">
            {quote.name}
          </h2>
          <div className="mono mt-2 text-xs uppercase tracking-[0.24em] text-white/42">
            {quote.market} / {quote.symbol}
          </div>
        </div>

        <div className="text-left xl:text-right">
          <div className="text-4xl font-semibold tracking-[-0.06em] text-white">
            {formatPrice(quote.price, quote.currency)}
          </div>
          <div
            className={cn(
              "mono mt-2 text-sm",
              quote.changePercent >= 0 ? "positive" : "negative",
            )}
          >
            {formatSignedNumber(quote.changeValue)} / {formatSignedNumber(quote.changePercent)}%
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricTile label="Open" value={formatPrice(quote.open, quote.currency)} />
        <MetricTile label="High" value={formatPrice(quote.high, quote.currency)} />
        <MetricTile label="Low" value={formatPrice(quote.low, quote.currency)} />
        <MetricTile label="Volume" value={quote.volume.toLocaleString("en-US")} />
        <MetricTile label="Provider" value={providerName} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/52">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3 py-2">
          <ChevronRight className="h-4 w-4 text-[var(--accent)]" />
          {switching ? "상세 데이터 전환 중" : "상세 패널 준비 완료"}
        </div>
        {lastMessageAt ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3 py-2">
            <Clock3 className="h-4 w-4 text-[var(--accent)]" />
            {formatDistanceToNowStrict(new Date(lastMessageAt), {
              addSuffix: true,
              locale: ko,
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4">
      <div className="mono text-[10px] uppercase tracking-[0.24em] text-white/38">{label}</div>
      <div className="mt-2 text-base font-medium text-white/86">{value}</div>
    </div>
  );
}

function RankingPanel({
  title,
  items,
}: {
  title: string;
  items: Array<{
    key: string;
    name: string;
    market: string;
    symbol: string;
    currency: "KRW" | "USD";
    price: number;
    changePercent: number;
  }>;
}) {
  return (
    <section className="panel rounded-[30px] p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-[-0.05em] text-white">{title}</h2>
        <div className="mono text-[10px] uppercase tracking-[0.24em] text-white/40">
          live ranking
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between rounded-[22px] border border-white/8 bg-white/4 px-4 py-4"
          >
            <div>
              <div className="text-lg font-medium text-white">{item.name}</div>
              <div className="mono mt-1 text-[10px] uppercase tracking-[0.24em] text-white/38">
                {item.market} / {item.symbol}
              </div>
            </div>

            <div className="text-right">
              <div className="text-lg font-medium text-white">
                {formatPrice(item.price, item.currency)}
              </div>
              <div
                className={cn(
                  "mono mt-1 text-xs",
                  item.changePercent >= 0 ? "positive" : "negative",
                )}
              >
                {formatSignedNumber(item.changePercent)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
