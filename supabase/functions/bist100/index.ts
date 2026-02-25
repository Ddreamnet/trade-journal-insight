import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UPSTREAM_URL = 'https://bigpara.hurriyet.com.tr/borsa/canli-borsa/bist-tum/';

// Simple in-memory cache
let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 60000; // 60 seconds

function parseNumber(str: string): number {
  // Turkish format: 1.234,56 -> 1234.56
  const cleaned = str.trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

async function fetchBistData() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    console.log('Returning cached data');
    return cache.data;
  }

  console.log('Fetching fresh data from upstream');

  const response = await fetch(UPSTREAM_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  if (!response.ok) {
    throw new Error(`Upstream returned ${response.status}`);
  }

  const html = await response.text();
  const items: any[] = [];

  // Match each <ul class="live-stock-item ..." data-symbol="SYMBOL">...</ul>
  const stockRegex = /<ul\s+class="live-stock-item[^"]*"\s+data-symbol="([^"]+)"[^>]*>([\s\S]*?)<\/ul>/gi;
  let match;

  while ((match = stockRegex.exec(html)) !== null) {
    const symbol = match[1];
    const block = match[2];

    // Extract values by node class
    const getNode = (cls: string): string => {
      const r = new RegExp(`class="[^"]*${cls}[^"]*"[^>]*>([^<]*)`, 'i');
      const m = block.match(r);
      return m ? m[1].trim() : '';
    };

    const lastStr = getNode('node-c');
    const highStr = getNode('node-h');
    const lowStr = getNode('node-i');
    const chgPctStr = getNode('node-e');
    const chgStr = getNode('node-m');
    const timeStr = getNode('node-s');

    const last = parseNumber(lastStr);
    if (last <= 0) continue;

    const high = parseNumber(highStr);
    const low = parseNumber(lowStr);
    const chgPct = parseNumber(chgPctStr);
    // node-m has the actual TL change; fallback to calculation
    const chg = chgStr ? parseNumber(chgStr) : Math.round((last - last / (1 + chgPct / 100)) * 100) / 100;

    const time = timeStr || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    // Logo from Hangikredi CDN
    const logoUrl = `https://cdn.hangikredi.com/symbols/${symbol.toLowerCase()}.png`;

    items.push({ symbol, last, low, high, chg, chgPct, time, logoUrl });
  }

  if (items.length === 0) {
    console.log('HTML length:', html.length);
    throw new Error('Failed to parse stock data from Bigpara HTML');
  }

  const result = {
    updatedAt: new Date().toISOString(),
    source: 'bigpara',
    items,
  };

  cache = { data: result, timestamp: Date.now() };
  console.log(`Parsed ${items.length} stocks`);
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data = await fetchBistData();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);

    if (cache) {
      console.log('Returning stale cache due to error');
      return new Response(JSON.stringify({ ...cache.data, stale: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', updatedAt: new Date().toISOString() }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
