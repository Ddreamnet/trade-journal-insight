/**
 * Sembolün para birimini belirler.
 * USDT veya USD ile biten semboller (BTCUSDT, ETHUSDT, XAUUSD, XAGUSD…) USD,
 * diğerleri TRY kabul edilir.
 */
export function getSymbolCurrency(symbol: string): 'USD' | 'TRY' {
  const s = symbol.toUpperCase();
  if (s.endsWith('USDT') || s.endsWith('USD') || s.endsWith('USDC')) return 'USD';
  return 'TRY';
}

/**
 * Fiyatı para birimine göre formatlar.
 * - TRY: ₺1.234,56
 * - USD: $1.234,56
 * Kripto için yüksek fiyatlar (>1000) binlik ayraçlı gösterilir.
 */
export function formatPrice(price: number, symbolOrCurrency: string): string {
  const currency =
    symbolOrCurrency === 'USD' || symbolOrCurrency === 'TRY'
      ? (symbolOrCurrency as 'USD' | 'TRY')
      : getSymbolCurrency(symbolOrCurrency);

  if (currency === 'USD') {
    return '$' + price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return '₺' + price.toFixed(2);
}

/** Sembolün para birimi sembolünü döner: '$' veya '₺' */
export function getCurrencySymbol(symbolOrCurrency: string): string {
  return getSymbolCurrency(symbolOrCurrency) === 'USD' ? '$' : '₺';
}
