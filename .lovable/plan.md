
# Codebase Refactoring — Completed

All 4 phases have been implemented:

## Phase 1 ✅ Quick Fixes
- Removed duplicate `src/components/ui/use-toast.ts` re-export
- Fixed double `useMarketData()` call in StockSelector
- Moved `TROY_OUNCE_TO_GRAM` to module scope in usePortfolioValueData
- Unified `TradeRow` type alias to reuse `Trade` from types

## Phase 2 ✅ Shared Utilities
- Created `src/lib/portfolioCalc.ts`: getRemainingLotAtDay, linearInterpolatePrice, groupPartialClosesByTrade, calculateUnrealizedPnL
- Created `src/lib/tradeValidation.ts`: validateDirectional, calculateRR, calculatePositionAmount
- Updated useEquityCurveData, usePortfolioValueData, TradeForm, EditTradeModal to use shared utils

## Phase 3 ✅ Component Decomposition
- Created `src/lib/tradeUtils.ts`: getReasonLabels, getReasonLabelsList, getStopReasonLabels, getClosedRR
- Created `src/components/trade/TradeStockCell.tsx`: ActiveStockCell, ClosedStockCell, StaticStockCell
- Created `src/components/trade/TradeNotesDialog.tsx`: unified notes dialog
- Created `src/components/trade/ClosedTradeActionDialog.tsx`: revert/delete dialog
- Rewrote TradeList.tsx to use extracted components (868→~380 lines)
- CashFlowModal deferred (lower priority, higher risk)

## Phase 4 ✅ Architecture
- Converted useAuth to Context-based singleton (AuthProvider)
- Unified ProtectedRoute/PublicRoute into single RouteGuard with mode prop
- Extracted AuthLoadingScreen component
- Centralized Supabase URL in MarketSeriesContext and useStockPriceSeries
