

# Toplam İşlem Kartını İkiye Bölme

## Değişiklik

İlk stats kartı ("Toplam İşlem") ikiye bölünecek — tıpkı en sondaki Başarılı/Başarısız kartı gibi dikey separator ile ayrılacak.

- **Sol:** Toplam İşlem sayısı (mevcut)
- **Sağ:** Toplam RR (tüm kapalı işlemlerin `getClosedRR` sonuçlarının toplamı)

## Teknik Adımlar

### 1. Stats hesaplamasına `totalRR` ekle (`Reports.tsx`)
- `useMemo` içinde `closedInRange` üzerinde `getClosedRR` fonksiyonunu çağır, null olmayanları topla
- `getClosedRR`'ı `@/lib/tradeUtils` dosyasından import et
- Return objesine `totalRR` ekle

### 2. Toplam İşlem kartının UI'ını güncelle
- Mevcut tek değerli kartı, Başarılı/Başarısız kartındaki iki sütunlu yapıya dönüştür
- Sol: BarChart3 ikonu + "Toplam İşlem" + sayı
- Sağ: Uygun ikon + "Toplam RR" + toplam RR değeri (pozitifse yeşil, negatifse kırmızı)
- Araya `<Separator orientation="vertical" />` koy

### Dosya: `src/pages/Reports.tsx` (tek dosya değişikliği)

