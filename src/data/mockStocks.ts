import { Stock } from '@/types/trade';

export const MOCK_STOCKS: Stock[] = [
  { id: '1', symbol: 'THYAO', name: 'Türk Hava Yolları', currentPrice: 285.50, change: 4.20, changePercent: 1.49 },
  { id: '2', symbol: 'GARAN', name: 'Garanti BBVA', currentPrice: 112.30, change: -1.80, changePercent: -1.58 },
  { id: '3', symbol: 'ASELS', name: 'Aselsan', currentPrice: 78.45, change: 2.15, changePercent: 2.82 },
  { id: '4', symbol: 'SASA', name: 'Sasa Polyester', currentPrice: 45.60, change: -0.85, changePercent: -1.83 },
  { id: '5', symbol: 'KCHOL', name: 'Koç Holding', currentPrice: 198.75, change: 3.50, changePercent: 1.79 },
  { id: '6', symbol: 'EREGL', name: 'Ereğli Demir Çelik', currentPrice: 52.80, change: 0.95, changePercent: 1.83 },
  { id: '7', symbol: 'BIMAS', name: 'BİM Mağazalar', currentPrice: 385.20, change: -5.30, changePercent: -1.36 },
  { id: '8', symbol: 'AKBNK', name: 'Akbank', currentPrice: 65.40, change: 1.20, changePercent: 1.87 },
  { id: '9', symbol: 'TUPRS', name: 'Tüpraş', currentPrice: 178.90, change: -2.40, changePercent: -1.32 },
  { id: '10', symbol: 'SAHOL', name: 'Sabancı Holding', currentPrice: 87.65, change: 1.75, changePercent: 2.04 },
  { id: '11', symbol: 'PGSUS', name: 'Pegasus', currentPrice: 892.50, change: 15.80, changePercent: 1.80 },
  { id: '12', symbol: 'VESTL', name: 'Vestel', currentPrice: 34.25, change: -0.45, changePercent: -1.30 },
  { id: '13', symbol: 'TOASO', name: 'Tofaş Oto', currentPrice: 245.80, change: 4.90, changePercent: 2.03 },
  { id: '14', symbol: 'TAVHL', name: 'TAV Havalimanları', currentPrice: 112.40, change: 2.30, changePercent: 2.09 },
  { id: '15', symbol: 'FROTO', name: 'Ford Otosan', currentPrice: 1125.00, change: -18.50, changePercent: -1.62 },
  { id: '16', symbol: 'SISE', name: 'Şişecam', currentPrice: 48.75, change: 0.65, changePercent: 1.35 },
  { id: '17', symbol: 'KOZAL', name: 'Koza Altın', currentPrice: 156.30, change: 5.40, changePercent: 3.58 },
  { id: '18', symbol: 'PETKM', name: 'Petkim', currentPrice: 23.45, change: -0.35, changePercent: -1.47 },
  { id: '19', symbol: 'ENKAI', name: 'Enka İnşaat', currentPrice: 42.80, change: 0.90, changePercent: 2.15 },
  { id: '20', symbol: 'TCELL', name: 'Turkcell', currentPrice: 89.50, change: 1.85, changePercent: 2.11 },
];

export const TICKER_STOCKS = MOCK_STOCKS.slice(0, 6);
