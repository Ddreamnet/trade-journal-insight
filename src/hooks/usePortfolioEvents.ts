import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PortfolioEvent, PortfolioSnapshot, PortfolioState } from '@/types/portfolio';
import { toast } from 'sonner';

export function usePortfolioEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<PortfolioEvent[]>([]);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch portfolio events and snapshots
  const fetchPortfolioData = useCallback(async () => {
    if (!user) {
      setEvents([]);
      setSnapshots([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from('portfolio_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (eventsError) throw eventsError;

      // Fetch snapshots
      const { data: snapshotsData, error: snapshotsError } = await supabase
        .from('portfolio_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (snapshotsError) throw snapshotsError;

      setEvents((eventsData || []) as PortfolioEvent[]);
      setSnapshots((snapshotsData || []) as PortfolioSnapshot[]);
    } catch (err) {
      console.error('Error fetching portfolio data:', err);
      setError('Portföy verileri yüklenirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPortfolioData();
  }, [fetchPortfolioData]);

  // Add deposit event
  const addDeposit = useCallback(async (amount: number, note?: string) => {
    if (!user) {
      toast.error('Giriş yapmalısınız');
      return false;
    }

    if (amount <= 0) {
      toast.error('Tutar 0\'dan büyük olmalı');
      return false;
    }

    try {
      const { error } = await supabase
        .from('portfolio_events')
        .insert({
          user_id: user.id,
          event_type: 'deposit',
          amount_tl: amount,
          note: note || null,
        });

      if (error) throw error;

      toast.success(`₺${amount.toLocaleString('tr-TR')} eklendi`);
      await fetchPortfolioData();
      return true;
    } catch (err) {
      console.error('Error adding deposit:', err);
      toast.error('Nakit ekleme başarısız');
      return false;
    }
  }, [user, fetchPortfolioData]);

  // Add withdraw event
  const addWithdraw = useCallback(async (amount: number, note?: string) => {
    if (!user) {
      toast.error('Giriş yapmalısınız');
      return false;
    }

    if (amount <= 0) {
      toast.error('Tutar 0\'dan büyük olmalı');
      return false;
    }

    // Check if there's enough balance
    const latestSnapshot = snapshots[snapshots.length - 1];
    if (!latestSnapshot) {
      toast.error('Henüz portföy bakiyeniz yok');
      return false;
    }

    const maxWithdraw = latestSnapshot.portfolio_value;
    if (amount > maxWithdraw) {
      toast.error(`Maksimum çekilebilecek tutar: ₺${maxWithdraw.toLocaleString('tr-TR')}`);
      return false;
    }

    try {
      const { error } = await supabase
        .from('portfolio_events')
        .insert({
          user_id: user.id,
          event_type: 'withdraw',
          amount_tl: amount,
          note: note || null,
        });

      if (error) throw error;

      toast.success(`₺${amount.toLocaleString('tr-TR')} çekildi`);
      await fetchPortfolioData();
      return true;
    } catch (err: unknown) {
      console.error('Error adding withdraw:', err);
      const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen hata';
      if (errorMessage.includes('Insufficient shares')) {
        toast.error('Yetersiz bakiye');
      } else {
        toast.error('Nakit çekme başarısız');
      }
      return false;
    }
  }, [user, snapshots, fetchPortfolioData]);

  // Get current portfolio state
  const getPortfolioState = useCallback((): PortfolioState | null => {
    if (snapshots.length === 0) return null;

    const latest = snapshots[snapshots.length - 1];
    return {
      sharesTotal: Number(latest.shares_total),
      unitPrice: Number(latest.unit_price),
      portfolioValue: Number(latest.portfolio_value),
      latestDate: latest.snapshot_date,
    };
  }, [snapshots]);

  // Check if user has portfolio
  const hasPortfolio = snapshots.length > 0;

  return {
    events,
    snapshots,
    isLoading,
    error,
    addDeposit,
    addWithdraw,
    getPortfolioState,
    hasPortfolio,
    refetch: fetchPortfolioData,
  };
}
