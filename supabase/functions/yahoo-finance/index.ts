import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory cache to reduce upstream calls
const CACHE_TTL_MS = 55_000; // 55 seconds
let quoteCache: { data: unknown; timestamp: number; symbols: string } | null = null;
const chartCache = new Map<string, { data: unknown; timestamp: number }>();

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

// Convert BIST symbol to Yahoo format (add .IS suffix if not present)
function toYahooSymbol(symbol: string): string {
  const s = symbol.toUpperCase().trim();
  return s.endsWith('.IS') ? s : `${s}.IS`;
}

// Fetch quotes using Yahoo Finance v6 API (spark endpoint - more reliable)
async function fetchQuotes(symbols: string[]): Promise<unknown> {
  const yahooSymbols = symbols.map(toYahooSymbol).join(',');
  
  // Try spark endpoint first (more reliable, less restricted)
  const sparkUrl = `https://query2.finance.yahoo.com/v6/finance/spark?symbols=${yahooSymbols}&range=1d&interval=1d`;
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://finance.yahoo.com',
    'Referer': 'https://finance.yahoo.com/',
  };

  let response = await fetch(sparkUrl, { headers });
  
  // If spark works, use it
  if (response.ok) {
    const sparkData = await response.json();
    // Transform spark data to quote format
    return transformSparkToQuotes(sparkData, symbols);
  }
  
  console.log(`Spark endpoint failed with ${response.status}, trying quote endpoint...`);
  
  // Fallback to quote endpoint with different query params
  const quoteUrl = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${yahooSymbols}&fields=symbol,shortName,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,regularMarketTime`;
  
  response = await fetch(quoteUrl, { headers });
  
  if (!response.ok) {
    // Try one more alternative - options endpoint
    const optionsUrl = `https://query2.finance.yahoo.com/v7/finance/options/${symbols[0]}.IS`;
    const optResponse = await fetch(optionsUrl, { headers });
    
    if (optResponse.ok) {
      const optData = await optResponse.json();
      // We can at least get the current price from options data
      return transformOptionsToQuotes(optData, symbols);
    }
    
    throw new Error(`Yahoo Finance API error: ${response.status}`);
  }
  
  return await response.json();
}

// Transform spark response to our expected quote format
function transformSparkToQuotes(sparkData: any, requestedSymbols: string[]): any {
  const results: any[] = [];
  
  if (sparkData?.spark?.result) {
    for (const item of sparkData.spark.result) {
      if (item?.response?.[0]?.meta) {
        const meta = item.response[0].meta;
        const indicators = item.response[0]?.indicators;
        const quotes = indicators?.quote?.[0];
        
        const closes = quotes?.close?.filter((c: any) => c != null) || [];
        const lastClose = closes[closes.length - 1] || meta.regularMarketPrice || 0;
        const prevClose = meta.chartPreviousClose || meta.previousClose || lastClose;
        const change = lastClose - prevClose;
        const changePercent = prevClose ? (change / prevClose) * 100 : 0;
        
        results.push({
          symbol: meta.symbol || item.symbol,
          shortName: meta.shortName || meta.symbol?.replace('.IS', '') || 'Unknown',
          regularMarketPrice: meta.regularMarketPrice || lastClose,
          regularMarketChange: change,
          regularMarketChangePercent: changePercent,
          regularMarketVolume: meta.regularMarketVolume || 0,
          regularMarketTime: meta.regularMarketTime || Math.floor(Date.now() / 1000),
        });
      }
    }
  }
  
  return { quoteResponse: { result: results } };
}

// Transform options response to quote format (fallback)
function transformOptionsToQuotes(optData: any, requestedSymbols: string[]): any {
  const results: any[] = [];
  
  if (optData?.optionChain?.result?.[0]?.quote) {
    const quote = optData.optionChain.result[0].quote;
    results.push({
      symbol: quote.symbol,
      shortName: quote.shortName || quote.symbol?.replace('.IS', ''),
      regularMarketPrice: quote.regularMarketPrice,
      regularMarketChange: quote.regularMarketChange,
      regularMarketChangePercent: quote.regularMarketChangePercent,
      regularMarketVolume: quote.regularMarketVolume,
      regularMarketTime: quote.regularMarketTime,
    });
  }
  
  return { quoteResponse: { result: results } };
}

// Fetch chart data from Yahoo Finance
async function fetchChart(symbol: string, range: string): Promise<unknown> {
  const yahooSymbol = toYahooSymbol(symbol);
  const interval = range === '1d' ? '5m' : '1d';
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://finance.yahoo.com',
    'Referer': 'https://finance.yahoo.com/',
  };
  
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=${range}&interval=${interval}`;
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`Yahoo Finance Chart API error: ${response.status}`);
  }
  
  return await response.json();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'quote';
    const now = Date.now();

    if (type === 'quote') {
      const symbolsParam = url.searchParams.get('symbols') || '';
      const symbols = symbolsParam.split(',').filter(s => s.trim());
      
      if (symbols.length === 0) {
        return jsonResponse({ error: 'No symbols provided' }, { status: 400 });
      }

      // Check cache
      const cacheKey = symbols.sort().join(',');
      if (quoteCache && quoteCache.symbols === cacheKey && now - quoteCache.timestamp < CACHE_TTL_MS) {
        console.log('Returning cached quote data');
        return jsonResponse(quoteCache.data, {
          headers: { 'X-Cache': 'HIT' },
        });
      }

      // Fetch fresh data
      const data = await fetchQuotes(symbols);
      
      // Update cache
      quoteCache = { data, timestamp: now, symbols: cacheKey };
      
      console.log(`Fetched quotes for ${symbols.length} symbols`);
      return jsonResponse(data, {
        headers: { 'X-Cache': 'MISS' },
      });

    } else if (type === 'chart') {
      const symbol = url.searchParams.get('symbol') || '';
      const range = url.searchParams.get('range') || '1mo';
      
      if (!symbol) {
        return jsonResponse({ error: 'No symbol provided' }, { status: 400 });
      }

      // Check cache
      const cacheKey = `${symbol}-${range}`;
      const cached = chartCache.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        console.log(`Returning cached chart data for ${symbol}`);
        return jsonResponse(cached.data, {
          headers: { 'X-Cache': 'HIT' },
        });
      }

      // Fetch fresh data
      const data = await fetchChart(symbol, range);
      
      // Update cache
      chartCache.set(cacheKey, { data, timestamp: now });
      
      // Limit chart cache size
      if (chartCache.size > 50) {
        const firstKey = chartCache.keys().next().value;
        if (firstKey) chartCache.delete(firstKey);
      }
      
      console.log(`Fetched chart for ${symbol} (${range})`);
      return jsonResponse(data, {
        headers: { 'X-Cache': 'MISS' },
      });

    } else {
      return jsonResponse({ error: 'Invalid type. Use "quote" or "chart"' }, { status: 400 });
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Yahoo Finance proxy error:', errorMessage);

    // Return cached data on error if available
    if (quoteCache) {
      console.log('Returning stale cache due to error');
      return jsonResponse(quoteCache.data, {
        headers: { 
          'X-Cache': 'STALE',
          'X-Error': errorMessage,
        },
      });
    }

    return jsonResponse({ error: errorMessage }, { status: 500 });
  }
});
