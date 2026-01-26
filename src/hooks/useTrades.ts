import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface TradeInsert {
  stock_symbol: string;
  stock_name: string;
  trade_type: 'buy' | 'sell';
  entry_price: number;
  target_price: number;
  stop_price: number;
  reasons: string[];
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

      const { data, error } = await supabase
        .from('trades')
        .insert({
          ...trade,
          user_id: user.id,
        })
        .select()
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
    mutationFn: async ({ tradeId, exitPrice, closingNote }: { tradeId: string; exitPrice: number; closingNote?: string }) => {
      const { data, error } = await supabase
        .from('trades')
        .update({
          status: 'closed' as const,
          exit_price: exitPrice,
          closing_note: closingNote || null,
        })
        .eq('id', tradeId)
        .select()
        .single();

      if (error) throw error;
      return data as TradeRow;
    },
    onSuccess: (updatedTrade) => {
      queryClient.setQueryData(['trades', user?.id], (old: TradeRow[] = []) =>
        old.map((t) => (t.id === updatedTrade.id ? updatedTrade : t))
      );
      
      const isSuccess = updatedTrade.is_successful;
      toast({
        title: isSuccess ? '✅ Başarılı işlem!' : '❌ Başarısız işlem',
        description: `İşlem %${updatedTrade.progress_percent?.toFixed(1)} ilerleme ile kapatıldı.`,
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
    deleteTrade,
  };
}
