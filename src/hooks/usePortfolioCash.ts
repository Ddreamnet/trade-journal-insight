import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { useMemo } from 'react';

interface CashFlow {
  id: string;
  user_id: string;
  flow_type: 'deposit' | 'withdraw';
  amount: number;
  note: string | null;
  created_at: string;
}

export function usePortfolioCash() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch cash flows
  const { data: cashFlows = [], isLoading: isCashLoading } = useQuery({
    queryKey: ['portfolio_cash_flows', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('portfolio_cash_flows')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CashFlow[];
    },
    enabled: !!user,
  });

  // Fetch active trades for blockage calculation
  const { data: activeTrades = [] } = useQuery({
    queryKey: ['trades_for_cash', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('trades')
        .select('entry_price, remaining_lot, position_amount, lot_quantity')
        .eq('status', 'active');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch realized PnL from partial closes
  const { data: totalRealizedPnl = 0 } = useQuery({
    queryKey: ['realized_pnl', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from('trade_partial_closes')
        .select('realized_pnl');
      if (error) throw error;
      return (data || []).reduce((sum, r) => sum + (r.realized_pnl || 0), 0);
    },
    enabled: !!user,
  });

  // Calculate available cash with legacy fallback
  const availableCash = useMemo(() => {
    const deposits = cashFlows
      .filter(f => f.flow_type === 'deposit')
      .reduce((sum, f) => sum + f.amount, 0);
    const withdrawals = cashFlows
      .filter(f => f.flow_type === 'withdraw')
      .reduce((sum, f) => sum + f.amount, 0);

    // Active trade blockage with legacy fallback
    const activeBlocks = activeTrades.reduce((sum, t) => {
      if (t.remaining_lot > 0) {
        return sum + t.entry_price * t.remaining_lot;
      } else if (t.remaining_lot === 0 && (t.position_amount || 0) > 0) {
        // Legacy fallback
        return sum + (t.position_amount || 0);
      }
      return sum;
    }, 0);

    return deposits - withdrawals - activeBlocks + totalRealizedPnl;
  }, [cashFlows, activeTrades, totalRealizedPnl]);

  // Add deposit
  const addDeposit = useMutation({
    mutationFn: async ({ amount, note }: { amount: number; note?: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('portfolio_cash_flows')
        .insert({ user_id: user.id, flow_type: 'deposit', amount, note: note || null })
        .select()
        .single();
      if (error) throw error;
      return data as CashFlow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio_cash_flows', user?.id] });
      toast({ title: 'Para eklendi', description: 'Bakiye güncellendi.' });
    },
    onError: (error) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  // Withdraw with server-side check
  const addWithdraw = useMutation({
    mutationFn: async ({ amount, note }: { amount: number; note?: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.rpc('create_withdraw_with_check', {
        p_user_id: user.id,
        p_amount: amount,
        p_note: note || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio_cash_flows', user?.id] });
      toast({ title: 'Para çekildi', description: 'Bakiye güncellendi.' });
    },
    onError: (error) => {
      toast({ title: 'Hata', description: error.message, variant: 'destructive' });
    },
  });

  return {
    cashFlows,
    availableCash,
    isCashLoading,
    addDeposit,
    addWithdraw,
  };
}
