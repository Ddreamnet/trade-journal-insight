

# Gumus Verisinin Grafiklerde Gosterilmemesi - Duzeltme Plani

## Sorunun Kaynagi

API tarafinda her sey dogru calisiyor -- edge function logs'ta `silver` verisinin basariyla cekildigini ve 200 status donundugunu goruyoruz. Sorun tamamen **frontend grafik bilesenlerinde**: `silver` anahtari benchmark haritalarindan eksik.

## Eksik Yerler (3 dosya, 4 degisiklik)

### 1. `src/components/reports/EquityCurveChart.tsx` (Cizgi Grafik)

`benchmarkKeyMap` objesinde `silver` yok. Gold nasil tanimlanmissa ayni sekilde eklenmeli:

```ts
const benchmarkKeyMap: Record<string, keyof ChartDataPoint> = {
  gold: 'gold',
  silver: 'silver',  // EKSIK
  usd: 'usd',
  ...
};
```

### 2. `src/components/reports/ReturnComparisonChart.tsx` (Sutun Grafik)

`accessor` switch/case blogundan `silver` eksik:

```ts
switch (benchmarkId) {
  case 'gold': return point.gold;
  case 'silver': return point.silver;  // EKSIK
  case 'usd': return point.usd;
  ...
}
```

### 3. `src/components/reports/WinRateChart.tsx` (Win Rate Grafik -- ilk uc grafik degilse de tutarlilik icin)

`benchmarkKeyMap` objesinde `silver` yok:

```ts
const benchmarkKeyMap: { [key: string]: keyof ChartDataPoint } = {
  gold: 'gold',
  silver: 'silver',  // EKSIK
  ...
};
```

### 4. `src/components/reports/PortfolioValueChart.tsx` (Portfoy Degeri)

Tooltip'te `maximumFractionDigits` sadece `gold` icin 2 yapilmis, `silver` icin de ayni olmali:

```ts
maximumFractionDigits: (selectedCurrency === 'gold' || selectedCurrency === 'silver') ? 2 : 0,
```

## Ozet

| Dosya | Degisiklik | Etki |
|-------|-----------|------|
| EquityCurveChart.tsx | `benchmarkKeyMap`'e `silver: 'silver'` ekle | Cizgi grafikte gumus cizgisi gorunur |
| ReturnComparisonChart.tsx | Switch'e `case 'silver'` ekle | Sutun grafikte gumus sutunu gorunur |
| WinRateChart.tsx | `benchmarkKeyMap`'e `silver: 'silver'` ekle | Win rate grafikte gumus cizgisi gorunur |
| PortfolioValueChart.tsx | Tooltip'te silver icin ondalik hassasiyeti ekle | Gumus gram degeri dogru formatlanir |

Toplam 4 dosyada kucuk eklemeler. Veri akisi ve API tarafinda degisiklik gerekmez.
