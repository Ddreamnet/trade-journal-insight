import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

let cache: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 60000; // 60 saniye

interface CryptoStock {
  symbol: string;
  last: number;
  low: number;
  high: number;
  chg: number;
  chgPct: number;
  time: string;
  logoUrl?: string;
  currency: 'USD';
  name: string;
}

// ─── Binance: BTC & ETH ──────────────────────────────────────────────────────
async function fetchBinancePrices(): Promise<CryptoStock[]> {
  const url = 'https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT"]';
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);

  const data = await response.json();
  const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  const meta: Record<string, { name: string; logoUrl: string }> = {
    BTCUSDT: {
      name: 'Bitcoin',
      logoUrl: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
    },
    ETHUSDT: {
      name: 'Ethereum',
      logoUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    },
  };

  return (data as any[]).map((item) => ({
    symbol: item.symbol as string,
    last: parseFloat(item.lastPrice),
    low: parseFloat(item.lowPrice),
    high: parseFloat(item.highPrice),
    chg: parseFloat(item.priceChange),
    chgPct: parseFloat(item.priceChangePercent),
    time: now,
    logoUrl: meta[item.symbol]?.logoUrl,
    currency: 'USD' as const,
    name: meta[item.symbol]?.name ?? item.symbol,
  }));
}

// ─── Yahoo Finance: XAU & XAG ────────────────────────────────────────────────
async function fetchYahooMetal(
  yahooSymbol: string,
  displaySymbol: string,
  name: string
): Promise<CryptoStock | null> {
  const encoded = encodeURIComponent(yahooSymbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=5d&interval=1d`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo HTTP ${response.status} for ${yahooSymbol}`);
  }

  const data = await response.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No Yahoo data for ${yahooSymbol}`);

  const m = result.meta;
  const last: number = m.regularMarketPrice ?? 0;
  const prevClose: number = m.previousClose ?? m.chartPreviousClose ?? 0;
  const chg = last - prevClose;
  const chgPct = prevClose > 0 ? (chg / prevClose) * 100 : 0;

  // Son günün high/low (son veri noktası)
  const quotes = result.indicators?.quote?.[0];
  const highs: (number | null)[] = quotes?.high ?? [];
  const lows: (number | null)[] = quotes?.low ?? [];
  const lastHigh = [...highs].reverse().find((v) => v != null && !isNaN(v)) ?? last;
  const lastLow = [...lows].reverse().find((v) => v != null && !isNaN(v)) ?? last;

  const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  return {
    symbol: displaySymbol,
    last,
    low: lastLow,
    high: lastHigh,
    chg,
    chgPct,
    time: now,
    currency: 'USD' as const,
    name,
  };
}

async function fetchMetalPrices(): Promise<CryptoStock[]> {
  const metals = [
    { yahoo: 'XAUUSD=X', symbol: 'XAUUSD', name: 'Altın (oz/USD)' },
    { yahoo: 'XAGUSD=X', symbol: 'XAGUSD', name: 'Gümüş (oz/USD)' },
  ];

  const results = await Promise.allSettled(
    metals.map((m) => fetchYahooMetal(m.yahoo, m.symbol, m.name))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<CryptoStock> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);
}

// ─── Handler ─────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Önbellekten dön
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return new Response(JSON.stringify(cache.data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const [cryptoResult, metalResult] = await Promise.allSettled([
      fetchBinancePrices(),
      fetchMetalPrices(),
    ]);

    const items: CryptoStock[] = [
      ...(cryptoResult.status === 'fulfilled' ? cryptoResult.value : []),
      ...(metalResult.status === 'fulfilled' ? metalResult.value : []),
    ];

    if (cryptoResult.status === 'rejected') {
      console.error('[crypto-prices] Binance error:', cryptoResult.reason);
    }
    if (metalResult.status === 'rejected') {
      console.error('[crypto-prices] Metal error:', metalResult.reason);
    }

    if (items.length === 0) {
      throw new Error('Tüm veri kaynakları başarısız oldu');
    }

    const result = {
      updatedAt: new Date().toISOString(),
      source: 'Binance + Yahoo Finance',
      items,
    };

    cache = { data: result, timestamp: Date.now() };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[crypto-prices] Error:', error);

    if (cache) {
      return new Response(JSON.stringify({ ...(cache.data as object), stale: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        updatedAt: new Date().toISOString(),
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
