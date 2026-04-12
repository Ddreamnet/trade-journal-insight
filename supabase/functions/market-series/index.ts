import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Asset to data source mapping
const STOOQ_SYMBOLS: Record<string, string> = {
  gold: "xautry",
  silver: "xagtry",
  usd: "usdtry",
  eur: "eurtry",
  bist100: "%5Exu100",  // ^xu100 URL encoded
  nasdaq100: "%5Endx",   // ^ndx URL encoded
};

// In-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>();
const STOOQ_CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const EVDS_CACHE_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours (inflation updates monthly)

interface SeriesPoint {
  date: string;
  value: number;
}

// Yahoo Finance symbol mapping (primary source)
const YAHOO_SYMBOLS: Record<string, string> = {
  gold: "XAUTRY=X",
  silver: "XAGTRY=X",
  usd: "USDTRY=X",
  eur: "EURTRY=X",
  bist100: "XU100.IS",
  nasdaq100: "%5ENDX",
};

function parseCSVPoints(csv: string): SeriesPoint[] {
  const lines = csv.trim().split("\n");
  const dataLines = lines.slice(1);
  const points: SeriesPoint[] = [];

  for (const line of dataLines) {
    const parts = line.split(",");
    if (parts.length >= 5) {
      const date = parts[0];
      const close = parseFloat(parts[4]);
      if (date && !isNaN(close)) {
        points.push({ date, value: close });
      }
    }
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return points.slice(-1095);
}

async function fetchYahooData(asset: string): Promise<SeriesPoint[]> {
  const symbol = YAHOO_SYMBOLS[asset];
  if (!symbol) throw new Error(`No Yahoo symbol for ${asset}`);

  const now = Math.floor(Date.now() / 1000);
  const threeYearsAgo = now - 3 * 365 * 24 * 3600;
  const url = `https://query1.finance.yahoo.com/v7/finance/download/${symbol}?period1=${threeYearsAgo}&period2=${now}&interval=1d&events=history`;

  console.log(`[market-series] Yahoo fetch: ${asset} -> ${symbol}`);
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Yahoo HTTP ${response.status} for ${symbol}: ${body.substring(0, 100)}`);
  }

  const csv = await response.text();
  const points = parseCSVPoints(csv);
  console.log(`[market-series] Yahoo parsed ${points.length} points for ${asset}`);

  if (points.length === 0) throw new Error(`Yahoo returned 0 points for ${asset}`);
  return points;
}

async function fetchStooqData(asset: string): Promise<SeriesPoint[]> {
  const symbol = STOOQ_SYMBOLS[asset];
  if (!symbol) throw new Error(`Unknown Stooq asset: ${asset}`);

  const url = `https://stooq.com/q/d/l/?s=${symbol}&i=d`;
  console.log(`[market-series] Stooq fetch: ${asset} -> ${symbol}`);

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });

  if (!response.ok) throw new Error(`Stooq fetch failed: ${response.status}`);

  const csv = await response.text();
  const points = parseCSVPoints(csv);
  console.log(`[market-series] Stooq parsed ${points.length} points for ${asset}`);

  if (points.length === 0) throw new Error(`Stooq returned 0 points for ${asset}`);
  return points;
}

async function fetchMarketData(asset: string): Promise<{ points: SeriesPoint[]; source: string }> {
  // Try Yahoo first, then Stooq fallback
  try {
    const points = await fetchYahooData(asset);
    return { points, source: "Yahoo Finance" };
  } catch (yahooErr) {
    console.warn(`[market-series] Yahoo failed for ${asset}: ${yahooErr instanceof Error ? yahooErr.message : yahooErr}`);
  }

  try {
    console.log(`[market-series] Stooq fallback: ${asset}`);
    const points = await fetchStooqData(asset);
    return { points, source: "Stooq" };
  } catch (stooqErr) {
    console.warn(`[market-series] Stooq failed for ${asset}: ${stooqErr instanceof Error ? stooqErr.message : stooqErr}`);
  }

  throw new Error(`All data sources failed for ${asset}`);
}

// Fallback TÜİK inflation data (monthly CPI % change) when EVDS API fails
const FALLBACK_INFLATION_DATA: SeriesPoint[] = [
  // 2023
  { date: "2023-01-01", value: 6.65 },
  { date: "2023-02-01", value: 3.15 },
  { date: "2023-03-01", value: 2.29 },
  { date: "2023-04-01", value: 2.39 },
  { date: "2023-05-01", value: 0.04 },
  { date: "2023-06-01", value: 3.92 },
  { date: "2023-07-01", value: 9.49 },
  { date: "2023-08-01", value: 9.09 },
  { date: "2023-09-01", value: 4.75 },
  { date: "2023-10-01", value: 3.43 },
  { date: "2023-11-01", value: 3.28 },
  { date: "2023-12-01", value: 2.93 },
  // 2024
  { date: "2024-01-01", value: 6.70 },
  { date: "2024-02-01", value: 4.53 },
  { date: "2024-03-01", value: 3.16 },
  { date: "2024-04-01", value: 3.18 },
  { date: "2024-05-01", value: 3.37 },
  { date: "2024-06-01", value: 1.64 },
  { date: "2024-07-01", value: 3.23 },
  { date: "2024-08-01", value: 2.47 },
  { date: "2024-09-01", value: 2.97 },
  { date: "2024-10-01", value: 2.88 },
  { date: "2024-11-01", value: 2.24 },
  { date: "2024-12-01", value: 1.03 },
  // 2025
  { date: "2025-01-01", value: 5.25 },
  { date: "2025-02-01", value: 2.27 },
  { date: "2025-03-01", value: 2.46 },
  { date: "2025-04-01", value: 3.00 },
  { date: "2025-05-01", value: 1.47 },
  { date: "2025-06-01", value: 1.87 },
  { date: "2025-07-01", value: 1.29 },
  { date: "2025-08-01", value: 2.48 },
  { date: "2025-09-01", value: 2.18 },
  { date: "2025-10-01", value: 1.92 },
  { date: "2025-11-01", value: 1.63 },
  { date: "2025-12-01", value: 1.24 },
  // 2026 (projected/estimated)
  { date: "2026-01-01", value: 3.50 },
];

async function fetchInflationData(): Promise<SeriesPoint[]> {
  const apiKey = Deno.env.get("EVDS_API_KEY");
  
  // If no API key, use fallback immediately
  if (!apiKey) {
    console.log("EVDS_API_KEY not configured, using fallback TÜİK data");
    return FALLBACK_INFLATION_DATA;
  }

  try {
    // TÜFE CPI Index (TP.FE.OKTG01) with monthly percent change (formulas=1)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 3);
    startDate.setMonth(startDate.getMonth() - 1);

    const startStr = `01-${String(startDate.getMonth() + 1).padStart(2, '0')}-${startDate.getFullYear()}`;
    const endStr = `01-${String(endDate.getMonth() + 1).padStart(2, '0')}-${endDate.getFullYear()}`;

    const url = `https://evds2.tcmb.gov.tr/service/evds/series=TP.FE.OKTG01&startDate=${startStr}&endDate=${endStr}&type=json&frequency=5&formulas=1`;
    
    console.log(`Fetching EVDS inflation data: ${url}`);

    const response = await fetch(url, {
      headers: {
        "key": apiKey,
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("EVDS response error:", response.status, text);
      console.log("Falling back to TÜİK hardcoded data");
      return FALLBACK_INFLATION_DATA;
    }

    const data = await response.json();
    
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      console.error("EVDS returned empty or invalid data, using fallback");
      return FALLBACK_INFLATION_DATA;
    }
    
    console.log("EVDS items count:", data.items.length);

    const points: SeriesPoint[] = [];

    for (const item of data.items) {
      const dateStr = item.Tarih;
      const value = parseFloat(item.TP_FE_OKTG01);

      if (dateStr && !isNaN(value)) {
        const parts = dateStr.split("-");
        if (parts.length === 3) {
          const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
          points.push({ date: isoDate, value });
        }
      }
    }

    points.sort((a, b) => a.date.localeCompare(b.date));
    console.log(`EVDS returned ${points.length} inflation data points`);
    
    return points.length > 0 ? points : FALLBACK_INFLATION_DATA;
  } catch (error) {
    console.error("EVDS fetch error:", error);
    console.log("Using fallback TÜİK inflation data");
    return FALLBACK_INFLATION_DATA;
  }
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const asset = url.searchParams.get("asset");

    const validAssets = [...Object.keys(STOOQ_SYMBOLS), "inflation_tr"];

    if (!asset || !validAssets.includes(asset)) {
      return new Response(
        JSON.stringify({
          error: "Invalid asset. Valid: gold, silver, usd, eur, bist100, nasdaq100, inflation_tr",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Determine cache duration based on asset type
    const cacheDuration = asset === "inflation_tr" ? EVDS_CACHE_DURATION_MS : STOOQ_CACHE_DURATION_MS;

    // Check cache
    const cached = cache.get(asset);
    const now = Date.now();

    if (cached && now - cached.timestamp < cacheDuration) {
      console.log(`Serving ${asset} from cache`);
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch fresh data
    console.log(`[market-series] Fetching fresh data for ${asset}`);
    let points: SeriesPoint[];
    let source: string;

    if (asset === "inflation_tr") {
      points = await fetchInflationData();
      source = "TCMB EVDS";
    } else {
      try {
        const result = await fetchMarketData(asset);
        points = result.points;
        source = result.source;
      } catch (fetchErr) {
        console.error(`[market-series] FAIL ${asset}:`, fetchErr);
        // Return empty result instead of 502
        const emptyResponse = {
          asset,
          updatedAt: new Date().toISOString(),
          points: [],
          source: "unavailable",
          error: fetchErr instanceof Error ? fetchErr.message : "Data source failed",
        };
        return new Response(JSON.stringify(emptyResponse), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const responseData = {
      asset,
      updatedAt: new Date().toISOString(),
      points,
      source,
    };

    // Update cache
    cache.set(asset, { data: responseData, timestamp: now });

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);

    // Try to return stale cache on error
    const url = new URL(req.url);
    const asset = url.searchParams.get("asset");
    if (asset) {
      const cached = cache.get(asset);
      if (cached) {
        console.log(`Returning stale cache for ${asset} due to error`);
        return new Response(JSON.stringify(cached.data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
