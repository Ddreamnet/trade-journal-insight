import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory cache: symbol -> { data, timestamp }
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

interface PricePoint {
  date: string;
  value: number;
}

async function fetchYahooFinance(symbol: string): Promise<PricePoint[]> {
  const yahooSymbol = `${symbol}.IS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=3y&interval=1d`;
  console.log(`Fetching Yahoo Finance for ${symbol}: ${url}`);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    console.error(`Yahoo Finance failed for ${symbol}: ${response.status}`);
    return [];
  }

  const json = await response.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    console.error(`No chart result for ${symbol}`);
    return [];
  }

  const timestamps: number[] = result.timestamp || [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];

  const points: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close === null || close === undefined || isNaN(close)) continue;

    const date = new Date(timestamps[i] * 1000);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    points.push({ date: dateStr, value: close });
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const symbolsParam = url.searchParams.get("symbols");

    if (!symbolsParam) {
      return new Response(
        JSON.stringify({ error: "Missing 'symbols' parameter. Example: ?symbols=AKSEN,EUPWR" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const symbols = symbolsParam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);

    if (symbols.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid symbols provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit to 20 symbols max
    const limitedSymbols = symbols.slice(0, 20);
    const now = Date.now();
    const responseData: Record<string, { points: PricePoint[]; source: string }> = {};

    // Fetch all symbols in parallel, using cache where available
    const fetchPromises = limitedSymbols.map(async (symbol) => {
      const cached = cache.get(symbol);
      if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
        console.log(`Serving ${symbol} from cache`);
        responseData[symbol] = cached.data as { points: PricePoint[]; source: string };
        return;
      }

      try {
        const points = await fetchYahooFinance(symbol);
        const data = { points, source: "Yahoo Finance" };
        cache.set(symbol, { data, timestamp: now });
        responseData[symbol] = data;
        console.log(`Fetched ${symbol}: ${points.length} points`);
      } catch (error) {
        console.error(`Error fetching ${symbol}:`, error);
        // Return cached stale data if available
        if (cached) {
          responseData[symbol] = cached.data as { points: PricePoint[]; source: string };
        } else {
          responseData[symbol] = { points: [], source: "error" };
        }
      }
    });

    await Promise.all(fetchPromises);

    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("stock-series error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
