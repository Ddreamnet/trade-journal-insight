import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { ClosingType, ClosedTradeEntry } from '@/types/trade';

export interface TradeInsert {
  portfolio_id: string;
  stock_symbol: string;
  stock_name: string;
  trade_type: 'buy' | 'sell';
  entry_price: number;
  target_price: number;
  stop_price: number;
  reasons: string[];
  lot_quantity?: number;
}

// TradeRow is now unified with Trade from @/types/trade
import { Trade } from '@/types/trade';
type TradeRow = Trade;

export interface CloseTradeParams {
  tradeId: string;
  exitPrice: number;
  closingType: ClosingType;
  stopReason?: string;
  closingNote?: string;
  lotQuantity: number;
}

export function useTrades() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: trades = [], isLoading, error } = useQuery({
    queryKey: ['trades', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TradeRow[];
    },
    enabled: !!user,
  });

  const { data: partialCloses = [], isLoading: isLoadingPartials } = useQuery({
    queryKey: ['trade_partial_closes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('trade_partial_closes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createTrade = useMutation({
    mutationFn: async (trade: TradeInsert) => {
      if (!user) throw new Error('Not authenticated');

      const { data: tradeId, error: rpcError } = await supabase.rpc('create_trade_with_cash_check', {
        p_user_id: user.id,
        p_portfolio_id: trade.portfolio_id,
        p_stock_symbol: trade.stock_symbol,
        p_stock_name: trade.stock_name,
        p_trade_type: trade.trade_type,
        p_entry_price: trade.entry_price,
        p_target_price: trade.target_price,
        p_stop_price: trade.stop_price,
        p_lot_quantity: trade.lot_quantity || 0,
        p_reasons: trade.reasons,
      });

      if (rpcError) throw rpcError;

      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .single();

      if (error) throw error;
      return data as TradeRow;
    },
    onSuccess: (newTrade) => {
      queryClient.setQueryData(['trades', user?.id], (old: TradeRow[] = []) => [
        newTrade,
        ...old,
      ]);
      toast({
        title: 'İşlem kaydedildi!',
        description: `${newTrade.stock_symbol} ${newTrade.trade_type === 'buy' ? 'alış' : 'satış'} işlemi eklendi.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Hata',
        description: 'İşlem kaydedilemedi: ' + error.message,
        variant: 'destructive',
      });
    },
  });

  const closeTrade = useMutation({
    mutationFn: async ({ tradeId, exitPrice, closingType, stopReason, closingNote, lotQuantity }: CloseTradeParams) => {
      if (!user) throw new Error('Not authenticated');

      const { data: partialId, error: rpcError } = await supabase.rpc('close_trade_partial', {
        p_user_id: user.id,
        p_trade_id: tradeId,
        p_exit_price: exitPrice,
        p_lot_quantity: lotQuantity,
        p_closing_type: closingType,
        p_stop_reason: closingType === 'stop' ? (stopReason || null) : null,
        p_closing_note: closingNote || null,
      });

      if (rpcError) throw rpcError;

      // Re-fetch the trade to get updated state
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .single();

      if (error) throw error;
      return data as TradeRow;
    },
    onSuccess: (updatedTrade) => {
      queryClient.setQueryData(['trades', user?.id], (old: TradeRow[] = []) =>
        old.map((t) => (t.id === updatedTrade.id ? updatedTrade : t))
      );
      queryClient.invalidateQueries({ queryKey: ['trade_partial_closes', user?.id] });
      
      const isClosed = updatedTrade.status === 'closed';
      const isKarAl = updatedTrade.closing_type === 'kar_al';
      toast({
        title: isClosed 
          ? (isKarAl ? '💰 Kâr Al!' : '🛑 Stop')
          : '📊 Kısmi Çıkış',
        description: isClosed
          ? `İşlem %${updatedTrade.progress_percent?.toFixed(1)} ilerleme ile kapatıldı.`
          : `Kısmi çıkış yapıldı. Kalan lot: ${updatedTrade.remaining_lot}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Hata',
        description: 'İşlem kapatılamadı: ' + error.message,
        variant: 'destructive',
      });
    },
  });

  const updateTrade = useMutation({
    mutationFn: async ({ tradeId, data }: { tradeId: string; data: Partial<TradeRow> }) => {
      const { data: updatedData, error } = await supabase
        .from('trades')
        .update(data)
        .eq('id', tradeId)
        .select()
        .single();

      if (error) throw error;
      return updatedData as TradeRow;
    },
    onSuccess: (updatedTrade) => {
      queryClient.setQueryData(['trades', user?.id], (old: TradeRow[] = []) =>
        old.map((t) => (t.id === updatedTrade.id ? updatedTrade : t))
      );
      toast({
        title: 'İşlem güncellendi',
        description: `${updatedTrade.stock_symbol} işlemi başarıyla güncellendi.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Hata',
        description: 'İşlem güncellenemedi: ' + error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteTrade = useMutation({
    mutationFn: async (tradeId: string) => {
      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', tradeId);

      if (error) throw error;
      return tradeId;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData(['trades', user?.id], (old: TradeRow[] = []) =>
        old.filter((t) => t.id !== deletedId)
      );
      toast({
        title: 'İşlem silindi',
        description: 'İşlem başarıyla silindi.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Hata',
        description: 'İşlem silinemedi: ' + error.message,
        variant: 'destructive',
      });
    },
  });

  const revertPartialClose = useMutation({
    mutationFn: async ({ entryId, tradeId }: { entryId: string; tradeId: string }) => {
      if (!user) throw new Error('Not authenticated');

      // 1. Get the partial close record
      const { data: pc, error: pcError } = await supabase
        .from('trade_partial_closes')
        .select('*')
        .eq('id', entryId)
        .single();
      if (pcError) throw pcError;

      // 2. Get current trade
      const { data: trade, error: tradeError } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .single();
      if (tradeError) throw tradeError;

      // 3. Delete partial close record
      const { error: delPcError } = await supabase
        .from('trade_partial_closes')
        .delete()
        .eq('id', entryId);
      if (delPcError) throw delPcError;

      // 4. Restore remaining_lot and revert status if fully closed
      const newRemaining = trade.remaining_lot + pc.lot_quantity;
      const updateData: Record<string, unknown> = { remaining_lot: newRemaining };
      
      if (trade.status === 'closed') {
        updateData.status = 'active';
        updateData.exit_price = null;
        updateData.closing_type = null;
        updateData.stop_reason = null;
        updateData.closing_note = null;
        updateData.closed_at = null;
        updateData.is_successful = null;
        updateData.progress_percent = null;
      }

      const { error: updateError } = await supabase
        .from('trades')
        .update(updateData)
        .eq('id', tradeId);
      if (updateError) throw updateError;

      // 5. Delete related PnL events from portfolio_events
      const { data: pnlEvents } = await supabase
        .from('portfolio_events')
        .select('id')
        .eq('trade_id', tradeId)
        .eq('event_type', 'pnl');

      if (pnlEvents && pnlEvents.length > 0) {
        const eventIds = pnlEvents.map(e => e.id);
        // Delete related snapshots first
        for (const eid of eventIds) {
          await supabase.from('portfolio_snapshots').delete().eq('event_id', eid);
        }
        // Delete the events
        await supabase.from('portfolio_events').delete().eq('trade_id', tradeId).eq('event_type', 'pnl');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['trade_partial_closes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['portfolio_events'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio_snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['portfolioCash'] });
      queryClient.invalidateQueries({ queryKey: ['equityCurve'] });
      toast({ title: 'Geri alındı', description: 'İşlem kapanışı geri alındı.' });
    },
    onError: (error) => {
      toast({ title: 'Hata', description: 'Geri alma başarısız: ' + error.message, variant: 'destructive' });
    },
  });

  const deleteClosedTrade = useMutation({
    mutationFn: async ({ entryId, tradeId }: { entryId: string; tradeId: string }) => {
      if (!user) throw new Error('Not authenticated');

      // 1. Delete all partial closes for this trade
      await supabase.from('trade_partial_closes').delete().eq('trade_id', tradeId);

      // 2. Delete related portfolio events & snapshots
      const { data: pnlEvents } = await supabase
        .from('portfolio_events')
        .select('id')
        .eq('trade_id', tradeId);

      if (pnlEvents && pnlEvents.length > 0) {
        for (const ev of pnlEvents) {
          await supabase.from('portfolio_snapshots').delete().eq('event_id', ev.id);
        }
        await supabase.from('portfolio_events').delete().eq('trade_id', tradeId);
      }

      // 3. Delete the trade itself
      const { error } = await supabase.from('trades').delete().eq('id', tradeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['trade_partial_closes', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['portfolio_events'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio_snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['portfolioCash'] });
      queryClient.invalidateQueries({ queryKey: ['equityCurve'] });
      toast({ title: 'Silindi', description: 'İşlem tamamen silindi.' });
    },
    onError: (error) => {
      toast({ title: 'Hata', description: 'Silme başarısız: ' + error.message, variant: 'destructive' });
    },
  });

  const activeTrades = trades.filter((t) => t.status === 'active');
  const closedTrades = trades.filter((t) => t.status === 'closed');

  // Build closedTradeEntries from partial closes merged with parent trade info
  const closedTradeEntries: ClosedTradeEntry[] = partialCloses.map((pc) => {
    const parentTrade = trades.find((t) => t.id === pc.trade_id);
    return {
      id: pc.id,
      trade_id: pc.trade_id,
      portfolio_id: pc.portfolio_id ?? parentTrade?.portfolio_id ?? '',
      stock_symbol: parentTrade?.stock_symbol ?? '',
      stock_name: parentTrade?.stock_name ?? '',
      trade_type: (parentTrade?.trade_type ?? 'buy') as 'buy' | 'sell',
      entry_price: parentTrade?.entry_price ?? 0,
      target_price: parentTrade?.target_price ?? 0,
      stop_price: parentTrade?.stop_price ?? 0,
      reasons: parentTrade?.reasons ?? [],
      rr_ratio: parentTrade?.rr_ratio ?? null,
      exit_price: pc.exit_price,
      closing_type: pc.closing_type,
      stop_reason: pc.stop_reason,
      closing_note: pc.closing_note,
      lot_quantity: pc.lot_quantity,
      realized_pnl: pc.realized_pnl,
      created_at: pc.created_at,
    };
  });

  return {
    trades,
    activeTrades,
    closedTrades,
    closedTradeEntries,
    isLoading: isLoading || isLoadingPartials,
    error,
    createTrade,
    closeTrade,
    updateTrade,
    deleteTrade,
    revertPartialClose,
    deleteClosedTrade,
  };
}
