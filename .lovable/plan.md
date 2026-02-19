
# Sütun Grafiğinde Eksik `allTrades` ve `stockPriceMap` Sorunu

## Sorun

`ReturnComparisonChart.tsx` içinde `useEquityCurveData` hook'u çağrılırken kritik parametreler eksik geçiliyor:

```ts
// MEVCUT (eksik):
const { chartData, t0 } = useEquityCurveData(
  timeRange,
  selectedBenchmarks,
  closedTrades,
  startingCapital,
  partialCloses
  // allTrades → eksik → hook [] varsayıyor
  // stockPriceMap → eksik → hook new Map() varsayıyor
  // missingSymbols → eksik → hook [] varsayıyor
);
```

Hook'un imzası şu:
```ts
useEquityCurveData(
  timeRange,
  selectedBenchmarks,
  closedTrades,
  startingCapital,
  partialCloses,
  allTrades,       // 6. parametre — açık pozisyonlar için gerekli
  stockPriceMap,   // 7. parametre — gerçek fiyat verisi
  priceDataMissing // 8. parametre — fallback mantığı
)
```

**Sonuç:** Sütun grafiği portföy getirisini hesaplarken unrealized PnL'yi (açık pozisyonların güncel değerini) dahil etmiyor. Sadece `partialCloses` kaynaklı realize edilmiş kâr/zarar üzerinden hesaplıyor. Çizgi grafiğiyle farklı sonuçlar üretiyor.

## Çözüm

`ReturnComparisonChart` bileşenine `allTrades` prop'u eklenir. Bileşen kendi içinde `useStockPriceSeries` hook'unu kullanarak stock fiyatlarını çeker ve `useEquityCurveData`'ya eksiksiz geçer — tıpkı `EquityCurveChart`'ın yaptığı gibi.

## Değiştirilecek Dosyalar

### 1. `src/components/reports/ReturnComparisonChart.tsx`

- `ReturnComparisonChartProps` arayüzüne `allTrades: Trade[]` eklenir
- `useStockPriceSeries` import edilir, `getTimeRangeDates` import edilir
- Bileşen içinde `startDate/endDate` hesaplanır
- `useStockPriceSeries(allTrades, startDate, endDate)` çağrılır
- `useEquityCurveData`'ya `allTrades`, `stockPriceMap`, `missingSymbols` geçilir

### 2. `src/pages/Reports.tsx`

- `ReturnComparisonChart` bileşenine `allTrades={trades as Trade[]}` prop'u eklenir

## Teknik Akış

```text
ReturnComparisonChart
  ├── getTimeRangeDates(timeRange) → startDate, endDate
  ├── useStockPriceSeries(allTrades, startDate, endDate) → stockPriceMap, missingSymbols
  └── useEquityCurveData(
        timeRange, selectedBenchmarks, closedTrades, startingCapital,
        partialCloses, allTrades, stockPriceMap, missingSymbols   ← tüm parametreler
      ) → chartData
```

Bu sayede sütun grafiği de çizgi grafiğiyle aynı veri kaynağından beslenmiş olur.

## Küçük İyileştirme: Enflasyon Tooltip'i

Çizgi grafiğinde enflasyon hover'ında şu an `"100 → 147 TL"` yazıyor, diğer benchmark'lar sadece sayı gösteriyor. Bu tutarsızlık giderilebilir — enflasyon da diğerleri gibi sadece endeks değeri (`147.3` gibi) göstersin.

## Etki Analizi

| Alan | Değişim |
|------|---------|
| Sütun grafiği portföy getirisi | Açık pozisyonlar artık dahil, çizgi grafiğiyle tutarlı |
| Çizgi grafiği | Değişmez |
| İstatistik kartları | Değişmez |
| Portföy Değeri grafiği | Değişmez |
| Varlıklarım grafiği | Değişmez |
