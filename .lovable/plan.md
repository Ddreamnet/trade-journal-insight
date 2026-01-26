
# Stooq Tarihsel Veri Entegrasyonu Planı

## Özet
Raporlarım sayfasındaki grafikler için Stooq'tan tarihsel fiyat serisi çekip, benchmark karşılaştırmasını gerçek verilerle yapacağız.

---

## Mimari Tasarım

```text
┌─────────────────────────────────────────────────────────────────┐
│                          Frontend                                │
├─────────────────────────────────────────────────────────────────┤
│  MarketSeriesProvider (yeni context)                            │
│  ├── 1 yıllık veriyi tek sefer çeker                            │
│  ├── Asset bazlı cache (gold, usd, eur, bist100, nasdaq100)     │
│  └── Timeframe filtreleme client-side yapılır                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              /api/market-series.php (cPanel)                    │
├─────────────────────────────────────────────────────────────────┤
│  ├── Query: ?asset=gold|usd|eur|bist100|nasdaq100               │
│  ├── Stooq CSV fetch → JSON dönüşüm                             │
│  ├── 30 dk file cache (asset bazlı)                             │
│  └── Fallback: eski cache varsa döndür                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Stooq CSV (ücretsiz, API key yok)                  │
│              https://stooq.com/q/d/l/?s={SYMBOL}&i=d            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Oluşturulacak Dosyalar

### 1. PHP Backend Endpoint

**Dosya:** `api/market-series.php`

| Özellik | Detay |
|---------|-------|
| Cache süresi | 30 dakika |
| Cache yolu | `api/cache/market-series-{asset}.json` |
| Stooq formatı | CSV (Date, Open, High, Low, Close, Volume) |
| Çıktı | JSON `{ asset, updatedAt, points: [{date, value}] }` |
| Hata durumu | HTTP 502 + eski cache fallback |

**Asset → Stooq Symbol Mapping:**
- `gold` → `xautry` (Ons Altın / TRY)
- `usd` → `usdtry`
- `eur` → `eurtry`
- `bist100` → `^xu100`
- `nasdaq100` → `^ndx`

### 2. Supabase Edge Function (Geliştirme/Preview için)

**Dosya:** `supabase/functions/market-series/index.ts`

PHP ile aynı mantığı Deno'da implement edecek. Preview ortamında çalışması için gerekli.

### 3. Market Series Context

**Dosya:** `src/contexts/MarketSeriesContext.tsx`

| Özellik | Detay |
|---------|-------|
| State | `Record<Asset, SeriesData>` |
| Fetch stratejisi | Lazy load (asset seçilince fetch) |
| Cache | localStorage + in-memory |
| Polling | Yok (statik günlük veri) |

### 4. Yeni Type Tanımları

**Dosya:** `src/types/market.ts` (güncelleme)

```typescript
export type MarketAsset = 'gold' | 'usd' | 'eur' | 'bist100' | 'nasdaq100';

export interface MarketSeriesPoint {
  date: string; // YYYY-MM-DD
  value: number; // Close price
}

export interface MarketSeriesData {
  asset: MarketAsset;
  updatedAt: string;
  points: MarketSeriesPoint[];
}
```

---

## Güncellenecek Dosyalar

### 1. `src/components/reports/WinRateChart.tsx`

| Değişiklik | Detay |
|------------|-------|
| Mock veri kaldır | Random gold/usd/eur değerleri yerine gerçek veri |
| Context kullan | `useMarketSeries` hook'u ile veri al |
| Normalize et | Tüm seriler 100 baz değerinden başlasın |
| Timeframe filtre | 1y verisinden client-side kırp |

### 2. `src/pages/Reports.tsx`

| Değişiklik | Detay |
|------------|-------|
| Provider wrap | `MarketSeriesProvider` ekle (veya App.tsx'e) |
| Loading state | Benchmark yüklenirken skeleton göster |

### 3. `src/App.tsx`

| Değişiklik | Detay |
|------------|-------|
| Provider ekle | `MarketSeriesProvider` sarmalayıcı ekle |

### 4. `src/types/trade.ts`

| Değişiklik | Detay |
|------------|-------|
| BENCHMARKS güncelle | id'leri market series asset'leriyle eşle |

---

## Veri Akışı

```text
1. Kullanıcı "Altın" benchmark'ını seçer
2. WinRateChart → useMarketSeries('gold') çağırır
3. Context cache kontrol eder
   ├── Cache varsa → direkt döndür
   └── Cache yoksa → Edge Function fetch
4. Edge Function → Stooq CSV çeker, parse eder
5. JSON response → Context state'e yaz
6. WinRateChart → 1y verisinden timeframe'e göre filtrele
7. Grafikte göster (100 bazlı normalize edilmiş)
```

---

## Timeframe Filtreleme Mantığı

Tüm veri 1 yıllık olarak çekilecek. Timeframe değiştiğinde yeniden fetch yapılmayacak:

| Timeframe | Filtreleme |
|-----------|------------|
| 1 Hafta | Son 7 gün |
| 1 Ay | Son 30 gün |
| 3 Ay | Son 90 gün |
| 6 Ay | Son 180 gün |
| 1 Sene | Tüm veri |

---

## Normalleştirme

Benchmark karşılaştırması için tüm seriler 100 bazından başlayacak:

```text
normalizedValue = (currentPrice / firstPrice) * 100
```

Örnek: Altın 2000'den 2200'e çıktıysa → 100'den 110'a

---

## Uygulama Adımları

1. **Type güncellemeleri**
   - `src/types/market.ts` dosyasına yeni interface'ler ekle

2. **Edge Function oluştur**
   - `supabase/functions/market-series/index.ts`
   - Stooq CSV fetch ve parse
   - 30 dk in-memory cache

3. **PHP endpoint oluştur**
   - `api/market-series.php`
   - File-based cache
   - cPanel uyumlu

4. **Context oluştur**
   - `src/contexts/MarketSeriesContext.tsx`
   - Asset bazlı lazy loading
   - localStorage persistence

5. **WinRateChart güncelle**
   - Mock data kaldır
   - Gerçek veri entegrasyonu
   - Normalize ve filtre mantığı

6. **App.tsx güncelle**
   - Provider ekle

---

## Teknik Detaylar

### Stooq CSV Formatı

```csv
Date,Open,High,Low,Close,Volume
2024-01-15,32.5,33.1,32.2,33.0,1234567
2024-01-16,33.0,33.5,32.8,33.2,1345678
...
```

### Edge Function Örnek Response

```json
{
  "asset": "gold",
  "updatedAt": "2025-01-26T10:30:00Z",
  "points": [
    { "date": "2024-01-26", "value": 2850.5 },
    { "date": "2024-01-27", "value": 2865.2 },
    ...
  ]
}
```

### Cache Dosya Yapısı (PHP)

```text
api/
├── market-series.php
└── cache/
    ├── market-series-gold.json
    ├── market-series-usd.json
    ├── market-series-eur.json
    ├── market-series-bist100.json
    └── market-series-nasdaq100.json
```

---

## Hata Durumları

| Senaryo | Davranış |
|---------|----------|
| Stooq timeout | Eski cache döndür (varsa) |
| Parse hatası | HTTP 502 + error message |
| Asset bulunamadı | HTTP 400 + "Invalid asset" |
| Cache eski | Stale data + background refresh |

---

## Öneriler ve Notlar

1. **NASDAQ100 (`^ndx`)** USD cinsindendir, TRY karşılaştırması için döviz çevirisi gerekebilir. Şimdilik ham değer kullanılacak.

2. **Rate Limiting**: Stooq'un resmi rate limit'i yok ama aşırı istek atılmamalı. 30 dk cache yeterli.

3. **Hafta sonu verisi**: Stooq sadece iş günleri için veri döndürür. Grafik bunu handle edecek.

4. **PHP endpoint**: Preview'da çalışmayacak, sadece cPanel deploy'unda aktif olacak. Bu nedenle Edge Function paralel tutulacak.
