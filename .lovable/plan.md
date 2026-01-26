
# RapidAPI Entegrasyonunu Tamamen Kaldırma Planı

## Özet
RapidAPI BIST100 entegrasyonuna ait tüm dosyaları, referansları ve secret'ı kaldıracağız. Uygulama geçici olarak mock data kullanacak, ardından Yahoo Finance API entegrasyonu yapılacak.

---

## Kaldırılacak Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `supabase/functions/bist-prices/index.ts` | Edge Function - tamamen silinecek |
| `supabase/functions/bist-prices/` | Klasör - tamamen silinecek |
| `src/services/bistApi.ts` | API servis dosyası - tamamen silinecek |
| `src/hooks/useBistPrices.ts` | React Query hook - tamamen silinecek |

---

## Güncellenecek Dosyalar

### 1. `supabase/config.toml`
- `[functions.bist-prices]` bölümü kaldırılacak
- Sadece `project_id` satırı kalacak

### 2. `src/components/layout/TickerTape.tsx`
- `useBistPrices` import'u kaldırılacak
- Mock data (`MOCK_STOCKS`) kullanacak şekilde güncellenecek
- Geçici olarak statik veri gösterecek

### 3. `src/components/trade/StockSelector.tsx`
- `useBistPrices` import'u kaldırılacak
- `MOCK_STOCKS` kullanacak şekilde güncellenecek

### 4. `src/components/trade/TradeList.tsx`
- `useBistPrices` import'u kaldırılacak
- `getLastPrice` fonksiyonu mock data'dan okuyacak veya geçici olarak devre dışı bırakılacak

---

## Kaldırılacak Secret

| Secret | İşlem |
|--------|-------|
| `RAPIDAPI_KEY` | Supabase Edge Functions secrets'tan silinecek |

---

## Korunacak Dosyalar

| Dosya | Durum |
|-------|-------|
| `src/types/stock.ts` | **Korunacak** - Yahoo Finance için de kullanılabilir |
| `src/data/mockStocks.ts` | **Korunacak** - Geçici veri kaynağı olarak kullanılacak |

---

## Uygulama Adımları

1. **Edge Function silme**
   - `supabase/functions/bist-prices/` klasörünü tamamen sil
   - Supabase'ten deploy edilmiş fonksiyonu sil

2. **Config güncelleme**
   - `supabase/config.toml` dosyasından `[functions.bist-prices]` bölümünü kaldır

3. **Servis ve hook silme**
   - `src/services/bistApi.ts` dosyasını sil
   - `src/hooks/useBistPrices.ts` dosyasını sil

4. **Bileşenleri güncelleme**
   - `TickerTape.tsx`: Mock data kullan
   - `StockSelector.tsx`: Mock data kullan
   - `TradeList.tsx`: Güncel fiyat gösterimini geçici olarak devre dışı bırak

5. **Secret silme**
   - `RAPIDAPI_KEY` secret'ını Supabase'ten kaldır

---

## Geçiş Sonrası Durum

- Uygulama çalışmaya devam edecek (mock data ile)
- Ticker tape statik veri gösterecek
- Hisse seçimi çalışacak (mock listeden)
- Canlı fiyat takibi geçici olarak devre dışı kalacak

Yahoo Finance API entegre edildiğinde bu yapı yeniden aktif edilecek.

---

## Teknik Detaylar

### Silinecek Kod Yapısı

```text
supabase/
└── functions/
    └── bist-prices/        <- SİLİNECEK
        └── index.ts

src/
├── services/
│   └── bistApi.ts          <- SİLİNECEK
├── hooks/
│   └── useBistPrices.ts    <- SİLİNECEK
└── types/
    └── stock.ts            <- KORUNACAK
```

### Değiştirilecek Import'lar

TickerTape.tsx:
- Eski: `import { useBistPrices } from '@/hooks/useBistPrices'`
- Yeni: `import { MOCK_STOCKS } from '@/data/mockStocks'`

StockSelector.tsx:
- Eski: `import { useBistPrices } from '@/hooks/useBistPrices'`
- Yeni: `import { MOCK_STOCKS } from '@/data/mockStocks'`

TradeList.tsx:
- Eski: `import { useBistPrices } from '@/hooks/useBistPrices'`
- Yeni: Mock data kullanım veya fonksiyon devre dışı
