

# Codebase Refactoring Plan

## Executive Summary

This plan identifies refactoring opportunities across the project, ranked by impact and usage frequency. All changes preserve existing UI and functionality. Each item is incremental and can be implemented independently.

---

## Priority 1: High Impact, High Usage

### 1.1 TradeList.tsx — Extract & Deduplicate (868 lines)

**Problem:** Single file with 868 lines containing 8+ inline components (DesktopTable, MobileList, ClosedEntriesDesktopTable, ClosedEntriesMobileList, NotesDialog, ClosedEntryNotesDialog, ClickableStockArea, ClickableClosedStockArea). Massive duplication between active and closed views — stock area rendering, RR calculation, reason labels, and price display logic are copy-pasted across desktop/mobile and active/closed variants.

**Suggested improvements:**
- Extract shared sub-components into `src/components/trade/` folder:
  - `TradeStockCell.tsx` — unified clickable stock area (replaces 4 duplicate implementations)
  - `TradeNotesDialog.tsx` — single notes dialog (replaces 2 near-identical copies)
  - `TradePriceCells.tsx` — price display atoms
  - `ClosedTradeActionDialog.tsx` — the revert/delete dialog and confirmation
- Extract helper functions (`getReasonLabels`, `getClosedRR`, `getCurrentPriceInfo`) into `src/lib/tradeUtils.ts`
- Keep `TradeList.tsx` as the orchestrator (~200 lines)

**Impact:** Reduces TradeList from ~868 to ~200 lines. Eliminates 4 duplicated stock area renderers and 2 duplicated notes dialogs.

---

### 1.2 useEquityCurveData.ts & usePortfolioValueData.ts — Extract Shared Logic (586 + 252 lines)

**Problem:** Both hooks contain identical implementations of `getRemainingLotAtDay`, `linearInterpolatePrice`, and the unrealized PnL calculation loop (~50 lines duplicated verbatim). Both also independently group partial closes by trade_id with the same `useMemo` pattern.

**Suggested improvements:**
- Create `src/lib/portfolioCalc.ts` with shared pure functions:
  - `getRemainingLotAtDay(trade, dayKey, partialCloses)`
  - `linearInterpolatePrice(entryPrice, exitPrice, openDate, closeDate, currentDay)`
  - `calculateUnrealizedPnL(allTrades, currentDay, partialClosesByTrade, stockPriceMap, missingSet)`
  - `groupPartialClosesByTrade(partialCloses)`
- Both hooks import from this shared module

**Impact:** Eliminates ~120 lines of duplicated logic. Centralizes PnL calculation for consistency. Makes unit testing feasible.

---

### 1.3 TradeForm.tsx & EditTradeModal.tsx — Extract Shared Validation (382 + 498 lines)

**Problem:** Both components duplicate the same validation logic:
- Directional validation (`useMemo` with identical buy/sell checks)
- RR ratio calculation (same formula in both)
- Position amount calculation (same formula in both)
- Negative price validation (same pattern in both)

**Suggested improvements:**
- Create `src/lib/tradeValidation.ts`:
  - `validateDirectional(tradeType, entry, target, stop): string[]`
  - `calculateRR(tradeType, entry, target, stop): number | null`
  - `calculatePositionAmount(entry, lot): number | null`
- Create a shared `useTradePriceValidation(tradeType, entry, target, stop)` hook
- Both components use these shared utilities

**Impact:** Eliminates ~80 lines of duplicated validation. Ensures consistent validation behavior.

---

## Priority 2: Medium Impact

### 2.1 useAuth.ts — Singleton Pattern for Auth State

**Problem:** `useAuth()` is called independently in every component that needs auth state (`MainLayout`, `Index`, `Reports`, `useTrades`, `usePortfolioCash`, `useUserAssets`, etc.). Each call creates a new `useState` + `useEffect` with its own `onAuthStateChange` listener. This means multiple Supabase auth subscriptions running simultaneously.

**Suggested improvements:**
- Convert to a Context-based pattern (similar to how `MarketDataContext` works):
  - `AuthProvider` wraps the app, holds auth state once
  - `useAuth()` reads from context instead of creating new state
- This is a standard React pattern and prevents N auth listeners for N hook usages

**Impact:** Single auth subscription instead of one per hook usage. Prevents potential race conditions.

---

### 2.2 CashFlowModal.tsx — Split Multi-Step Form (602 lines)

**Problem:** Single file handling a 3-step wizard (category → type → amount) plus withdraw tab, plus transaction history, plus gold price auto-calculation. Too many concerns in one component.

**Suggested improvements:**
- Extract step components: `CategoryStep.tsx`, `TypeStep.tsx`, `AmountStep.tsx`
- Extract `WithdrawForm.tsx`
- Extract `TransactionHistory.tsx`
- Keep `CashFlowModal.tsx` as the step orchestrator

**Impact:** Reduces from 602 lines to ~150 in orchestrator. Each step becomes independently testable.

---

### 2.3 App.tsx — Deduplicate Route Guards

**Problem:** `ProtectedRoute` and `PublicRoute` both contain identical loading UI (lines 23-28 and 41-46). Minor but straightforward cleanup.

**Suggested improvement:**
- Extract a shared `AuthLoadingScreen` component
- Or create a single `RouteGuard` component with a `mode: 'protected' | 'public'` prop

**Impact:** Small but eliminates duplication and makes auth loading UI consistent.

---

## Priority 3: Lower Impact, Good Practice

### 3.1 Duplicate Toast Exports

**Problem:** `src/hooks/use-toast.ts` and `src/components/ui/use-toast.ts` — the latter just re-exports the former. This creates confusion about which to import.

**Suggested improvement:** Remove `src/components/ui/use-toast.ts` and update any imports to use `@/hooks/use-toast` directly.

---

### 3.2 Type Duplication: TradeRow vs Trade

**Problem:** `src/hooks/useTrades.ts` defines `TradeRow` (lines 18-42) which is structurally identical to `Trade` in `src/types/trade.ts` (lines 113-137). Both are used interchangeably with type casts.

**Suggested improvement:** Remove `TradeRow` from `useTrades.ts` and use the `Trade` type directly. This eliminates a maintenance burden where changes must be synchronized.

---

### 3.3 MarketSeriesContext — Hardcoded API URL

**Problem:** Line 21 has a hardcoded Supabase URL (`https://pjqbpkblutbdpfzzwxmr.supabase.co/functions/v1/market-series`). Same in `useStockPriceSeries.ts` line 117. Should use the Supabase client's URL.

**Suggested improvement:** Import the project URL from the Supabase client configuration or use `supabase.functions.invoke()` instead of raw `fetch`.

---

### 3.4 StockSelector — Double useMarketData Call

**Problem:** Lines 18-20 call `useMarketData()` twice:
```typescript
const { stocks } = useMarketData();
const { xu030 } = useMarketData();
```

**Suggested improvement:** Single destructure: `const { stocks, xu030 } = useMarketData();`

---

### 3.5 TROY_OUNCE_TO_GRAM Constant Placement

**Problem:** In `usePortfolioValueData.ts` line 224, `TROY_OUNCE_TO_GRAM` is declared inside the loop body. While not a performance issue due to compiler optimization, it belongs at module scope for clarity.

**Suggested improvement:** Move to top of file as a module-level constant.

---

## Implementation Order

```text
Phase 1 (Highest value, lowest risk):
  3.1  Remove duplicate toast re-export
  3.4  Fix double useMarketData call
  3.5  Move constant to module scope
  3.2  Unify TradeRow/Trade types

Phase 2 (Extract shared utilities):
  1.2  Extract portfolioCalc.ts shared functions
  1.3  Extract tradeValidation.ts shared functions

Phase 3 (Component decomposition):
  1.1  Split TradeList.tsx into sub-components
  2.2  Split CashFlowModal.tsx into steps

Phase 4 (Architecture):
  2.1  Convert useAuth to Context pattern
  2.3  Deduplicate route guards
  3.3  Centralize Supabase URL usage
```

## Testing Strategy

- Each phase should be followed by manual smoke testing of affected flows
- Phase 1 changes are trivial renames/moves — verify build passes
- Phase 2 changes extract pure functions — add unit tests for `portfolioCalc.ts` and `tradeValidation.ts` using the existing Vitest setup
- Phase 3 changes are UI component splits — verify active/closed trade lists render identically, modals open/close correctly
- Phase 4 changes affect app-wide infrastructure — full regression test of auth flow, chart rendering, and trade operations

