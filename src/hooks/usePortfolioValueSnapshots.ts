import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { format, subMonths, subYears, addDays, parseISO } from 'date-fns';

export type SnapshotRange = '1M' | '3M' | '6M' | '1Y' | '3Y';

export interface PortfolioValueSnapshot {
  snapshot_date: string;
  portfolio_id: string;
  value_usd: number;
  value_try: number | null;
}

function getRangeStart(range: SnapshotRange): Date {
  const now = new Date();
  switch (range) {
    case '1M': return subMonths(now, 1);
    case '3M': return subMonths(now, 3);
    case '6M': return subMonths(now, 6);
    case '1Y': return subYears(now, 1);
    case '3Y': return subYears(now, 3);
  }
}

/**
 * Aynı güne denk gelen birden fazla portföy snapshot'ını tek bir toplam
 * değere indirger. Birden fazla portföy seçildiğinde her gün için USD/TRY
 * toplamları eklenir.
 */
function aggregatePerDay(rows: PortfolioValueSnapshot[]): Array<Omit<PortfolioValueSnapshot, 'portfolio_id'>> {
  const map = new Map<string, { value_usd: number; value_try: number | null }>();
  for (const r of rows) {
    const existing = map.get(r.snapshot_date);
    if (existing) {
      existing.value_usd += r.value_usd;
      if (r.value_try != null) {
        existing.value_try = (existing.value_try ?? 0) + r.value_try;
      }
    } else {
      map.set(r.snapshot_date, { value_usd: r.value_usd, value_try: r.value_try });
    }
  }
  return Array.from(map.entries())
    .map(([snapshot_date, v]) => ({ snapshot_date, value_usd: v.value_usd, value_try: v.value_try }))
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
}

function fillGaps(
  raw: Array<Omit<PortfolioValueSnapshot, 'portfolio_id'>>,
  rangeStart: string
): Array<Omit<PortfolioValueSnapshot, 'portfolio_id'>> {
  if (raw.length === 0) return [];

  const today = format(new Date(), 'yyyy-MM-dd');
  const map = new Map(raw.map(s => [s.snapshot_date, s]));
  const firstDate = raw[0].snapshot_date > rangeStart ? raw[0].snapshot_date : rangeStart;

  const filled: Array<Omit<PortfolioValueSnapshot, 'portfolio_id'>> = [];
  let current = parseISO(firstDate);
  const end = parseISO(today);
  let last: Omit<PortfolioValueSnapshot, 'portfolio_id'> | null = null;

  while (current <= end) {
    const dateStr = format(current, 'yyyy-MM-dd');
    if (map.has(dateStr)) {
      last = map.get(dateStr)!;
      filled.push(last);
    } else if (last) {
      filled.push({ ...last, snapshot_date: dateStr });
    }
    current = addDays(current, 1);
  }

  return filled;
}

/**
 * usePortfolioValueSnapshots
 * portfolioIds: hangi portföylerin snapshot'larını birleştirip göstereceğimizi belirler.
 *  - undefined → tüm kullanıcı (tümü)
 *  - []        → hiç veri
 *  - [id...]   → ilgili portföyler
 */
export function usePortfolioValueSnapshots(range: SnapshotRange, portfolioIds?: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const rangeStart = format(getRangeStart(range), 'yyyy-MM-dd');
  const portfolioKey = portfolioIds ? portfolioIds.slice().sort().join(',') : 'all';

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ['portfolio_value_snapshots', user?.id, range, portfolioKey],
    queryFn: async () => {
      if (!user) return [];
      if (portfolioIds && portfolioIds.length === 0) return [];

      let query = supabase
        .from('portfolio_value_snapshots')
        .select('snapshot_date, portfolio_id, value_usd, value_try')
        .eq('user_id', user.id)
        .gte('snapshot_date', rangeStart)
        .order('snapshot_date', { ascending: true });

      if (portfolioIds && portfolioIds.length > 0) {
        query = query.in('portfolio_id', portfolioIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as PortfolioValueSnapshot[];
      const aggregated = aggregatePerDay(rows);
      return fillGaps(aggregated, rangeStart);
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const saveSnapshot = useMutation({
    mutationFn: async ({
      portfolioId,
      valueUsd,
      valueTry,
    }: { portfolioId: string; valueUsd: number; valueTry?: number }) => {
      if (!user) return;
      const today = format(new Date(), 'yyyy-MM-dd');
      const { error } = await supabase
        .from('portfolio_value_snapshots')
        .upsert(
          {
            user_id: user.id,
            portfolio_id: portfolioId,
            snapshot_date: today,
            value_usd: valueUsd,
            value_try: valueTry ?? null,
          },
          { onConflict: 'portfolio_id,snapshot_date' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio_value_snapshots', user?.id] });
    },
  });

  return { snapshots, isLoading, saveSnapshot };
}
