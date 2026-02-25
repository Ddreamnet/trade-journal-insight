import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UPSTREAM_URL = 'https://bigpara.hurriyet.com.tr/borsa/endeksler/';
const TARGET_SYMBOLS = ['XU100', 'XU030'];

let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 60000;

function parseNumber(str: string): number {
  // Turkish format: 13.810 -> 13810, -1,71 -> -1.71
  const cleaned = str.replace(/[^\d,.\-]/g, '');
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
}

async function fetchIndices() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    console.log('Returning cached indices');
    return cache.data;
  }

  console.log('Fetching indices from bigpara');

  const response = await fetch(UPSTREAM_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  if (!response.ok) {
    throw new Error(`Upstream returned ${response.status}`);
  }

  const html = await response.text();
  const indices: Record<string, { last: number; chgPct: number }> = {};

  // Parse each <ul> row containing index data
  // Structure: <ul><li class="cell005 tal arrow"><a>SYMBOL</a>...</li><li>last</li><li>prevClose</li><li>chgPct</li>...</ul>
  const ulRegex = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  let ulMatch;

  while ((ulMatch = ulRegex.exec(html)) !== null) {
    const ulContent = ulMatch[1];
    const liMatches = ulContent.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);

    if (!liMatches || liMatches.length < 4) continue;

    // Extract symbol from first <li> (contains <a>SYMBOL</a>)
    const firstLi = liMatches[0];
    const symbolMatch = firstLi.match(/>([A-Z0-9]{3,6})<\/a>/);
    if (!symbolMatch) continue;

    const symbol = symbolMatch[1];
    if (!TARGET_SYMBOLS.includes(symbol)) continue;

    // Extract text from <li> tags
    const getText = (li: string) => li.replace(/<[^>]*>/g, '').trim();

    const last = parseNumber(getText(liMatches[1]));
    const chgPct = parseNumber(getText(liMatches[3]));

    if (last > 0) {
      indices[symbol] = { last, chgPct };
    }
  }

  if (Object.keys(indices).length === 0) {
    throw new Error('Failed to parse index data from HTML');
  }

  const result = {
    updatedAt: new Date().toISOString(),
    indices,
  };

  cache = { data: result, timestamp: Date.now() };
  console.log(`Parsed indices:`, Object.keys(indices));
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data = await fetchIndices();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);

    if (cache) {
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
