

# BIST 100'den BIST TUM'e Gecis (Bigpara Kaynagi)

## Neden Hangikredi Kullanilamaz?

Hangikredi'nin BIST 500 sayfasi JavaScript ile render ediliyor - sayfa HTML'inde tablo verisi bos geliyor. BIST 100 sayfasi ise server-side rendered oldugu icin scrape edilebiliyordu. Bu nedenle BIST 500/TUM icin farkli bir kaynak kullanmak gerekiyor.

## Cozum

**Bigpara BIST TUM** sayfasi (`bigpara.hurriyet.com.tr/borsa/canli-borsa/bist-tum/`) 500+ hisseyi server-side rendered HTML olarak sunuyor. Mevcut `bist100` edge function'in parsing mantigi Bigpara'ya uyarlanacak. Logo URL'leri icin Hangikredi CDN pattern'i kullanilacak.

## Bigpara HTML Yapisi

Her hisse bir `<ul class="live-stock-item" data-symbol="AKBNK">` icinde:
- **Sembol**: `data-symbol` attribute
- **Son fiyat**: `<li class="... node-c">91,00</li>`
- **Yuksek**: `<li class="... node-h">92,85</li>`
- **Dusuk**: `<li class="... node-i">89,75</li>`
- **Degisim %**: `<li class="... node-e">-0,6</li>`
- **Saat**: `<li class="... node-s">18:10:00</li>`

## Degisiklikler

### 1. Edge Function Guncelleme: `supabase/functions/bist100/index.ts`

Tek dosya degisikligi. Icerik tamamen yeniden yazilacak:

- **URL**: `https://bigpara.hurriyet.com.tr/borsa/canli-borsa/bist-tum/` olarak guncellenecek
- **Parsing**: Bigpara'nin `<ul class="live-stock-item" data-symbol="...">` yapisina gore yeni regex'ler yazilacak
- **Logo URL'leri**: Her sembol icin `https://cdn.hangikredi.com/symbols/{symbol_lowercase}.png` pattern'i kullanilacak (mevcut logolarin kaynagi ayni CDN)
- **Response formati**: Tamamen ayni kalacak (`{ updatedAt, source, items: [{ symbol, last, low, high, chg, chgPct, time, logoUrl }] }`)
- **Cache TTL**: 60 saniye (degismiyor)

### 2. Frontend Degisikligi: YOK

Response formati birebir ayni kaldigi icin:
- `MarketDataContext.tsx` - degisiklik yok
- `StockSelector.tsx` - degisiklik yok
- `StockLogo.tsx` - degisiklik yok (logoUrl prop'u ile calisiyor, fallback destegi mevcut)
- `TradeForm.tsx` - degisiklik yok

## Teknik Ozet

| Dosya | Degisiklik |
|-------|-----------|
| `supabase/functions/bist100/index.ts` | Veri kaynagi Bigpara'ya gecis, parsing mantigi guncelleme, logo URL ekleme |

Toplam 1 dosya degisikligi. Frontend'e dokunulmaz. ~100 hisse yerine ~500+ hisse gelecek, diger her sey ayni calisacak.

