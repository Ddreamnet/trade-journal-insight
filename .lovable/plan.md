

# Nasdaq100 Grafiğini TL Bazına Çevirme

## Mevcut Durum

Nasdaq100 verisi Stooq'tan USD cinsinden geliyor (`^ndx`). Normalizasyon doğrudan USD değerleri üzerinden yapılıyor:

```
index[t] = 100 * nasdaq_usd[t] / nasdaq_usd[t0]
```

Bu, sadece endeksin dolar bazlı performansını gösteriyor. Kur etkisi dahil edilmiyor.

## Hedef

Her gün icin Nasdaq degerini once TL'ye cevirip sonra normalize etmek:

```
nasdaq_tl[t] = nasdaq_usd[t] * usdtry[t]
index_tl[t] = 100 * nasdaq_tl[t] / nasdaq_tl[t0]
```

Bu sayede hem endeks hareketi hem de kur etkisi tek grafikte gorulur.

## Avantaj: USD/TRY Verisi Zaten Mevcut

`usd` benchmark'i Stooq'tan `usdtry` sembolunu cekiyor. Yani ek bir API cagrisina gerek yok -- sadece `nasdaq100` secildiginde `usd` serisinin de fetch edilmesi ve carpim icin kullanilmasi yeterli.

## Degisecek Dosya

**Tek dosya: `src/hooks/useEquityCurveData.ts`**

### Degisiklik 1: Nasdaq100 secilince USD/TRY serisini de fetch et

`useEffect` blogu (satir 295-299) guncellenir. `nasdaq100` selectedBenchmarks icindeyse, `usd` serisi de otomatik fetch edilir:

```ts
useEffect(() => {
  selectedBenchmarks.forEach((benchmarkId) => {
    fetchSeries(benchmarkId as MarketAsset);
  });
  // Nasdaq100 seciliyse USD/TRY serisini de cek (TL donusumu icin)
  if (selectedBenchmarks.includes('nasdaq100')) {
    fetchSeries('usd' as MarketAsset);
  }
}, [selectedBenchmarks, fetchSeries]);
```

### Degisiklik 2: Yeni fonksiyon -- Nasdaq100'u TL'ye cevirip normalize et

`normalizeBenchmarkFromStartWithCarryForward` fonksiyonunun yanina yeni bir fonksiyon eklenir:

```ts
function normalizeNasdaqInTL(
  nasdaqPoints: MarketSeriesPoint[],
  usdtryPoints: MarketSeriesPoint[],
  normStart: Date,
  endDate: Date
): Map<string, number> {
  // 1. Her iki seriyi de date->value Map'ine cevir
  // 2. normStart'tan endDate'e kadar her gun icin:
  //    - nasdaq ve usdtry degerlerini bul (carry-forward)
  //    - nasdaq_tl = nasdaq * usdtry
  // 3. Baslangic degerini 100'e normalize et
}
```

Tarih uyusmazligi icin carry-forward (en son bilinen deger) kullanilir -- mevcut `normalizeBenchmarkFromStartWithCarryForward` ile ayni mantik.

### Degisiklik 3: benchmarkDataMaps icinde nasdaq100 icin ozel dal

`benchmarkDataMaps` useMemo blogu (satir 436-457) guncellenir:

```ts
if (benchmarkId === 'nasdaq100') {
  const usdSeriesData = getSeriesData('usd' as MarketAsset);
  if (usdSeriesData?.points) {
    result[benchmarkId] = normalizeNasdaqInTL(
      seriesData.points,
      usdSeriesData.points,
      startDate,
      endDate
    );
  }
} else if (benchmarkId === 'inflation_tr') {
  // mevcut enflasyon mantigi
} else {
  // diger benchmarklar icin mevcut normalizasyon
}
```

`getSeriesData` dependency'si zaten mevcut, ek dependency gerekmez.

## Tarih Uyusmazligi Yonetimi

Nasdaq100 sadece is gunlerinde islem gorur, USD/TRY de benzer sekilde. Ancak tatil gunleri farkli olabilir. Cozum:

- Her iki seri icin de `carry-forward` kullanilir (mevcut sistemle ayni)
- `normStart`'tan itibaren gun gun ilerlerken, o gun icin veri yoksa en son bilinen deger kullanilir
- Sadece her iki serinin de en az bir baslangic degeri oldugu durumda normalize edilir

## Etki Analizi

| Alan | Degisim |
|------|---------|
| Nasdaq100 cizgi grafigi | USD bazli -> TL bazli (kur etkisi dahil) |
| Nasdaq100 sutun grafigi | Ayni hook'u kullandigi icin otomatik olarak TL bazli olur |
| Diger benchmarklar | Degismez |
| USD benchmark cizgisi | Degismez (kendi basina normalize edilir) |
| API cagrilari | Nasdaq100 secildiginde USD/TRY verisi de otomatik cekilir |

## UI Notu

Su an icin ayri bir "USD/TL" toggle eklenmeyecek -- Nasdaq100 her zaman TL bazli gosterilecek. Ileride istenirse bir toggle eklenebilir. Tooltip'te ek aciklama olarak "(TL bazli)" ibaresi eklenebilir.

