

# XU100 ve XU030 Endeks Verisi Entegrasyonu

## Ozet

Bigpara (hurriyet.com.tr) endeksler sayfasindan XU100 ve XU030 anlik verilerini cekecek yeni bir edge function olusturulacak. XU100 degeri Bakiye ile Son: arasinda gosterilecek, XU030 ise StockSelector'da hisselerin en ustunde yer alacak ve islem acilabilecek.

## Veri Kaynagi

**Bigpara Endeksler Sayfasi**: `https://bigpara.hurriyet.com.tr/borsa/endeksler/`

HTML yapisi dogrulanmistir. Her endeks bir `<ul>` satirinda ve `<li>` hucrelerdedir:
- Hucre 1: Sembol (XU100, XU030 vb.)
- Hucre 2: Son deger (ornek: 13.810)
- Hucre 3: Onceki kapanis
- Hucre 4: Degisim yuzde (ornek: -1,71)
- Hucre 5: En yuksek
- Hucre 6: En dusuk

Bu sayfa API key gerektirmez, dogrudan HTML scrape edilir.

## Degisiklikler

### 1. Yeni Edge Function: `supabase/functions/bist-indices/index.ts`

Bigpara endeksler sayfasini scrape edip sadece XU100 ve XU030 verilerini donduren edge function:
- 60 saniyelik in-memory cache (mevcut bist100 patterniyle ayni)
- CORS headers
- Dondurulecek veri formati:

```text
{
  updatedAt: "...",
  indices: {
    XU100: { last: 13810, chgPct: -1.71 },
    XU030: { last: 15439, chgPct: -1.42 }
  }
}
```

### 2. `supabase/config.toml` guncelleme

```text
[functions.bist-indices]
verify_jwt = false
```

### 3. MarketDataContext'e endeks verileri ekleme

`src/contexts/MarketDataContext.tsx` icine:
- `xu100` ve `xu030` state'leri ekleme (last, chgPct)
- `bist-indices` edge function'ini cagiran fetch ekleme (bist100 ile ayni polling cycle)
- Context'e `xu100` ve `xu030` degerlerini expose etme

### 4. MainLayout'ta XU100 gosterimi

`src/components/layout/MainLayout.tsx`:
- Bakiye ile MarketDataStatus (Son:) arasina XU100 degeri ekleme
- Masaustunde: Bakiye ... XU100 ... Son: seklinde yatay hizada
- Mobilde: Bakiye ve Son: arasinda ortalanmis
- Yesil/kirmizi renk chgPct'ye gore
- Format: "XU100 13.810 -1,71%" seklinde kompakt gosterim

```text
Mobil gorunum (tek satir):
[Bakiye: 50.000]  [XU100 13.810 -1.71%]  [Son: 18:10 (refresh)]
```

### 5. StockSelector'da XU030 ekleme

`src/components/trade/StockSelector.tsx`:
- Hisse listesinin en ustune XU030 endeksini sabit olarak ekleme
- MarketDataContext'ten xu030 verisini cekme
- Ozel bir badge/etiketle "Endeks" olarak isaretleme
- Tiklandiginda normal hisse gibi TradeForm'a gondermesi icin Stock formatina donusturme

## Teknik Degisiklikler Ozeti

| Dosya | Degisiklik |
|-------|-----------|
| `supabase/functions/bist-indices/index.ts` | Yeni edge function - bigpara scrape |
| `supabase/config.toml` | `bist-indices` verify_jwt = false |
| `src/contexts/MarketDataContext.tsx` | xu100/xu030 state + fetch + expose |
| `src/components/layout/MainLayout.tsx` | XU100 gosterimi bakiye ile son arasinda |
| `src/components/trade/StockSelector.tsx` | XU030 endeksini listenin basina ekleme |

Toplam 5 dosya degisikligi. Mevcut islevsellige dokunulmaz, sadece yeni veri katmani eklenir.
