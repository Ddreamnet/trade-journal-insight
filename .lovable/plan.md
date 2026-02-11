

# Plan: Portfoy Cizgisine Unrealized PnL Ekleme (Canli Fiyat Serisi)

## Sorun

1. grafikteki portfoy cizgisi su an sadece realized PnL (kapanis olaylari) ile guncelleniyor. Bir trade acikken cizgi duz kaliyor cunku gunluk fiyat verisi yok.

## Cozum Ozeti

```text
1. Yeni Edge Function: stock-series (Yahoo Finance uzerinden BIST hisse gunluk kapanis)
2. Yeni Hook: useStockPriceSeries (ihtiyac duyulan sembolleri tespit et, fiyat serisi cek)
3. useEquityCurveData guncelleme: realized + unrealized PnL hesabi
4. Fallback: fiyat verisi yoksa lineer interpolasyon (entry -> exit arasi esit dagitim)
```

---

## 1. Edge Function: `stock-series`

### Amac

Yahoo Finance Chart API uzerinden BIST hisselerinin gunluk kapanis fiyatlarini cek.

### API Formati

```text
GET https://query1.finance.yahoo.com/v8/finance/chart/{SYMBOL}.IS?range=3y&interval=1d
```

Yahoo Finance yaniti: JSON icinde `timestamp[]` ve `indicators.quote[0].close[]` dizileri.

### Endpoint Tasarimi

```text
GET /stock-series?symbols=AKSEN,EUPWR&range=3y
```

- Birden fazla sembol virgul ile gonderilir (tek istekte toplu cekme).
- Her sembol icin ayri Yahoo Finance cagrisi yapilir (paralel).
- Yanit: `{ [symbol]: { points: [{date, value}], source } }`.

### Cache

- In-memory cache: sembol bazinda 30 dakika (benchmark'larla ayni).
- Ayni sembol tekrar istenirse cache'den doner.

### Hata Yonetimi

- Yahoo Finance erisim sorunlarinda sembol icin bos dizi doner (`points: []`).
- Edge function tamamen basarisiz olursa client tarafinda fallback devreye girer.

### Dosya

- `supabase/functions/stock-series/index.ts` (yeni)

---

## 2. Hook: `useStockPriceSeries`

### Amac

Grafik penceresi icinde pozisyonu olan sembolleri tespit et ve fiyat serisi cek.

### Sembol Tespiti

```text
Tum trades (active + closed) taranir.
Bir trade'in grafik penceresinde "aktif pozisyonu" varsa:
  - created_at < endDate VE (closed_at > startDate VEYA status === 'active')
Bu trade'lerin stock_symbol'leri benzersiz listeye alinir.
```

### Cekme Mantigi

- `useQuery` ile `/stock-series?symbols=AKSEN,EUPWR&range=3y` endpoint'ine tek istek.
- Query key: `['stock-price-series', symbolsKey]` (sembol listesi degismedikce tekrar cekmez).
- Yanit: `Map<string, Map<string, number>>` (symbol -> dateKey -> closePrice).

### Carry-Forward

- Hafta sonu / tatil gunlerinde veri yoksa son bilinen kapanis fiyati kullanilir.
- Hook seviyesinde gunluk Map olusturulurken carry-forward uygulanir.

### Dosya

- `src/hooks/useStockPriceSeries.ts` (yeni)

---

## 3. `useEquityCurveData` Guncelleme

### Yeni Parametre

```typescript
// Mevcut:
useEquityCurveData(timeRange, selectedBenchmarks, closedTrades, startingCapital, partialCloses)

// Yeni:
useEquityCurveData(timeRange, selectedBenchmarks, closedTrades, startingCapital, partialCloses,
  allTrades,            // tum trade'ler (active dahil)
  stockPriceMap,        // Map<symbol, Map<dateKey, price>>
  priceDataMissing      // string[] — fiyat verisi cekilemeyen semboller
)
```

### Hesap Mantigi (Her Gun Icin)

```text
portfolioValue(gun) = startingCapital + realizedPnL(gun) + unrealizedPnL(gun)

realizedPnL(gun):
  - Su ana kadar gerceklesen tum partial close realized_pnl toplami
  - (Mevcut step mantigi aynen korunur)

unrealizedPnL(gun):
  - O gunde ACIK olan her trade icin:
    - Trade created_at <= gun VE (closed_at > gun VEYA hala active)
    - remaining_lot_at(gun) hesapla:
      - lot_quantity - SUM(partial_close lots where pc.created_at <= gun)
    - price = stockPriceMap.get(symbol)?.get(gun) || entry_price
    - Long:  (price - entry_price) * remaining_lot_at(gun)
    - Short: (entry_price - price) * remaining_lot_at(gun)
  - Tum open trade'lerin unrealized PnL'i toplanir

portfolioIndex = 100 * (portfolioValue / startingCapital)
```

### remaining_lot_at(gun) Hesabi

Her trade icin partial_closes'lari tarihe gore sirala. O gune kadar kapanan lotlari cikar:

```text
remaining_lot_at(gun) = trade.lot_quantity - SUM(pc.lot_quantity WHERE pc.trade_id = trade.id AND pc.created_at <= gun)
```

Bu hesap icin `PartialCloseRecord` interface'ine `lot_quantity` alani eklenir.

### Fallback (Fiyat Verisi Yoksa)

Eger bir sembol icin `stockPriceMap`'te veri yoksa:
- Trade kapanmissa: entry ile exit arasinda lineer interpolasyon (estimated)
- Trade hala aciksa: entry fiyatinda sabit (duz cizgi, eski davranis)
- Bu "estimated" yaklasimdaki ilgili donemlerde cizgi stili farkli olmaz ama tooltip'te "(tahmini)" notu gosterilir

### Normalizasyon

Normalizasyon aynen korunur: effectiveStart'taki portfolioIndex degeri = 100.

### Degisecek Dosya

- `src/hooks/useEquityCurveData.ts`

---

## 4. Reports.tsx ve EquityCurveChart Guncellemeleri

### Reports.tsx

- `useStockPriceSeries` hook'unu cagir (trades + timeRange ile).
- `partialCloses` query'sine `lot_quantity` alani ekle.
- `allTrades` ve `stockPriceMap` + `priceDataMissing` degerlerini EquityCurveChart'a aktar.

### EquityCurveChart.tsx

- Yeni prop'lari al ve `useEquityCurveData`'ya ilet.
- `priceDataMissing` listesi dolu ise kucuk bir uyari goster: "X sembol icin fiyat verisi alinamadi".

### Degisecek Dosyalar

- `src/pages/Reports.tsx`
- `src/components/reports/EquityCurveChart.tsx`

---

## 5. PartialCloseRecord Guncelleme

Mevcut interface:
```typescript
interface PartialCloseRecord {
  id: string;
  trade_id: string;
  realized_pnl: number | null;
  created_at: string;
}
```

Yeni:
```typescript
interface PartialCloseRecord {
  id: string;
  trade_id: string;
  realized_pnl: number | null;
  lot_quantity: number;  // eklendi
  created_at: string;
}
```

Reports.tsx'teki query'de `lot_quantity` alani eklenir.

---

## Uygulama Sirasi

| Adim | Is | Gerekce |
|------|----|---------|
| 1 | Edge Function: `stock-series` olustur + deploy | Veri kaynagi hazir olmali |
| 2 | `useStockPriceSeries` hook olustur | Veri katmani |
| 3 | `PartialCloseRecord`'a lot_quantity ekle + Reports query guncelle | Veri yapisi |
| 4 | `useEquityCurveData` refactor: realized + unrealized + fallback | Ana hesap degisikligi |
| 5 | Reports.tsx + EquityCurveChart prop'larini guncelle + uyari mesaji | UI entegrasyonu |

---

## Performans Notlari

- Edge function'da in-memory cache (30 dk) ile tekrar API cagrisi onlenir.
- Client tarafinda `useQuery` cache ile sayfa acikken veri tekrar cekilmez.
- Sembol listesi sadece grafik penceresinde pozisyonu olan trade'lerden uretilir (gereksiz sembol cekmez).
- Hook `useMemo` ile gun basi hesaplamalari optimize eder.

---

## Test Kontrol Listesi

- [ ] 7 Sub acilis, 11 Sub kapanis isleminde 7-11 arasi cizgi duz OLMAMALI; gunluk fiyata gore dalgalanmali
- [ ] 11 Sub kapanisinda realized PnL dogru oturmali (cizgi adim yapmali)
- [ ] Partial close sonrasi remaining lot azalmali ve unrealized PnL buna gore hesaplanmali
- [ ] Aktif (kapanmamis) trade'lerin unrealized PnL'i bugunun fiyatiyla gosterilmeli
- [ ] TimeRange degistiginde normalizasyon (baslangic=100) dogru calismali
- [ ] Fiyat verisi cekilemeyen sembol icin uyari mesaji goruntulenmeli
- [ ] Fiyat verisi yoksa fallback (lineer interpolasyon) devreye girmeli
- [ ] Benchmark cizgileri ve diger grafikler/kartlar degismemeli
- [ ] Deposit/withdraw nakit akislari 1. grafik portfoy cizgisini etkilememeli
- [ ] Mobilde grafik duzgun gorunmeli
- [ ] Edge function cache calismali (ayni sembol 30 dk icinde tekrar cekilmemeli)

