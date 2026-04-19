import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

// ── Transfer item shapes — mirror the SQL RPC's jsonb contract.

export interface TransferTlCashItem {
  type: 'tl_cash';
  amount: number;
}

export interface TransferAssetFullItem {
  type: 'asset_full';
  asset_id: string;
}

export interface TransferAssetPartialItem {
  type: 'asset_partial';
  asset_id: string;
  amount_usd: number;
  quantity: number;
}

export interface TransferStockItem {
  type: 'stock';
  trade_id: string;
  lots: number;
}

export type TransferItem =
  | TransferTlCashItem
  | TransferAssetFullItem
  | TransferAssetPartialItem
  | TransferStockItem;

export interface TransferPortfolioItemsPayload {
  fromPortfolioId: string;
  toPortfolioId: string;
  items: TransferItem[];
}

/**
 * usePortfolioTransfer — atomic multi-item transfer between two portfolios.
 *
 * All items run inside a single DB transaction. On success, every query
 * that depends on portfolio-scoped data (trades, cash flows, assets,
 * snapshots) is invalidated so the UI reflects the move immediately.
 */
export function usePortfolioTransfer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const transfer = useMutation({
    mutationFn: async (payload: TransferPortfolioItemsPayload) => {
      if (!user) throw new Error('Not authenticated');
      if (!payload.items.length) throw new Error('Aktarılacak bir şey seçilmedi');

      const { error } = await supabase.rpc('transfer_portfolio_items', {
        p_user_id: user.id,
        p_from_portfolio_id: payload.fromPortfolioId,
        p_to_portfolio_id: payload.toPortfolioId,
        // The RPC declares p_items as jsonb; supabase-js serializes the object.
        p_items: payload.items as unknown as never,
      });

      if (error) throw error;
    },
    onSuccess: (_, payload) => {
      // Blow the caches for every surface that scopes by portfolio_id.
      queryClient.invalidateQueries({ queryKey: ['trades', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['trade_partial_closes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['portfolio_cash_flows', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['portfolioCash'] });
      queryClient.invalidateQueries({ queryKey: ['user_assets', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['portfolio_value_snapshots', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['portfolio_events'] });
      queryClient.invalidateQueries({ queryKey: ['equityCurve'] });
      queryClient.invalidateQueries({ queryKey: ['trades_for_cash', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['realized_pnl_rows', user?.id] });

      toast({
        title: 'Aktarım tamamlandı',
        description: `${payload.items.length} kalem başarıyla taşındı.`,
      });
    },
    onError: (err) => {
      toast({
        title: 'Aktarım başarısız',
        description: (err as Error).message,
        variant: 'destructive',
      });
    },
  });

  return { transfer };
}
