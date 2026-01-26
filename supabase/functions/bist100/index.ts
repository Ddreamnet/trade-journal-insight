import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UPSTREAM_URL = 'https://www.hangikredi.com/yatirim-araclari/hisse-senetleri/bist-100-hisseleri';

// Simple in-memory cache
let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 60000; // 60 seconds

function parsePrice(str: string): number {
  // Turkish format: 1.234,56 -> 1234.56
  const cleaned = str.replace(/[^\d,.\-]/g, '');
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
}

function parsePercent(str: string): number {
  const cleaned = str.replace(/[^\d,.\-]/g, '');
  const normalized = cleaned.replace(',', '.');
  return parseFloat(normalized) || 0;
}

async function fetchBistData() {
  // Check cache
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
  
  // Parse HTML to extract stock data
  const items: any[] = [];
  
  // Extract symbol from first td - look for pattern like "AEFES" followed by time
  // Column order: Symbol (with time), Low, High, Last, Change, ChangePct
  
  // Find all table rows
  const rowRegex = /<tr[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1];
    const cellMatches = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    
    if (cellMatches && cellMatches.length >= 6) {
      // Extract text content from cells, cleaning HTML
      const getText = (htmlContent: string) => {
        return htmlContent
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };
      
      // Extract logo URL from first cell (look for img src)
      const firstCell = cellMatches[0];
      const logoMatch = firstCell.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
      let logoUrl = logoMatch ? logoMatch[1] : null;
      
      // Make sure logo URL is absolute
      if (logoUrl && !logoUrl.startsWith('http')) {
        logoUrl = logoUrl.startsWith('/') 
          ? `https://www.hangikredi.com${logoUrl}` 
          : `https://www.hangikredi.com/${logoUrl}`;
      }
      
      // First cell contains symbol and time
      const firstCellText = getText(cellMatches[0]);
      
      // Extract symbol (usually 4-5 uppercase letters at the start)
      const symbolMatch = firstCellText.match(/^([A-ZÇĞİÖŞÜ]{3,6})/i);
      if (!symbolMatch) continue;
      
      const symbol = symbolMatch[1].toUpperCase();
      
      // Extract time if present (format: HH:MM)
      const timeMatch = firstCellText.match(/(\d{1,2}:\d{2})/);
      const time = timeMatch ? timeMatch[1] : new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      
      // Column order per search result: Symbol, Low, High, Last, Change, ChangePct
      const lowText = getText(cellMatches[1]);
      const highText = getText(cellMatches[2]);
      const lastPriceText = getText(cellMatches[3]);
      const changeText = getText(cellMatches[4]);
      const changePctText = getText(cellMatches[5]);
      
      const lastPrice = parsePrice(lastPriceText);
      
      if (lastPrice > 0) {
        items.push({
          symbol: symbol,
          last: lastPrice,
          low: parsePrice(lowText),
          high: parsePrice(highText),
          chg: parsePrice(changeText),
          chgPct: parsePercent(changePctText),
          time: time,
          logoUrl: logoUrl
        });
      }
    }
  }

  if (items.length === 0) {
    // Try alternative parsing - look for stock symbols directly
    const altRegex = /([A-Z]{4,5})\s+[\d,.]+\s*TL/g;
    let altMatch;
    console.log('Primary parsing failed, trying alternative...');
    console.log('HTML length:', html.length);
    console.log('Sample HTML:', html.substring(0, 2000));
    throw new Error('Failed to parse stock data from HTML - no matching rows found');
  }

  if (items.length === 0) {
    throw new Error('Failed to parse stock data from HTML');
  }

  const result = {
    updatedAt: new Date().toISOString(),
    source: 'hangikredi',
    items: items
  };

  // Update cache
  cache = { data: result, timestamp: Date.now() };
  
  console.log(`Parsed ${items.length} stocks`);
  return result;
}

serve(async (req) => {
  // Handle CORS preflight
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
    
    // Return cached data if available
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
