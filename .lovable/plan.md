

# EVDS3 API Gecisi ve Enflasyon Verisi Duzeltmesi

## Sorun

TCMB, Ocak 2026'da EVDS 2'den EVDS 3'e gecis yapti. Mevcut kod `evds2.tcmb.gov.tr` adresini ve `TP.FE.OKTG01` serisini kullaniyor — bu endpoint artik HTML donduruyor (JSON yerine), bu yuzden enflasyon verisi hep fallback'e dusuyor.

## Cozum

`supabase/functions/market-series/index.ts` dosyasindaki `fetchInflationData` fonksiyonunu guncelleyerek:

### 1. EVDS3 API Endpoint'ine Gec
- **Eski:** `https://evds2.tcmb.gov.tr/service/evds/series=TP.FE.OKTG01&...`
- **Yeni:** `https://evds3.tcmb.gov.tr/igmevdsms-dis/series=TP.FG.J0&startDate=...&endDate=...&type=json&frequency=5&formulas=1`
- API key hala HTTP header'da: `key: {EVDS_API_KEY}`

### 2. Response Field Adini Guncelle
- **Eski:** `item.TP_FE_OKTG01` (noktalar alt cizgi oluyordu)
- **Yeni:** `item.TP_FG_J0` (yeni seri kodu icin)

### 3. Content-Type Kontrolu Ekle
- `response.json()` oncesi `content-type` header'ini kontrol et
- HTML yanit gelirse acik hata mesaji logla ve fallback'e dus

### 4. Fallback Verisini Guncelle
- Subat 2026: 2.27%, Mart 2026: 2.46% gercek TUiK verileri ekle (zaten mevcut)
- Nisan 2026 tahmini guncelle

### 5. Eski EVDS2'yi Yedek Olarak Tut
- Once EVDS3'u dene, basarisiz olursa EVDS2'yi dene, o da basarisiz olursa fallback'e dus

## Teknik Degisiklik (tek dosya)

```typescript
// fetchInflationData icinde:
// 1. Once EVDS3 dene
const url3 = `https://evds3.tcmb.gov.tr/igmevdsms-dis/series=TP.FG.J0&startDate=${startStr}&endDate=${endStr}&type=json&frequency=5&formulas=1`;

const response = await fetch(url3, {
  headers: {
    "key": apiKey,
    "Accept": "application/json",
  },
});

// Content-type kontrolu
const ct = response.headers.get("content-type") || "";
if (!ct.includes("json")) {
  throw new Error("EVDS3 returned non-JSON (likely HTML)");
}

// 2. Field adi: TP_FG_J0
const value = parseFloat(item.TP_FG_J0);
```

## Etki
- Enflasyon verisi gercek zamana yakin guncellenecek (aylik)
- Mevcut `EVDS_API_KEY` secret'i ayni kalacak
- Diger varlik verileri (altin, gumus, USD, EUR, BIST100, NASDAQ100) etkilenmeyecek
- Fallback verisi son care olarak korunacak

