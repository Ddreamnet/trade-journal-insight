import { MarketSeriesPoint } from '@/types/market';
import { parseISO, differenceInCalendarDays, getDaysInMonth } from 'date-fns';

export interface InflationImpact {
  daysHeld: number;
  monthlyRatePct: number;
  dailyRatePct: number;
  cumulativePct: number;
  source: string;
  referenceMonth: string;
}

/**
 * Trade'in açılıp kapandığı gün sayısı kadar enflasyonu hesaplar.
 * Kullanıcının istediği basit model:
 *  - Son yayımlanan aylık enflasyon alınır
 *  - O ayın gün sayısına bölünerek "günlük enflasyon" türetilir
 *  - Trade'in gün sayısı ile çarpılır
 *
 * @param openedAt Trade'in açılış ISO tarihi
 * @param closedAt Trade'in kapanış ISO tarihi (aktif trade için bugünün tarihi verilebilir)
 * @param inflationSeries inflation_tr serisinin points dizisi (sorted ascending by date)
 */
export function calculateInflationImpact(
  openedAt: string,
  closedAt: string,
  inflationSeries: MarketSeriesPoint[] | null | undefined
): InflationImpact | null {
  if (!inflationSeries || inflationSeries.length === 0) return null;

  const opened = parseISO(openedAt);
  const closed = parseISO(closedAt);
  const daysHeld = Math.max(1, differenceInCalendarDays(closed, opened));

  const latest = [...inflationSeries].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (!latest) return null;

  const refDate = parseISO(latest.date);
  const daysInRefMonth = getDaysInMonth(refDate);
  const monthlyRatePct = latest.value;
  const dailyRatePct = monthlyRatePct / daysInRefMonth;
  const cumulativePct = dailyRatePct * daysHeld;

  return {
    daysHeld,
    monthlyRatePct,
    dailyRatePct,
    cumulativePct,
    source: 'TÜİK',
    referenceMonth: latest.date,
  };
}

/**
 * Kâr yüzdesi vs enflasyon — alım gücü değişimini yüzde olarak verir.
 *   (1 + profit%) / (1 + inflation%) - 1
 * Pozitif: alım gücü arttı. Negatif: azaldı.
 */
export function calculatePurchasingPowerChange(profitPct: number, inflationPct: number): number {
  const p = profitPct / 100;
  const i = inflationPct / 100;
  return ((1 + p) / (1 + i) - 1) * 100;
}
