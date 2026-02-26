

# Altin ve Gumus Gram Hesaplama Duzeltmesi

## Sorun

Stooq API'sinden gelen XAUTRY ve XAGTRY fiyatlari **troy ons** (31.1035 gram) bazindadir. Ancak `usePortfolioValueData` hook'u bu fiyati dogrudan boler gibi kullaniyor:

```
value = valueTL / lastCurrencyRate
```

Ornek: 105.392 TL / 224.000 TL/ons = 0,47 ons seklinde hesaplaniyor ama tooltip'te "gr" (gram) olarak gosteriliyor. Dogru hesap: 105.392 / (224.000 / 31.1035) = ~14,6 gram olmali.

## Cozum

**Dosya:** `src/hooks/usePortfolioValueData.ts`

Kur donusumu yapilan satirda (228. satir), altin ve gumus icin ons fiyatini gram fiyatina cevirmek gerekiyor:

```typescript
const TROY_OUNCE_TO_GRAM = 31.1035;

// Currency conversion
if (currencyMap) {
  const rate = currencyMap.get(key);
  if (rate !== undefined && rate > 0) lastCurrencyRate = rate;
  
  // Gold and silver prices from Stooq are per troy ounce, convert to per gram
  const effectiveRate = (selectedCurrency === 'gold' || selectedCurrency === 'silver')
    ? lastCurrencyRate / TROY_OUNCE_TO_GRAM
    : lastCurrencyRate;
  
  value = valueTL / effectiveRate;
}
```

Bu sayede:
- **Altin**: 105.392 TL / (224.000 / 31.1035) = ~14,6 gram (dogru)
- **Gumus**: Ayni mantikla gram bazinda dogru hesaplanacak
- **USD/EUR**: Hicbir degisiklik yok

## Etki

- Sadece `src/hooks/usePortfolioValueData.ts` dosyasinda tek bir degisiklik
- Diger grafiklerdeki benchmark karsilastirmalari bu hook'u kullanmadigi icin etkilenmez
- Tooltip formati zaten "gr" gosteriyor, sadece deger dogru olacak

