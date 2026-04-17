import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchUsdTryRate(): Promise<number | null> {
  // Yahoo Finance v8 — same source as market-series function
  try {
    const url = 'https://query2.finance.yahoo.com/v8/finance/chart/USDTRY=X?range=5d&interval=1d';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const data = await res.json();
    const closes: number[] = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const valid = closes.filter((v) => v != null && !isNaN(v));
    return valid.length > 0 ? valid[valid.length - 1] : null;
  } catch (e) {
    console.warn('[snapshot] USD/TRY fetch failed:', e);
  }
  // Stooq fallback
  try {
    const res = await fetch('https://stooq.com/q/d/l/?s=usdtry&i=d', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) throw new Error(`Stooq HTTP ${res.status}`);
    const csv = await res.text();
    const lines = csv.trim().split('\n').slice(1);
    if (lines.length === 0) throw new Error('Stooq empty');
    const last = lines[lines.length - 1].split(',');
    const rate = parseFloat(last[4]);
    if (!isNaN(rate) && rate > 0) return rate;
  } catch (e) {
    console.warn('[snapshot] Stooq fallback failed:', e);
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const today = new Date().toISOString().split('T')[0];

    // 1. USD/TRY
    const usdTryRate = await fetchUsdTryRate();
    console.log(`[snapshot] USD/TRY rate: ${usdTryRate}, date: ${today}`);

    // 2. Tüm portföyler — hem aktif hem kapalı (closed portföyler de hala değerli olabilir)
    const { data: portfolios, error: pErr } = await supabase
      .from('portfolios')
      .select('id, user_id, status');
    if (pErr) throw pErr;

    if (!portfolios || portfolios.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[snapshot] Processing ${portfolios.length} portfolios`);
    let saved = 0;

    for (const portfolio of portfolios) {
      try {
        // 3a. user_assets toplamı
        const { data: assets } = await supabase
          .from('user_assets')
          .select('amount_usd')
          .eq('portfolio_id', portfolio.id);
        const assetsUsd = (assets ?? []).reduce(
          (s: number, a: any) => s + (a.amount_usd ?? 0),
          0,
        );

        // 3b. Net TL nakit
        const { data: flows } = await supabase
          .from('portfolio_cash_flows')
          .select('flow_type, amount')
          .eq('portfolio_id', portfolio.id);
        const cashTry = (flows ?? []).reduce(
          (s: number, f: any) => s + (f.flow_type === 'deposit' ? f.amount : -f.amount),
          0,
        );

        // 3c. Açık pozisyonlar (entry_price yaklaşımı; canlı fiyat client-side overwrite eder)
        const { data: trades } = await supabase
          .from('trades')
          .select('stock_symbol, remaining_lot, entry_price, trade_currency')
          .eq('portfolio_id', portfolio.id)
          .eq('status', 'active');

        // Aktif trade'lere bağlı kasa bloklamasını da pozisyon tarafına alıyoruz:
        // toplam değerde her iki kalem de yer aldığı için cash hesabını brüt akıştan
        // (deposits-withdrawals) yapıyoruz; aktif blokajları çıkarmıyoruz çünkü aynı
        // miktar pozisyon değeri olarak ekleniyor.

        let positionsUsd = 0;
        for (const t of trades ?? []) {
          const lots = t.remaining_lot ?? 0;
          if (lots <= 0) continue;
          const price = t.entry_price ?? 0;
          const isTry = !t.trade_currency || t.trade_currency === 'TRY';
          const valueTry = lots * price;
          if (isTry) {
            positionsUsd += usdTryRate && usdTryRate > 0 ? valueTry / usdTryRate : 0;
          } else {
            positionsUsd += valueTry; // already USD
          }
        }

        // Realized PnL — partial closes (TL)
        const { data: pcs } = await supabase
          .from('trade_partial_closes')
          .select('realized_pnl')
          .eq('portfolio_id', portfolio.id);
        const realizedTry = (pcs ?? []).reduce(
          (s: number, p: any) => s + (p.realized_pnl ?? 0),
          0,
        );

        // Cash defteri kalanı = depozitolar - çekimler + realized PnL - aktif blokaj
        // Aktif blokajı zaten positionsUsd'e taşıdık; bu yüzden "available cash"
        // hesaplaması: net deposits + realized PnL - active blocks
        // Snapshot toplamı = available cash + active position value + diğer varlıklar
        const activeBlockTry = (trades ?? []).reduce((s: number, t: any) => {
          const lots = t.remaining_lot ?? 0;
          if (lots <= 0) return s;
          return s + lots * (t.entry_price ?? 0);
        }, 0);

        const availableCashTry = cashTry + realizedTry - activeBlockTry;
        const cashUsd =
          usdTryRate && usdTryRate > 0 ? availableCashTry / usdTryRate : 0;

        const totalUsd = assetsUsd + cashUsd + positionsUsd;
        const totalTry = usdTryRate ? totalUsd * usdTryRate : null;

        if (totalUsd <= 0 && assetsUsd === 0) continue;

        // 4. Upsert — portfolio_id,snapshot_date unique
        const { error: upsertErr } = await supabase
          .from('portfolio_value_snapshots')
          .upsert(
            {
              user_id: portfolio.user_id,
              portfolio_id: portfolio.id,
              snapshot_date: today,
              value_usd: totalUsd,
              value_try: totalTry,
            },
            { onConflict: 'portfolio_id,snapshot_date', ignoreDuplicates: true },
          );

        if (upsertErr) {
          console.warn(
            `[snapshot] upsert error for portfolio ${portfolio.id}:`,
            upsertErr.message,
          );
        } else {
          saved++;
        }
      } catch (pErr) {
        console.warn(`[snapshot] error for portfolio ${portfolio.id}:`, pErr);
      }
    }

    console.log(`[snapshot] Done — saved ${saved}/${portfolios.length}`);
    return new Response(
      JSON.stringify({ ok: true, processed: portfolios.length, saved, date: today }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[snapshot] Fatal error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
