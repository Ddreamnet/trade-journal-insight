import { supabase } from '@/integrations/supabase/client';
import type { BistStock } from '@/types/stock';

// BIST100 popular symbols for initial fetch
export const BIST_SYMBOLS = [
  'THYAO', 'GARAN', 'ASELS', 'SASA', 'KCHOL', 'EREGL', 'BIMAS', 'AKBNK',
  'TUPRS', 'SAHOL', 'PGSUS', 'VESTL', 'TOASO', 'TAVHL', 'FROTO', 'SISE',
  'KOZAL', 'PETKM', 'ENKAI', 'TCELL', 'YKBNK', 'HALKB', 'ISCTR', 'EKGYO',
  'TTKOM', 'ARCLK', 'DOHOL', 'GUBRF', 'SOKM', 'MGROS'
];

const CACHE_KEY = 'yahoo-prices-cache';
const CACHE_TIMESTAMP_KEY = 'yahoo-prices-cache-time';

// Yahoo Finance quote response types
interface YahooQuoteResult {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  regularMarketTime?: number;
}

interface YahooQuoteResponse {
  quoteResponse?: {
    result?: YahooQuoteResult[];
    error?: unknown;
  };
}

// Chart response types
interface YahooChartResult {
  meta?: {
    symbol?: string;
    currency?: string;
    regularMarketPrice?: number;
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: number[];
      high?: number[];
      low?: number[];
      close?: number[];
      volume?: number[];
    }>;
  };
}

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[];
    error?: unknown;
  };
}

export interface ChartDataPoint {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Save to localStorage
function saveToCache(stocks: BistStock[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(stocks));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, new Date().toISOString());
  } catch (e) {
    console.warn('Failed to cache Yahoo prices:', e);
  }
}

// Load from localStorage
function loadFromCache(): { stocks: BistStock[]; timestamp: Date | null } {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (cached) {
      return {
        stocks: JSON.parse(cached) as BistStock[],
        timestamp: timestamp ? new Date(timestamp) : null,
      };
    }
  } catch (e) {
    console.warn('Failed to load cached Yahoo prices:', e);
  }
  return { stocks: [], timestamp: null };
}

export function getCachedPrices(): { stocks: BistStock[]; timestamp: Date | null } {
  return loadFromCache();
}

// Normalize Yahoo symbol (remove .IS suffix for display)
function normalizeSymbol(yahooSymbol: string): string {
  return yahooSymbol.replace('.IS', '').toUpperCase();
}

// Convert Yahoo quote to our BistStock format
function convertQuoteToBistStock(quote: YahooQuoteResult): BistStock {
  return {
    symbol: normalizeSymbol(quote.symbol || 'UNKNOWN'),
    name: quote.shortName || quote.longName || normalizeSymbol(quote.symbol || ''),
    lastPrice: quote.regularMarketPrice ?? 0,
    change: quote.regularMarketChange ?? 0,
    changePercent: quote.regularMarketChangePercent ?? 0,
    volume: quote.regularMarketVolume ?? null,
    time: quote.regularMarketTime 
      ? new Date(quote.regularMarketTime * 1000).toISOString() 
      : null,
  };
}

// Fetch quotes via Edge Function proxy
export async function fetchQuotes(symbols: string[] = BIST_SYMBOLS): Promise<BistStock[]> {
  const supabaseUrl = (supabase as unknown as { supabaseUrl?: string }).supabaseUrl;
  const supabaseKey = (supabase as unknown as { supabaseKey?: string }).supabaseKey;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase client missing configuration');
  }

  const symbolsParam = symbols.join(',');
  const url = `${supabaseUrl}/functions/v1/yahoo-finance?type=quote&symbols=${encodeURIComponent(symbolsParam)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: supabaseKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const cached = loadFromCache();
    if (cached.stocks.length > 0) {
      console.log('API error, returning cached data');
      return cached.stocks;
    }
    throw new Error(`Yahoo Finance API error: ${response.status}`);
  }

  const data = await response.json() as YahooQuoteResponse;

  if (!data.quoteResponse?.result || data.quoteResponse.result.length === 0) {
    const cached = loadFromCache();
    if (cached.stocks.length > 0) {
      console.log('No data from API, returning cached data');
      return cached.stocks;
    }
    throw new Error('No data received from Yahoo Finance');
  }

  const stocks = data.quoteResponse.result.map(convertQuoteToBistStock);
  
  // Cache successful response
  saveToCache(stocks);
  
  console.log(`Yahoo Finance: Fetched ${stocks.length} stocks`);
  return stocks;
}

// Fetch chart data via Edge Function proxy
export async function fetchChart(symbol: string, range: string = '1mo'): Promise<ChartDataPoint[]> {
  const supabaseUrl = (supabase as unknown as { supabaseUrl?: string }).supabaseUrl;
  const supabaseKey = (supabase as unknown as { supabaseKey?: string }).supabaseKey;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase client missing configuration');
  }

  const url = `${supabaseUrl}/functions/v1/yahoo-finance?type=chart&symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: supabaseKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance Chart API error: ${response.status}`);
  }

  const data = await response.json() as YahooChartResponse;

  if (!data.chart?.result?.[0]) {
    throw new Error('No chart data received from Yahoo Finance');
  }

  const result = data.chart.result[0];
  const timestamps = result.timestamp || [];
  const quotes = result.indicators?.quote?.[0];

  if (!quotes || timestamps.length === 0) {
    return [];
  }

  const chartData: ChartDataPoint[] = [];
  
  for (let i = 0; i < timestamps.length; i++) {
    if (quotes.close?.[i] != null) {
      chartData.push({
        date: new Date(timestamps[i] * 1000),
        open: quotes.open?.[i] ?? 0,
        high: quotes.high?.[i] ?? 0,
        low: quotes.low?.[i] ?? 0,
        close: quotes.close[i],
        volume: quotes.volume?.[i] ?? 0,
      });
    }
  }

  console.log(`Yahoo Finance: Fetched ${chartData.length} chart points for ${symbol}`);
  return chartData;
}
