import { TradeType } from '@/types/trade';

/**
 * Validate directional consistency of prices based on trade type
 */
export function validateDirectional(
  tradeType: TradeType | null,
  parsedEntry: number,
  parsedTarget: number,
  parsedStop: number
): string[] {
  const errors: string[] = [];
  if (!tradeType || isNaN(parsedEntry) || parsedEntry <= 0) return errors;

  if (tradeType === 'buy') {
    if (!isNaN(parsedTarget) && parsedTarget > 0 && parsedTarget <= parsedEntry) {
      errors.push('AL işleminde hedef fiyat giriş fiyatından büyük olmalı');
    }
    if (!isNaN(parsedStop) && parsedStop > 0 && parsedStop >= parsedEntry) {
      errors.push('AL işleminde stop fiyat giriş fiyatından küçük olmalı');
    }
  } else {
    if (!isNaN(parsedTarget) && parsedTarget > 0 && parsedTarget >= parsedEntry) {
      errors.push('SAT işleminde hedef fiyat giriş fiyatından küçük olmalı');
    }
    if (!isNaN(parsedStop) && parsedStop > 0 && parsedStop <= parsedEntry) {
      errors.push('SAT işleminde stop fiyat giriş fiyatından büyük olmalı');
    }
  }
  return errors;
}

/**
 * Calculate Risk/Reward ratio
 */
export function calculateRR(
  tradeType: TradeType | null,
  parsedEntry: number,
  parsedTarget: number,
  parsedStop: number,
  hasDirectionalError: boolean
): number | null {
  if (isNaN(parsedEntry) || isNaN(parsedTarget) || isNaN(parsedStop)) return null;
  if (parsedEntry <= 0 || parsedTarget <= 0 || parsedStop <= 0) return null;
  if (hasDirectionalError) return null;

  if (tradeType === 'buy') {
    const risk = parsedEntry - parsedStop;
    if (risk <= 0) return null;
    return (parsedTarget - parsedEntry) / risk;
  } else {
    const risk = parsedStop - parsedEntry;
    if (risk <= 0) return null;
    return (parsedEntry - parsedTarget) / risk;
  }
}

/**
 * Calculate position amount (entry price × lot quantity)
 */
export function calculatePositionAmount(
  parsedEntry: number,
  parsedLot: number
): number | null {
  if (isNaN(parsedEntry) || isNaN(parsedLot) || parsedLot <= 0) return null;
  return parsedEntry * parsedLot;
}
