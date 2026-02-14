

# Kapanış Türünün Otomatik Belirlenmesi

## Değişiklik

Kullanıcının manuel olarak "Kâr Al" veya "Stop" seçmesi yerine, çıkış fiyatı girildiğinde sistem otomatik olarak belirleyecek:

- **ALIŞ işlemi:** Exit > Entry ise "Kâr Al", Exit < Entry ise "Stop", Exit = Entry ise "Stop"
- **SATIŞ işlemi:** Exit < Entry ise "Kâr Al", Exit > Entry ise "Stop", Exit = Entry ise "Stop"

## Teknik Değişiklikler - `src/components/trade/CloseTradeModal.tsx`

### Kaldırılacaklar:
- `closingType` state'i (`useState<ClosingType | null>(null)`) kaldırılacak
- "Kapanış Türü" başlığı ve Kâr Al / Stop butonları (satır 226-256) kaldırılacak

### Eklenecekler:
- `closingType` artık `useMemo` ile hesaplanacak: exit fiyatı girildiğinde trade_type'a göre otomatik belirlenir
- Butonlar yerine, belirlenen sonucu gösteren bir bilgi kutusu (badge/label) gösterilecek ("Kâr Al" veya "Stop" yazısı, rengiyle birlikte)

### Güncellenecekler:
- `isValid` kontrolünden `closingType !== null` yerine `closingType !== undefined` veya exit fiyatı kontrolü yapılacak
- Stop seçildiğinde stop sebepleri bölümü otomatik açılacak (mevcut mantık korunacak)
- `handleConfirm` fonksiyonu aynı kalacak, sadece closingType artık computed olacak

### Akış:
1. Kullanıcı çıkış fiyatını girer
2. Sistem otomatik olarak Kâr Al / Stop belirler ve ekranda gösterir
3. Stop ise stop sebepleri listesi otomatik açılır
4. Kullanıcı notu yazar ve onaylar

| Dosya | Değişiklik |
|-------|-----------|
| `src/components/trade/CloseTradeModal.tsx` | Manuel seçim butonlarını kaldır, useMemo ile otomatik closingType hesapla, sonucu bilgi kutusu olarak göster |

