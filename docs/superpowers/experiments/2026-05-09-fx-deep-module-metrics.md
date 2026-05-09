# `lib/fx/` deep-module migration — metrics

**Captured:** 2026-05-09
**Baseline:** origin/main at 62b755db5626fd79d269947730f75c30639681f0
**After:** foundation PR tip at fa4a697bb47a48e1f3f006c79dc8f6289e427eaf (`feature/291-deep-modules-foundation`)

## Quantitative

| Metric | Before | After | Delta |
|---|---|---|---|
| Source LOC (lib/fx, excl. tests) | 324 | 588 | +264 (+81.5%) |
| Test LOC (fx-*.test.ts) | 471 | 647 | +176 (+37.4%) |
| Public API exports across lib/fx | 9 | 34 | +25 |
| Type-check median time (5 runs) | 10.940s | 11.158s | +2.0% |
| Bundle size (gzipped, KB) — fx chunks | 69.3 | 59.9 | -13.6% |

### Per-file breakdowns

**Source LOC raw (after):**
```
     135 apps/web/lib/fx/orchestrator.ts
      29 apps/web/lib/fx/types.ts
       6 apps/web/lib/fx/constants.ts
      27 apps/web/lib/fx/registry.ts
      40 apps/web/lib/fx/index.ts
      34 apps/web/lib/fx/provider.ts
     103 apps/web/lib/fx/cache/db-cache.ts
     132 apps/web/lib/fx/providers/frankfurter.ts
      29 apps/web/lib/fx/jobs/prune-cache.ts
      53 apps/web/lib/fx/jobs/prewarm-rates.ts
     588 total
```

**Source LOC raw (before):**
```
     101 apps/web/lib/fx/frankfurter.ts
     167 apps/web/lib/fx/get-rate.ts
       6 apps/web/lib/fx/constants.ts
      16 apps/web/lib/fx/registry.ts
      34 apps/web/lib/fx/provider.ts
     324 total
```

**Test LOC raw (after):**
```
      91 apps/web/__tests__/fx-error-variants.test.ts
     194 apps/web/__tests__/fx-frankfurter.test.ts
     180 apps/web/__tests__/fx-orchestrator.test.ts
      81 apps/web/__tests__/fx-prewarm.test.ts
      57 apps/web/__tests__/fx-prune-cache.test.ts
      44 apps/web/__tests__/fx-types.test.ts
     647 total
```

**Test LOC raw (before):**
```
     175 apps/web/__tests__/fx-frankfurter.test.ts
     158 apps/web/__tests__/fx-get-rate.test.ts
      81 apps/web/__tests__/fx-prewarm.test.ts
      57 apps/web/__tests__/fx-prune-cache.test.ts
     471 total
```

**Type-check timings (5 runs each):**

Before:
```
real	0m32.308s
real	0m11.364s
real	0m10.935s
real	0m10.940s
real	0m10.419s
```
After:
```
real	0m11.158s
real	0m10.755s
real	0m10.502s
real	0m11.298s
real	0m11.364s
```

Note: the 32.308s outlier in the BEFORE run 1 reflects cold-start cost (no incremental cache); the median (10.940s) is unaffected.

**Bundle chunks containing fx:**

Before (from `/tmp/fx-before-bundle.txt`):
```
    6355 .next/server/chunks/3387.js
    4234 .next/server/chunks/987.js
    7575 .next/server/chunks/6042.js
    6713 .next/server/chunks/1646.js
    8662 .next/server/chunks/1442.js
    4898 .next/server/chunks/9006.js
   14982 .next/server/chunks/3175.js
    4936 .next/server/chunks/4480.js
    4909 .next/static/chunks/6880-8e5bdf1d2b1dd24d.js
    7715 .next/server/app/(app)/settings/integrations/fx/page.js
TOTAL: 70979 bytes (69.3 KB)
```

After (from `/tmp/fx-after-bundle.txt`):
```
    3336 .next/server/chunks/5195.js
    6713 .next/server/chunks/1646.js
    8662 .next/server/chunks/1442.js
    4895 .next/server/chunks/8497.js
    4909 .next/static/chunks/6880-8e5bdf1d2b1dd24d.js
    7897 .next/server/app/api/fx/preview/route.js
   16214 .next/server/app/api/ai/chat/route.js
    8707 .next/server/app/(app)/settings/integrations/fx/page.js
TOTAL: 61333 bytes (59.9 KB)
```

## Qualitative

- **Public surface**: `getFxRate` (discriminated outcome), `getFxRateWithFallback` (legacy throw semantics), `runPrewarmRates`, `runPruneCache`, `supportedCurrencies` / `isCurrencySupported`, `getActiveFxProvider`, `__setActiveFxProviderForTesting` (test-only), plus types `FxRate` / `FxResult` / `FxError` / `FxProvider`.
- **Wire decoding**: Frankfurter response now Zod-decoded; previous `as { rates: ... }` cast removed.
- **Error model**: discriminated `FxError` (`ProviderTimeout` / `ProviderBadResponse` / `NoRateAvailable`) + `StaleFallbackUsed` carries `daysStale`; legacy throw semantics preserved via wrapper.
- **DB cache**: extracted to `lib/fx/cache/db-cache.ts` (`readCache`, `tryCrossRate`, `findRecentFallback`, `writeCache`, `fmtDate`, `FX_FALLBACK_WINDOW_DAYS`).
- **Jobs**: prewarm + prune business logic moved to `lib/fx/jobs/`; the BullMQ processors at `lib/jobs/processors/fx-*` are now thin payload adapters.
- **Consumers**: 8 production sites migrated from `@/lib/fx/*` sub-paths to `@/lib/fx`. Zero sub-path imports remain in production code.
- **ESLint**: `lib/fx` is on the strict-list; `lib/logging` and `lib/currency` got `index.ts` re-exports as part of this migration so lib/fx imports them via index too.
