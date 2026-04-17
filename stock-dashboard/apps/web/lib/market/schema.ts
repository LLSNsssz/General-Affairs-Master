import { z } from "zod";

const providerModeSchema = z.enum(["delayed", "low-latency", "realtime"]);
const marketSchema = z.enum(["KR", "US"]);

export const quoteRequestSchema = z.object({
  market: marketSchema,
  symbol: z.string().min(1),
  name: z.string().optional(),
});

export const marketUniverseEntrySchema = z.object({
  market: marketSchema,
  symbol: z.string().min(1),
  name: z.string().min(1),
  exchange: z.string().min(1),
  yahooSymbol: z.string().min(1),
});

export const quoteSchema = z.object({
  key: z.string(),
  market: marketSchema,
  symbol: z.string().min(1),
  name: z.string().min(1),
  currency: z.enum(["KRW", "USD"]),
  price: z.number(),
  previousClose: z.number(),
  changeValue: z.number(),
  changePercent: z.number(),
  volume: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  updatedAt: z.string(),
  source: z.string(),
  mode: providerModeSchema,
  isStale: z.boolean(),
});

export const quoteProviderInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  mode: providerModeSchema,
  latencyLabel: z.string(),
  notes: z.string(),
  capabilities: z.object({
    streaming: z.boolean(),
    charts: z.boolean(),
    us: z.boolean(),
    kr: z.boolean(),
  }),
});

export const quoteBundleSchema = z.object({
  provider: quoteProviderInfoSchema,
  quotes: z.array(quoteSchema),
  updatedAt: z.string(),
});

export const chartPointSchema = z.object({
  time: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

export const chartResponseSchema = z.object({
  provider: quoteProviderInfoSchema,
  chart: z.array(chartPointSchema),
  updatedAt: z.string(),
});

export const healthResponseSchema = z.object({
  provider: quoteProviderInfoSchema,
  services: z.object({
    legacyBackend: z.object({
      configured: z.boolean(),
      reachable: z.boolean(),
      status: z.string(),
      required: z.boolean(),
    }),
    polygon: z.object({
      configured: z.boolean(),
    }),
    yahooPublic: z.object({
      configured: z.boolean(),
    }),
    supabase: z.object({
      configured: z.boolean(),
    }),
  }),
  updatedAt: z.string(),
});

export const searchResponseSchema = z.object({
  results: z.array(marketUniverseEntrySchema),
});
