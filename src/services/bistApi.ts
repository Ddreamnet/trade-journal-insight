import { supabase } from '@/integrations/supabase/client';
import type { BistStock } from '@/types/stock';

const CACHE_KEY = 'bist-prices-cache';
const CACHE_TIMESTAMP_KEY = 'bist-prices-cache-time';

interface RawBistStock {
  symbol?: string;
  code?: string;
  ticker?: string;
  name?: string;
  title?: string;
  lastPrice?: number;
  last?: number;
  price?: number;
  close?: number;
  change?: number;
  diff?: number;
  changePercent?: number;
  percentChange?: number;
  pct?: number;
  volume?: number;
  vol?: number;
  time?: string;
  timestamp?: string;
  date?: string;
}

// Normalize raw API response to our standard format
function normalizeStock(raw: RawBistStock): BistStock {
  return {
    symbol: raw.symbol || raw.code || raw.ticker || 'UNKNOWN',
    name: raw.name || raw.title || raw.symbol || raw.code || 'Unknown',
    lastPrice: raw.lastPrice ?? raw.last ?? raw.price ?? raw.close ?? 0,
    change: raw.change ?? raw.diff ?? 0,
    changePercent: raw.changePercent ?? raw.percentChange ?? raw.pct ?? 0,
    volume: raw.volume ?? raw.vol ?? null,
    time: raw.time ?? raw.timestamp ?? raw.date ?? null,
  };
}

// Save to localStorage
function saveToCache(stocks: BistStock[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(stocks));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, new Date().toISOString());
  } catch (e) {
    console.warn('Failed to cache BIST prices:', e);
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
    console.warn('Failed to load cached BIST prices:', e);
  }
  return { stocks: [], timestamp: null };
}

export function getCachedPrices(): { stocks: BistStock[]; timestamp: Date | null } {
  return loadFromCache();
}

// Custom error for rate limiting
export class RateLimitError extends Error {
  constructor(public retryAfter: number = 60) {
    super('Rate limited');
    this.name = 'RateLimitError';
  }
}

type FunctionJson = Record<string, unknown> | unknown[] | null;

async function invokeBistPricesRaw(): Promise<{ status: number; body: FunctionJson }>{
  // We intentionally avoid supabase.functions.invoke here because it throws a
  // FunctionsHttpError on non-2xx and hides the JSON body (we need it for 429).
  const supabaseUrl = (supabase as unknown as { supabaseUrl?: string }).supabaseUrl;
  const supabaseKey = (supabase as unknown as { supabaseKey?: string }).supabaseKey;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase client missing supabaseUrl/supabaseKey');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const res = await fetch(`${supabaseUrl}/functions/v1/bist-prices`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      'Content-Type': 'application/json',
    },
  });

  const text = await res.text();
  let body: FunctionJson = null;
  try {
    body = text ? (JSON.parse(text) as FunctionJson) : null;
  } catch {
    body = { error: text };
  }

  return { status: res.status, body };
}

export async function fetchBist100Prices(): Promise<BistStock[]> {
  const { status, body } = await invokeBistPricesRaw();

  const data = body as any;

  // Edge function may return 200 with a rate_limited payload (to avoid surfacing
  // runtime errors in the UI layer). Treat it the same.
  if (data?.error === 'rate_limited') {
    console.warn('BIST API rate limited - using cached data');
    const cached = loadFromCache();
    if (cached.stocks.length > 0) {
      return cached.stocks;
    }
    throw new RateLimitError(typeof data?.retryAfter === 'number' ? data.retryAfter : 60);
  }

  if (status < 200 || status >= 300) {
    console.error('BIST API fetch error:', { status, body: data });
    // Return cached data on error
    const cached = loadFromCache();
    if (cached.stocks.length > 0) {
      console.log('Returning cached data due to API error');
      return cached.stocks;
    }
    throw new Error((data && typeof data.error === 'string' && data.error) || `Failed to fetch BIST prices (${status})`);
  }

  if (!data) {
    const cached = loadFromCache();
    if (cached.stocks.length > 0) {
      console.log('Returning cached data - no data from API');
      return cached.stocks;
    }
    throw new Error('No data received from BIST API');
  }

  // Handle different response structures
  let rawStocks: RawBistStock[] = [];
  
  if (Array.isArray(data)) {
    rawStocks = data;
  } else if (data.data && Array.isArray(data.data)) {
    rawStocks = data.data;
  } else if (data.stocks && Array.isArray(data.stocks)) {
    rawStocks = data.stocks;
  } else if (data.prices && Array.isArray(data.prices)) {
    rawStocks = data.prices;
  } else if (data.success === true && data.data === null) {
    // API returned success but no data (market closed) - use cache
    console.log('BIST API connected - market closed, using cached data');
    const cached = loadFromCache();
    return cached.stocks;
  } else {
    console.warn('Unexpected BIST API response structure:', Object.keys(data));
    const cached = loadFromCache();
    if (cached.stocks.length > 0) {
      return cached.stocks;
    }
    throw new Error('Unexpected API response structure');
  }

  // If API returned empty array, use cache
  if (rawStocks.length === 0) {
    console.log('BIST API connected - no live data, using cached data');
    const cached = loadFromCache();
    return cached.stocks;
  }

  console.log('BIST API connected - live data received');
  
  const stocks = rawStocks.map(normalizeStock);
  
  // Cache successful response
  saveToCache(stocks);
  
  return stocks;
}
