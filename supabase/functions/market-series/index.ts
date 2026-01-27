import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Asset to data source mapping
const STOOQ_SYMBOLS: Record<string, string> = {
  gold: "xautry",
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

async function fetchStooqData(asset: string): Promise<SeriesPoint[]> {
  const symbol = STOOQ_SYMBOLS[asset];
  if (!symbol) {
    throw new Error(`Unknown Stooq asset: ${asset}`);
  }

  const url = `https://stooq.com/q/d/l/?s=${symbol}&i=d`;
  console.log(`Fetching Stooq data for ${asset}: ${url}`);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Stooq fetch failed: ${response.status}`);
  }

  const csv = await response.text();
  const lines = csv.trim().split("\n");

  // Skip header line
  const dataLines = lines.slice(1);
  const points: SeriesPoint[] = [];

  for (const line of dataLines) {
    const parts = line.split(",");
    if (parts.length >= 5) {
      const date = parts[0]; // Date column
      const close = parseFloat(parts[4]); // Close column

      if (date && !isNaN(close)) {
        points.push({ date, value: close });
      }
    }
  }

  // Sort by date ascending
  points.sort((a, b) => a.date.localeCompare(b.date));

  // Keep last 3 years (~1095 days)
  return points.slice(-1095);
}

async function fetchInflationData(): Promise<SeriesPoint[]> {
  const apiKey = Deno.env.get("EVDS_API_KEY");
  if (!apiKey) {
    throw new Error("EVDS_API_KEY not configured");
  }

  // TÜFE CPI Index (TP.FE.OKTG01) with monthly percent change (formulas=1)
  // Get last 3 years + 1 extra month for percent change calculation
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 3);
  startDate.setMonth(startDate.getMonth() - 1); // Extra month for formulas=1

  // EVDS requires startDate to be 01 of month (dd-mm-yyyy format)
  const startStr = `01-${String(startDate.getMonth() + 1).padStart(2, '0')}-${startDate.getFullYear()}`;
  const endStr = `01-${String(endDate.getMonth() + 1).padStart(2, '0')}-${endDate.getFullYear()}`;

  // EVDS Series: TP.FE.OKTG01 = TÜFE CPI Index
  // frequency=5 = Monthly
  // formulas=1 = Percent Change (month-over-month)
  // NOTE: EVDS uses ? for first param, & for rest
  const url = `https://evds2.tcmb.gov.tr/service/evds?series=TP.FE.OKTG01&startDate=${startStr}&endDate=${endStr}&type=json&frequency=5&formulas=1`;
  
  console.log(`Fetching EVDS inflation data: ${url}`);

  // CRITICAL: API key must be sent in HTTP header, NOT in URL
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
    if (response.status === 403) {
      console.error("EVDS 403 Forbidden - API key header missing or invalid");
    }
    throw new Error(`EVDS fetch failed: ${response.status}`);
  }

  const data = await response.json();
  
  // Log the full response structure for debugging
  console.log("EVDS response keys:", Object.keys(data));
  console.log("EVDS response sample:", JSON.stringify(data).substring(0, 1000));
  
  // Check if we have items array
  if (!data.items || !Array.isArray(data.items)) {
    console.error("EVDS no items array found. Full response:", JSON.stringify(data).substring(0, 2000));
    throw new Error("EVDS returned unexpected format - no items array");
  }
  
  if (data.items.length === 0) {
    console.error("EVDS returned empty items array. This might indicate wrong series code or date range.");
    console.error("Check if API key is valid and has access to TP.FE.OKTG01 series");
    throw new Error("EVDS returned empty data");
  }
  
  console.log("EVDS items count:", data.items.length);
  console.log("EVDS first item:", JSON.stringify(data.items[0]));

  const points: SeriesPoint[] = [];

  for (const item of data.items) {
    // EVDS returns date as "DD-MM-YYYY" and value in "TP_FE_OKTG01" field (underscores for dots)
    const dateStr = item.Tarih; // "DD-MM-YYYY"
    const value = parseFloat(item.TP_FE_OKTG01);

    if (dateStr && !isNaN(value)) {
      // Convert DD-MM-YYYY to YYYY-MM-DD
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        points.push({ date: isoDate, value });
      }
    }
  }

  // Sort by date ascending
  points.sort((a, b) => a.date.localeCompare(b.date));

  console.log(`EVDS returned ${points.length} inflation data points`);
  return points;
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
          error: "Invalid asset. Valid: gold, usd, eur, bist100, nasdaq100, inflation_tr",
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
    console.log(`Fetching fresh data for ${asset}`);
    let points: SeriesPoint[];
    let source: string;

    if (asset === "inflation_tr") {
      points = await fetchInflationData();
      source = "TCMB EVDS";
    } else {
      points = await fetchStooqData(asset);
      source = "Stooq";
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
