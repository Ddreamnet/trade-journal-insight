
# Plan: 100 Bazlı Retroaktif Portföy Performans Grafiği

## Özet
Mevcut Raporlar sayfasındaki equity curve grafiğini tamamen yeniden tasarlayacağız. Yeni sistem:
- İşlemler kapanana kadar grafikte görünmeyecek
- Kapanınca geçmişe dönük lineer dağıtımla günlük katkılar hesaplanacak
- Overlapping işlemlerin katkıları toplanacak
- Tüm değerler 100 bazından başlayacak
- Enflasyon bileşik endeks olarak gösterilecek (100 TL → X TL)
- Grafiğin sağında son değerleri gösteren panel olacak

---

## Değişiklikler

### 1. Yeni Tip Tanımları (`src/types/trade.ts`)
```typescript
export interface EquityDataPoint {
  date: string;           // YYYY-MM-DD
  rawDate: string;        
  portfolioIndex: number; // 100 bazlı
  portfolioTL: number;    // TL değer
  gold?: number;
  usd?: number;
  eur?: number;
  bist100?: number;
  nasdaq100?: number;
  inflation_tr?: number;
}
```

### 2. Ana Hesaplama Mantığı (`src/components/reports/EquityCurveChart.tsx`)

#### 2.1 Retroaktif PnL Dağıtımı
```text
Her kapanmış işlem için:
1. pnl = position_amount × r (r = getir oranı)
2. gün_sayısı = closed_at - created_at (gün)
3. günlük_pnl = pnl / gün_sayısı

Günlük katkı hesabı:
- Her gün d için: işlem açık mı? (created_at <= d < closed_at)
- Açıksa: o günün toplam katkısına günlük_pnl ekle
```

#### 2.2 Kümülatif Portföy Değeri
```text
t0 = ilk işlemin created_at tarihi
P0 = başlangıç sermayesi (default 1000 TL)

PortfolioTL(d) = P0 + Σ günlük_pnl_total(t0..d)
PortfolioIndex(d) = 100 × (PortfolioTL(d) / P0)
```

#### 2.3 Benchmark Normalizasyonu
```text
t0 tarihindeki benchmark fiyatı = Price(t0)
BenchmarkIndex(d) = 100 × (Price(d) / Price(t0))
```

#### 2.4 Enflasyon Bileşik Endeks
```text
EVDS'den gelen aylık % değerler:
InflIndex(ay_k) = 100 × Π(1 + m_j/100) for j=1..k

Günlük grafikte: gün hangi aydaysa o ayın endeks değeri kullanılır
```

### 3. UI Değişiklikleri

#### 3.1 Grafik Düzeni
```text
┌─────────────────────────────────┬─────────────┐
│                                 │   SON       │
│         CHART AREA              │   DEĞERLER  │
│                                 │   PANEL     │
│                                 │             │
│                                 │ Portföy:    │
│                                 │   124.5     │
│                                 │             │
│                                 │ USD: 118.2  │
│                                 │ Altın: 132  │
│                                 │             │
│                                 │ Enflasyon:  │
│                                 │ 100→156 TL  │
└─────────────────────────────────┴─────────────┘
```

#### 3.2 Tooltip Formatı
```text
Tarih: 15 Ocak 2026

Portföy: 124.5 (+24.5%)
─────────────────────
USD: 118.2 (portföyün %5.1 önünde)
Altın: 132.0 (portföyün %6.0 gerisinde)
Enflasyon: 100 TL → 156 TL
```

---

## Dosya Değişiklikleri

### Dosya 1: `src/components/reports/EquityCurveChart.tsx`

**Tamamen yeniden yazılacak:**

```typescript
// Ana fonksiyon: Retroaktif PnL hesaplama
function generateRetroactiveEquityCurve(
  closedTrades: Trade[],
  startingCapital: number,
  t0: Date,
  endDate: Date
): { date: string; portfolioTL: number; portfolioIndex: number }[]

// Yardımcı: Günlük PnL dağılımı
function calculateDailyPnLContributions(
  trades: Trade[]
): Map<string, number>  // date -> total daily pnl

// Yardımcı: Benchmark normalizasyonu t0'dan
function normalizeBenchmarkFromT0(
  points: MarketSeriesPoint[],
  t0: Date
): MarketSeriesPoint[]

// Yardımcı: Enflasyon bileşik endeks
function calculateInflationIndex(
  monthlyRates: MarketSeriesPoint[],
  t0: Date
): MarketSeriesPoint[]
```

**Sağ Panel Bileşeni (yeni):**
```typescript
interface ValuePanelProps {
  portfolioValue: number;
  benchmarkValues: Record<string, number>;
  inflationValue: number;
  selectedDate?: string;
}

function ValuePanel({ ... }: ValuePanelProps)
```

### Dosya 2: `src/pages/Reports.tsx`

**Değişiklikler:**
- `startingBalance={100}` → `startingCapital={1000}` (TL olarak)
- Benchmark seçimi aynı kalacak
- İstatistik kartları aynı kalacak

### Dosya 3: `src/contexts/MarketSeriesContext.tsx`

**Yeni fonksiyon eklenecek:**
```typescript
// Enflasyon verisini bileşik endekse çevir
const convertInflationToIndex = useCallback(
  (points: MarketSeriesPoint[], startDate: Date): MarketSeriesPoint[] => {
    // Aylık oranları bileşik çarparak 100 bazlı endeks üret
  },
  []
);
```

---

## Hesaplama Algoritması Detayı

### Adım 1: t0 Belirleme
```typescript
const t0 = closedTrades.reduce((earliest, trade) => {
  const tradeStart = parseISO(trade.created_at);
  return tradeStart < earliest ? tradeStart : earliest;
}, new Date());
```

### Adım 2: Günlük PnL Map Oluşturma
```typescript
const dailyPnL = new Map<string, number>();

for (const trade of closedTrades) {
  if (!trade.position_amount || !trade.exit_price || !trade.closed_at) continue;
  
  // PnL hesapla
  const r = trade.trade_type === 'buy' 
    ? (trade.exit_price - trade.entry_price) / trade.entry_price
    : (trade.entry_price - trade.exit_price) / trade.entry_price;
  const pnl = trade.position_amount * r;
  
  // Süreye yay
  const startDate = startOfDay(parseISO(trade.created_at));
  const endDate = startOfDay(parseISO(trade.closed_at));
  const days = differenceInDays(endDate, startDate) || 1;
  const dailyContribution = pnl / days;
  
  // Her güne ekle (created_at dahil, closed_at hariç)
  let currentDay = startDate;
  while (currentDay < endDate) {
    const key = format(currentDay, 'yyyy-MM-dd');
    dailyPnL.set(key, (dailyPnL.get(key) || 0) + dailyContribution);
    currentDay = addDays(currentDay, 1);
  }
}
```

### Adım 3: Kümülatif Seri Üretme
```typescript
let cumulative = startingCapital;
const series = [];

for each day from t0 to today:
  cumulative += dailyPnL.get(day) || 0;
  series.push({
    date: day,
    portfolioTL: cumulative,
    portfolioIndex: 100 * (cumulative / startingCapital)
  });
```

### Adım 4: Benchmark Merge
```typescript
// Her benchmark için t0'daki değeri bul
const t0Value = findValueAtDate(benchmarkPoints, t0);

// Tüm noktaları 100 bazına normalize et
normalizedPoints = points.map(p => ({
  date: p.date,
  value: 100 * (p.value / t0Value)
}));
```

### Adım 5: Enflasyon Bileşik Endeks
```typescript
let index = 100;
const inflationIndex = [];

for each month from t0:
  const monthlyRate = getMonthlyRate(month);
  index = index * (1 + monthlyRate / 100);
  inflationIndex.push({ date: month, value: index });

// Günlük interpolasyon: ay içinde sabit (carry-forward)
```

---

## Test Senaryosu (Prompt'tan)

```text
İşlem A: 1 Ocak open, 5 Ocak close, 30000 TL, E=30, X=45
İşlem B: 3 Ocak open, 8 Ocak close, 50000 TL, E=50, X=60

A: pnl = 30000 × (45-30)/30 = 15000 TL, D=4 gün, daily=3750
B: pnl = 50000 × (60-50)/50 = 10000 TL, D=5 gün, daily=2000

Günlük katkılar:
1 Ocak: 3750 (sadece A)
2 Ocak: 3750 (sadece A)
3 Ocak: 3750 + 2000 = 5750 (A+B overlap)
4 Ocak: 3750 + 2000 = 5750 (A+B overlap)
5 Ocak: 2000 (sadece B, A kapandı)
6 Ocak: 2000
7 Ocak: 2000
8+ Ocak: 0 (tüm işlemler kapandı)

Başlangıç 1000 TL ile:
1 Ocak: 1000 + 3750 = 3750 → Index: 375
2 Ocak: 3750 + 3750 = 7500 → Index: 750
...
```

---

## UI/UX Detayları

### Sağ Panel Tasarımı
- Genişlik: ~120px sabit
- Portföy değeri en üstte, büyük font
- Benchmark değerleri küçük font, renk uyumlu
- Enflasyon özel format: "100 TL → X TL"
- Hover'da seçili gün, hover yoksa son gün

### Grafik Özellikleri
- Y ekseni: 100 bazlı (0-200+ arası)
- X ekseni: Tarih (zaman aralığına göre format)
- Portföy çizgisi: Kalın, primary renk
- Benchmark çizgileri: İnce, kesikli, renk uyumlu
- 100 seviyesinde referans çizgisi

### Tooltip Tasarımı
- Portföy değeri ve % değişim
- Seçili benchmarklar ve portföye göre fark
- Enflasyon özel format

---

## Etkilenen Dosyalar
1. `src/components/reports/EquityCurveChart.tsx` - Tamamen yeniden yazılacak
2. `src/pages/Reports.tsx` - Props güncellemesi
3. `src/contexts/MarketSeriesContext.tsx` - Enflasyon bileşik fonksiyonu
4. `src/types/trade.ts` - Yeni tip tanımları (opsiyonel)
