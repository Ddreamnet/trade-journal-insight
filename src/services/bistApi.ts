import { supabase } from '@/integrations/supabase/client';
import type { BistStock } from '@/types/stock';

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

export async function fetchBist100Prices(): Promise<BistStock[]> {
  const { data, error } = await supabase.functions.invoke('bist-prices');

  if (error) {
    console.error('BIST API fetch error:', error);
    throw new Error(error.message || 'Failed to fetch BIST prices');
  }

  if (!data) {
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
    // API returned success but no data (market might be closed)
    console.log('BIST API connected - no data available (market may be closed)');
    return [];
  } else {
    // Log unexpected structure for debugging
    console.warn('Unexpected BIST API response structure:', Object.keys(data));
    throw new Error('Unexpected API response structure');
  }

  console.log('BIST API connected');
  
  return rawStocks.map(normalizeStock);
}
