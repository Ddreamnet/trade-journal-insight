import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';
import { useMemo } from 'react';

interface CashFlow {
  id: string;
  user_id: string;
  portfolio_id: string;
  flow_type: 'deposit' | 'withdraw';
  amount: number;
  note: string | null;
  created_at: string;
}

interface TradeCashRow {
  portfolio_id: string;
  entry_price: number;
  remaining_lot: number;
  position_amount: number | null;
  lot_quantity: number;
}

interface PartialCloseCashRow {
  portfolio_id: string;
  realized_pnl: number | null;
}

/**
 * usePortfolioCash
 *
 * Tüm cash flow, aktif trade blockage ve realized PnL kayıtlarını
 * kullanıcı bazında çeker, sonra istemci tarafında portföy filtresi uygular.
 * portfolioFilter:
 *  - undefined | null → kullanıcının tüm portföylerinin toplamı
 *  - string           → sadece o portföyün değeri
 *  - string[]         → verilen portföylerin birleşik değeri ([] → 0)
 */
export function usePortfolioCash(portfolioFilter?: string | string[] | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

  const { data: activeTrades = [] } = useQuery({
    queryKey: ['trades_for_cash', user?.id],
    queryFn: async (): Promise<TradeCashRow[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('trades')
        .select('portfolio_id, entry_price, remaining_lot, position_amount, lot_quantity')
        .eq('status', 'active');
      if (error) throw error;
      return (data ?? []) as TradeCashRow[];
    },
    enabled: !!user,
  });

  const { data: partialCloses = [] } = useQuery({
    queryKey: ['realized_pnl_rows', user?.id],
    queryFn: async (): Promise<PartialCloseCashRow[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('trade_partial_closes')
        .select('portfolio_id, realized_pnl');
      if (error) throw error;
      return (data ?? []) as PartialCloseCashRow[];
    },
    enabled: !!user,
  });

  const matchPortfolio = useMemo(() => {
    if (portfolioFilter == null) return () => true;
    if (typeof portfolioFilter === 'string') {
      return (pid: string) => pid === portfolioFilter;
    }
    if (portfolioFilter.length === 0) return () => false;
    const set = new Set(portfolioFilter);
    return (pid: string) => set.has(pid);
  }, [portfolioFilter]);

  const filteredCashFlows = useMemo(
    () => cashFlows.filter(f => matchPortfolio(f.portfolio_id)),
    [cashFlows, matchPortfolio]
  );

  const availableCash = useMemo(() => {
    const flows = cashFlows.filter(f => matchPortfolio(f.portfolio_id));
    const activeBlocksSource = activeTrades.filter(t => matchPortfolio(t.portfolio_id));
    const pnlSource = partialCloses.filter(p => matchPortfolio(p.portfolio_id));

    const deposits = flows
      .filter(f => f.flow_type === 'deposit')
      .reduce((sum, f) => sum + f.amount, 0);
    const withdrawals = flows
      .filter(f => f.flow_type === 'withdraw')
      .reduce((sum, f) => sum + f.amount, 0);

    const activeBlocks = activeBlocksSource.reduce((sum, t) => {
      if (t.remaining_lot > 0) {
        return sum + t.entry_price * t.remaining_lot;
      }
      if (t.remaining_lot === 0 && (t.position_amount || 0) > 0) {
        return sum + (t.position_amount || 0);
      }
      return sum;
    }, 0);

    const totalRealizedPnl = pnlSource.reduce((sum, r) => sum + (r.realized_pnl || 0), 0);

    return deposits - withdrawals - activeBlocks + totalRealizedPnl;
  }, [cashFlows, activeTrades, partialCloses, matchPortfolio]);

  const addDeposit = useMutation({
    mutationFn: async ({
      amount,
      note,
      portfolioId: depositPortfolioId,
    }: { amount: number; note?: string; portfolioId: string }) => {
      if (!user) throw new Error('Not authenticated');
      if (!depositPortfolioId) throw new Error('Portföy seçilmedi');
      const { data, error } = await supabase
        .from('portfolio_cash_flows')
        .insert({
          user_id: user.id,
          portfolio_id: depositPortfolioId,
          flow_type: 'deposit',
          amount,
          note: note || null,
        })
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
      toast({ title: 'Hata', description: (error as Error).message, variant: 'destructive' });
    },
  });

  const addWithdraw = useMutation({
    mutationFn: async ({
      amount,
      note,
      portfolioId: withdrawPortfolioId,
    }: { amount: number; note?: string; portfolioId: string }) => {
      if (!user) throw new Error('Not authenticated');
      if (!withdrawPortfolioId) throw new Error('Portföy seçilmedi');
      const { data, error } = await supabase.rpc('create_withdraw_with_check', {
        p_user_id: user.id,
        p_portfolio_id: withdrawPortfolioId,
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
      toast({ title: 'Hata', description: (error as Error).message, variant: 'destructive' });
    },
  });

  return {
    cashFlows: filteredCashFlows,
    allCashFlows: cashFlows,
    availableCash,
    isCashLoading,
    addDeposit,
    addWithdraw,
  };
}
