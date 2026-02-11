import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { ClosingType } from '@/types/trade';

export interface TradeInsert {
  stock_symbol: string;
  stock_name: string;
  trade_type: 'buy' | 'sell';
  entry_price: number;
  target_price: number;
  stop_price: number;
  reasons: string[];
  lot_quantity?: number;
}

export interface TradeRow {
  id: string;
  user_id: string;
  stock_symbol: string;
  stock_name: string;
  trade_type: 'buy' | 'sell';
  entry_price: number;
  target_price: number;
  stop_price: number;
  reasons: string[];
  rr_ratio: number | null;
  status: 'active' | 'closed';
  exit_price: number | null;
  progress_percent: number | null;
  is_successful: boolean | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closing_note: string | null;
  position_amount: number | null;
  closing_type: ClosingType | null;
  stop_reason: string | null;
  lot_quantity: number;
  remaining_lot: number;
}

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

  const createTrade = useMutation({
    mutationFn: async (trade: TradeInsert) => {
      if (!user) throw new Error('Not authenticated');

      const { data: tradeId, error: rpcError } = await supabase.rpc('create_trade_with_cash_check', {
        p_user_id: user.id,
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

  const activeTrades = trades.filter((t) => t.status === 'active');
  const closedTrades = trades.filter((t) => t.status === 'closed');

  return {
    trades,
    activeTrades,
    closedTrades,
    isLoading,
    error,
    createTrade,
    closeTrade,
    updateTrade,
    deleteTrade,
  };
}
