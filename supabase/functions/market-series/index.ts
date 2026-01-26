import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Asset to Stooq symbol mapping
const ASSET_SYMBOLS: Record<string, string> = {
  gold: "xautry.pl",
  usd: "usdtry",
  eur: "eurtry",
  bist100: "xu100.pl",
  nasdaq100: "ndx.us",
};

// In-memory cache (30 minutes)
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_DURATION_MS = 30 * 60 * 1000;

interface SeriesPoint {
  date: string;
  value: number;
}

async function fetchStooqData(asset: string): Promise<SeriesPoint[]> {
  const symbol = ASSET_SYMBOLS[asset];
  if (!symbol) {
    throw new Error(`Unknown asset: ${asset}`);
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

  // Keep last 365 days
  return points.slice(-365);
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const asset = url.searchParams.get("asset");

    if (!asset || !ASSET_SYMBOLS[asset]) {
      return new Response(
        JSON.stringify({
          error: "Invalid asset. Valid: gold, usd, eur, bist100, nasdaq100",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check cache
    const cached = cache.get(asset);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
      console.log(`Serving ${asset} from cache`);
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch fresh data
    console.log(`Fetching fresh data for ${asset}`);
    const points = await fetchStooqData(asset);

    const responseData = {
      asset,
      updatedAt: new Date().toISOString(),
      points,
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
