

# Plan: "Kıyaslama (Getiri %)" Sütun Grafiği Ekleme (Güncellenmiş)

## Genel Bakış

"Raporlarım" sayfasındaki mevcut performans grafiğinin altına, seçilen zaman aralığı için portföy ve benchmark'ların toplam getiri yüzdesini karşılaştıran bir yatay bar grafiği eklenmesi.

---

## Kullanıcı Geri Bildirimleri ve Çözümler

| Geri Bildirim | Çözüm |
|---------------|-------|
| **1. TimeRange filtreleme eksik** | `chartData` önce `timeRange`'e göre filtrelenecek, sonra ilk/son non-null alınacak |
| **2. Veri paylaşımı: Seçenek A riskli** | **Seçenek B: Shared Hook** kullanılacak - `useEquityCurveData()` oluşturulacak |
| **3. Renk çakışması (benchmark vs profit/loss)** | Bar'lar **benchmark rengiyle** boyanacak, profit/loss sadece **yazı renginde** gösterilecek |
| **4. Layout kararı** | Her yerde **yatay bar (`layout="vertical"`)** kullanılacak - mobilde daha okunabilir |

---

## Bileşen Mimarisi (Güncellenmiş)

```text
Reports.tsx
    |
    +-- useEquityCurveData() ← YENİ SHARED HOOK (tek kaynak)
    |       |
    |       +-- chartData, t0, startDate, endDate, benchmarkDataMaps
    |
    +-- EquityCurveChart (Mevcut - Hook'u kullanır)
    |
    +-- ReturnComparisonChart (YENİ - Aynı hook'u kullanır)
            |
            +-- Collapsible wrapper
            +-- Collapsed: Chip özet görünüm
            +-- Expanded: Yatay bar chart
```

---

## Dosya Değişiklikleri

### 1. YENİ: `src/hooks/useEquityCurveData.ts`

EquityCurveChart'tan hesaplama fonksiyonları çıkarılacak:

```typescript
export interface EquityCurveData {
  chartData: ChartDataPoint[];
  t0: Date | null;
  startDate: Date;
  endDate: Date;
  portfolioIndexMap: Map<string, { index: number; tl: number }>;
  benchmarkDataMaps: Record<string, Map<string, number>>;
}

export function useEquityCurveData(
  timeRange: TimeRange,
  selectedBenchmarks: string[],
  closedTrades: Trade[],
  startingCapital: number
): EquityCurveData {
  // Mevcut EquityCurveChart'taki hesaplama mantığı buraya taşınacak:
  // - calculateT0FromClosedTrades
  // - getTimeRangeDates
  // - calculateDailyPnLContributions
  // - normalizeBenchmarkFromT0WithCarryForward
  // - convertInflationToCompoundIndex
  // - inflationMonthlyToDailyWithCarryForward
  // - portfolioIndexMap hesaplaması
  // - benchmarkDataMaps hesaplaması
  // - chartData oluşturma
}
```

**Export edilecek helper fonksiyonlar:**
- `calculateT0FromClosedTrades()`
- `getTimeRangeDates()`
- `ChartDataPoint` interface

---

### 2. GÜNCELLEME: `src/components/reports/EquityCurveChart.tsx`

- Hook'a taşınan kod kaldırılacak
- `useEquityCurveData()` import edilip kullanılacak
- Sadece render mantığı kalacak

```typescript
import { useEquityCurveData, ChartDataPoint } from '@/hooks/useEquityCurveData';

export function EquityCurveChart({ ... }) {
  const { chartData, t0, portfolioIndexMap, benchmarkDataMaps } = useEquityCurveData(
    timeRange,
    selectedBenchmarks,
    closedTrades,
    startingCapital
  );
  
  // ... render logic (değişmez)
}
```

---

### 3. YENİ: `src/components/reports/ReturnComparisonChart.tsx`

#### Props

```typescript
interface ReturnComparisonChartProps {
  timeRange: TimeRange;
  selectedBenchmarks: string[];
  benchmarks: BenchmarkData[];
  closedTrades: Trade[];
  startingCapital: number;
}
```

#### Getiri Hesaplama (TimeRange Uygulanmış)

```typescript
const calculateReturns = useMemo(() => {
  const result: ReturnDataPoint[] = [];
  
  // 1. chartData zaten timeRange'e göre filtrelenmiş durumda (hook'tan)
  // 2. İlk non-null ve son non-null değerleri bul
  
  // Portföy
  let firstPortfolio: number | null = null;
  let lastPortfolio: number | null = null;
  
  for (const point of chartData) {
    if (point.portfolioIndex !== null) {
      if (firstPortfolio === null) firstPortfolio = point.portfolioIndex;
      lastPortfolio = point.portfolioIndex;
    }
  }
  
  if (firstPortfolio !== null && lastPortfolio !== null) {
    const returnPct = ((lastPortfolio / firstPortfolio) - 1) * 100;
    result.push({
      id: 'portfolio',
      name: 'Portföy',
      value: returnPct,
      color: 'hsl(var(--primary))',
      startValue: firstPortfolio,
      endValue: lastPortfolio,
    });
  }
  
  // Benchmark'lar için aynı mantık
  selectedBenchmarks.forEach((benchmarkId) => {
    // ... aynı ilk/son non-null mantığı
  });
  
  return result;
}, [chartData, selectedBenchmarks, benchmarks]);
```

#### Renk/Stil Stratejisi (Çakışma Çözümü)

| Eleman | Stil |
|--------|------|
| **Bar fill** | Benchmark rengi (`benchmark.color`) |
| **Bar label (değer)** | `text-profit` (yeşil) veya `text-loss` (kırmızı) |
| **Chip background** | `${benchmark.color}20` (şeffaf) |
| **Chip text** | `text-profit` / `text-loss` |

```typescript
// Bar örneği
<Bar dataKey="value" radius={[0, 4, 4, 0]}>
  {returnData.map((entry) => (
    <Cell key={entry.id} fill={entry.color} />
  ))}
</Bar>

// Label örneği
<text 
  className={entry.value >= 0 ? 'text-profit' : 'text-loss'}
>
  {entry.value >= 0 ? '+' : ''}{entry.value.toFixed(1)}%
</text>
```

#### Mobil Davranış

```typescript
const isMobile = useIsMobile();
const [isOpen, setIsOpen] = useState(!isMobile); // Mobilde kapalı başla

// Chart yüksekliği
const chartHeight = isMobile ? 180 : 220;

// 6+ item için yatay scroll
<div className={cn(
  returnData.length > 5 && "overflow-x-auto"
)}>
  <div style={{ minWidth: returnData.length > 5 ? returnData.length * 60 : 'auto' }}>
    <ResponsiveContainer width="100%" height={chartHeight}>
      ...
    </ResponsiveContainer>
  </div>
</div>
```

#### Tooltip (Dokunmatik Uyumlu)

```typescript
function BarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  
  return (
    <div className="bg-popover border rounded-lg p-2 shadow-lg text-sm">
      <div className="font-medium" style={{ color: data.color }}>
        {data.name}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
        <span className="text-muted-foreground">Başlangıç:</span>
        <span className="font-mono">{data.startValue.toFixed(1)}</span>
        <span className="text-muted-foreground">Bitiş:</span>
        <span className="font-mono">{data.endValue.toFixed(1)}</span>
        <span className="text-muted-foreground">Getiri:</span>
        <span className={cn(
          "font-mono font-semibold",
          data.value >= 0 ? "text-profit" : "text-loss"
        )}>
          {data.value >= 0 ? '+' : ''}{data.value.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}
```

---

### 4. GÜNCELLEME: `src/pages/Reports.tsx`

```typescript
import { ReturnComparisonChart } from '@/components/reports/ReturnComparisonChart';

// ... mevcut kod ...

{/* Chart Section - Equity Curve */}
<div className="rounded-xl bg-card border border-border p-4 mb-6">
  {/* ... mevcut içerik ... */}
  <EquityCurveChart ... />
</div>

{/* YENİ: Return Comparison Chart */}
<ReturnComparisonChart
  timeRange={selectedTimeRange}
  selectedBenchmarks={selectedBenchmarks}
  benchmarks={BENCHMARKS}
  closedTrades={closedTrades}
  startingCapital={startingCapital}
/>

{/* Benchmark Selector (değişmez) */}
<div className="rounded-xl bg-card border border-border p-4">
  ...
</div>
```

---

## UI Detayları

### Collapsed Görünüm (Mobil Varsayılan)

```text
┌─────────────────────────────────────────────────┐
│ Kıyaslama (Getiri %)                       [▼]  │
├─────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│ │ Portföy  │ │  Altın   │ │  Dolar   │          │
│ │  +8.2%   │ │  +5.1%   │ │  -2.3%   │          │
│ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────┘
```

- Chip'ler wrap olabilir (flex-wrap)
- Chip border: benchmark rengi
- Chip text: profit/loss renginde

### Expanded Görünüm

```text
┌─────────────────────────────────────────────────┐
│ Kıyaslama (Getiri %)                       [▲]  │
├─────────────────────────────────────────────────┤
│ Seçili aralık: Son 1 Ay — Toplam getiri %       │
│                                                 │
│ Portföy  ████████████████████│ +8.2%            │
│   Altın  ████████████████│ +5.1%                │
│   Dolar  ██│ -2.3%                              │
│  BIST100 ██████████████████████████│ +12.4%     │
│                     0                           │
└─────────────────────────────────────────────────┘
```

- Yatay bar layout (`layout="vertical"`)
- Y ekseni: varlık isimleri
- X ekseni: yüzde değerleri
- 0 referans çizgisi
- Negatif bar'lar sola uzanır

---

## Boş/Hata Durumları

| Durum | Mesaj |
|-------|-------|
| Portföy + 0 benchmark = 1 varlık | "Kıyaslamak için en az 2 varlık seçin. Üstteki grafikten ekleyebilirsiniz." |
| Veri yok | "Bu aralık için yeterli veri bulunamadı." |
| t0 null (kapalı işlem yok) | Bileşen hiç render edilmez |

---

## Kabul Kriterleri (Güncellenmiş)

- [ ] Bar chart, ana grafikte seçilen varlık sayısına göre dinamik sütun gösteriyor
- [ ] **Zaman aralığı ile getiri hesaplanıyor** (timeRange'e göre filtrelenmiş veri)
- [ ] **Shared hook ile tek kaynak kullanılıyor** (kod tekrarı yok)
- [ ] **Bar'lar benchmark rengiyle**, **yazılar profit/loss rengiyle** gösteriliyor
- [ ] **Yatay bar layout** kullanılıyor (mobilde okunabilir)
- [ ] Mobilde collapsed özet görünümü var; açınca grafik geliyor
- [ ] Negatif getiri düzgün görünüyor (0 çizgisinin solunda)
- [ ] Tooltip tap ile çalışıyor (başlangıç, bitiş, getiri % gösteriyor)
- [ ] Tasarım, mevcut "Raporlarım" sayfasına uyumlu
- [ ] 6+ varlık için yatay scroll çalışıyor

---

## Dosya Özeti

| Dosya | İşlem |
|-------|-------|
| `src/hooks/useEquityCurveData.ts` | **YENİ** - Shared hesaplama hook'u |
| `src/components/reports/EquityCurveChart.tsx` | **GÜNCELLEME** - Hook kullan, hesaplama kodunu kaldır |
| `src/components/reports/ReturnComparisonChart.tsx` | **YENİ** - Kıyaslama bar chart |
| `src/pages/Reports.tsx` | **GÜNCELLEME** - Yeni bileşeni import et ve render et |

---

## Teknik Notlar

1. **Shared Hook Avantajı:** Aynı hesaplama mantığı tek yerde, iki bileşen tarafından kullanılır - bug riski azalır
2. **TimeRange Filtreleme:** Hook `chartData`'yı oluştururken zaten `startDate`-`endDate` aralığını kullanıyor, getiri hesabı bu filtrelenmiş veri üzerinden yapılacak
3. **Renk Tutarlılığı:** Bar rengi = varlık kimliği, yazı rengi = performans durumu - bu ikisi çakışmaz
4. **Performans:** Tüm hesaplamalar `useMemo` ile cache'lenir

