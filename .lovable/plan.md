
# Benchmark Normalizasyonunun Zaman Aralığı Başından Yapılması

## Mevcut Durum

Şu an hem portföy çizgisi hem de benchmark'lar (Altın, USD, BIST100 vb.) aynı `effectiveStart` noktasından normalize ediliyor:

```
effectiveStart = max(t0, viewStartDate)
```

Bu şu anlama geliyor: t0 (ilk işlem tarihi) seçili zaman aralığının içine denk geliyorsa, benchmark'lar da o noktadan başlıyor — yani seçili aralığın gerçek başından değil.

## İstenen Davranış

Benchmark çizgileri (Altın, USD, EUR, BIST100, NASDAQ100, Enflasyon) her zaman seçili zaman aralığının tam başından (`startDate`) 100'den başlasın. Örneğin:

- Seçili aralık: 3 Ay
- 3 ay önceki Altın değeri = 100 kabul edilsin
- Bugünkü Altın değeri = 112 → grafik 100'den 112'ye çizilsin

Portföy çizgisi değişmez; mevcut `effectiveStart` mantığını korur.

## Teknik Değişiklik

**Tek dosya: `src/hooks/useEquityCurveData.ts`**

`benchmarkDataMaps` useMemo'sunda normalizasyon başlangıç noktası `effectiveStart` yerine `startDate` olacak:

### Önceki kod (satır ~440-457):
```ts
result[benchmarkId] = normalizeBenchmarkFromStartWithCarryForward(
  seriesData.points,
  effectiveStart,   // <-- burası değişiyor
  endDate
);
// inflation da effectiveStart kullanıyor
```

### Yeni kod:
```ts
result[benchmarkId] = normalizeBenchmarkFromStartWithCarryForward(
  seriesData.points,
  startDate,        // <-- seçili aralığın başı
  endDate
);
// inflation da startDate kullanılacak
```

Ayrıca `chartData` useMemo'sunda benchmark değerleri şu an `isBeforeEffective` koşuluyla null yapılıyor. Bu koşul benchmark'lar için artık `isBeforeStart` (yani `startDate`'ten önce mi?) olarak değerlendirilecek — ama zaten `currentDay = startDate`'ten başladığı için tüm benchmark değerleri gösterilecek.

## Etki Analizi

| Bileşen | Değişim |
|---------|---------|
| Portföy çizgisi | Değişmez, `effectiveStart`'tan normalize edilmeye devam eder |
| Altın, USD, EUR, BIST100, NASDAQ100, Enflasyon | Artık seçili aralığın başından (`startDate`) 100'den başlar |
| Tooltip karşılaştırması ("portföyün %X önünde") | Doğal olarak düzelir: her ikisi de kendi başlangıç noktasından ilerlediği için anlık fark gösterilir |

## Değişecek Dosya

| Dosya | Değişiklik |
|-------|-----------|
| `src/hooks/useEquityCurveData.ts` | `benchmarkDataMaps` useMemo'sunda `effectiveStart` → `startDate` |

Tek satırlık bir değişiklik olmasına rağmen davranışı önemli ölçüde düzeltiyor: t0 ne olursa olsun, benchmark'lar her zaman seçili aralığın başından senkron başlıyor.
