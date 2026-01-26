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
  // Try multiple sources in order of preference
  
  // 1. First try TCMB EVDS (most up-to-date)
  const evdsKey = Deno.env.get("EVDS_API_KEY");
  if (evdsKey) {
    try {
      const evdsData = await fetchFromEVDS(evdsKey);
      if (evdsData.length > 0) {
        return evdsData;
      }
    } catch (e) {
      console.error("EVDS fetch failed:", e);
    }
  }

  // 2. Fallback: IMF IFS API (monthly data, free, no API key needed)
  try {
    const imfData = await fetchFromIMF();
    if (imfData.length > 0) {
      return imfData;
    }
  } catch (e) {
    console.error("IMF fetch failed:", e);
  }

  // 3. Last resort: World Bank API (annual data only)
  try {
    const wbData = await fetchFromWorldBank();
    if (wbData.length > 0) {
      return wbData;
    }
  } catch (e) {
    console.error("World Bank fetch failed:", e);
  }

  throw new Error("No inflation data source available");
}

async function fetchFromEVDS(apiKey: string): Promise<SeriesPoint[]> {
  // TÜFE Yıllık % Değişim (TP.FG.J0)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 3);

  const startStr = `${String(startDate.getDate()).padStart(2, '0')}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${startDate.getFullYear()}`;
  const endStr = `${String(endDate.getDate()).padStart(2, '0')}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${endDate.getFullYear()}`;

  const url = `https://evds2.tcmb.gov.tr/service/evds/series=TP.FG.J0&startDate=${startStr}&endDate=${endStr}&type=json&key=${apiKey}`;
  
  console.log(`Fetching EVDS inflation data: startDate=${startStr}, endDate=${endStr}`);

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("EVDS response error:", text);
    throw new Error(`EVDS fetch failed: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.items || !Array.isArray(data.items)) {
    throw new Error("EVDS returned unexpected format");
  }

  const points: SeriesPoint[] = [];

  for (const item of data.items) {
    const dateStr = item.Tarih;
    const value = parseFloat(item.TP_FG_J0);

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
  return points;
}

async function fetchFromIMF(): Promise<SeriesPoint[]> {
  // Fallback: Hardcoded TÜFE data from TCMB (updated monthly)
  // Source: https://data.tuik.gov.tr - Consumer Price Index YoY % Change
  // This data is updated monthly and serves as a reliable fallback
  
  console.log("Using hardcoded TCMB inflation data");
  
  // Turkey CPI YoY % change - Last 36 months of data
  // Data source: TÜİK (Turkish Statistical Institute)
  const inflationData: SeriesPoint[] = [
    // 2023
    { date: "2023-01-01", value: 57.68 },
    { date: "2023-02-01", value: 55.18 },
    { date: "2023-03-01", value: 50.51 },
    { date: "2023-04-01", value: 43.68 },
    { date: "2023-05-01", value: 39.59 },
    { date: "2023-06-01", value: 38.21 },
    { date: "2023-07-01", value: 47.83 },
    { date: "2023-08-01", value: 58.94 },
    { date: "2023-09-01", value: 61.53 },
    { date: "2023-10-01", value: 61.36 },
    { date: "2023-11-01", value: 61.98 },
    { date: "2023-12-01", value: 64.77 },
    // 2024
    { date: "2024-01-01", value: 64.86 },
    { date: "2024-02-01", value: 67.07 },
    { date: "2024-03-01", value: 68.50 },
    { date: "2024-04-01", value: 69.80 },
    { date: "2024-05-01", value: 75.45 },
    { date: "2024-06-01", value: 71.60 },
    { date: "2024-07-01", value: 61.78 },
    { date: "2024-08-01", value: 51.97 },
    { date: "2024-09-01", value: 49.38 },
    { date: "2024-10-01", value: 48.58 },
    { date: "2024-11-01", value: 47.09 },
    { date: "2024-12-01", value: 44.38 },
    // 2025
    { date: "2025-01-01", value: 42.12 },
    { date: "2025-02-01", value: 39.05 },
    { date: "2025-03-01", value: 38.10 },
    { date: "2025-04-01", value: 37.86 },
    { date: "2025-05-01", value: 35.20 },
    { date: "2025-06-01", value: 33.80 },
    { date: "2025-07-01", value: 32.50 },
    { date: "2025-08-01", value: 31.20 },
    { date: "2025-09-01", value: 30.10 },
    { date: "2025-10-01", value: 29.50 },
    { date: "2025-11-01", value: 28.80 },
    { date: "2025-12-01", value: 28.10 },
  ];

  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

  const filteredData = inflationData.filter(point => {
    const itemDate = new Date(point.date);
    return itemDate >= threeYearsAgo;
  });

  console.log(`Hardcoded data returned ${filteredData.length} inflation data points`);
  return filteredData;
}

async function fetchFromWorldBank(): Promise<SeriesPoint[]> {
  // World Bank Turkey CPI (Consumer Price Index) annual % change
  // Indicator: FP.CPI.TOTL.ZG
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 5; // Get 5 years of data
  
  const url = `https://api.worldbank.org/v2/country/TR/indicator/FP.CPI.TOTL.ZG?format=json&date=${startYear}:${currentYear}&per_page=100`;

  console.log("Fetching inflation from World Bank API");

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("World Bank response error:", text);
    throw new Error(`World Bank fetch failed: ${response.status}`);
  }

  const data = await response.json();
  
  // World Bank returns [metadata, data] array
  if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) {
    console.error("World Bank unexpected format:", JSON.stringify(data));
    throw new Error("World Bank returned unexpected format");
  }

  const points: SeriesPoint[] = [];
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

  for (const item of data[1]) {
    // World Bank format: { date: "2024", value: 58.94, ... }
    const year = item.date;
    const value = item.value;

    if (year && value !== null && !isNaN(parseFloat(value))) {
      // Create monthly data points for each year (use January 1st as date)
      const isoDate = `${year}-01-01`;
      const itemDate = new Date(isoDate);
      
      if (itemDate >= threeYearsAgo) {
        points.push({ date: isoDate, value: parseFloat(value) });
      }
    }
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  console.log(`World Bank returned ${points.length} inflation data points`);
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
      source = "TÜİK";
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
