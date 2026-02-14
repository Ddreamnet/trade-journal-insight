

# Sebepler Gorunumu, Lot Sutunu ve Entry/Target Turkcelestirme

## 1. Sebepler Sutunu - Alt Alta Gosterim (Masaustu)

Su an sebepler "..." ile kisaltilip tooltip ile gosteriliyor. Bunun yerine her sebep ayri satir olarak gorunecek, kart/satir boyu asagi dogru uzayabilecek.

**Degisiklik yerleri:**

### `src/components/trade/TradeList.tsx`

**Aktif portfoy masaustu tablosu (DesktopTable, satir ~284-298):**
- Tooltip + `line-clamp-2` yapisi kaldirilacak
- Yerine `getReasonLabels` fonksiyonu virgullu string yerine sebep dizisi dondurecek (yeni helper: `getReasonLabelsList`)
- Her sebep `<div>` icinde alt alta listelenecek

**Kapali portfoy masaustu tablosu (ClosedEntriesDesktopTable, satir ~574-583):**
- Ayni degisiklik: Tooltip kaldirilacak, sebepler alt alta listelenecek

**Not:** Mobil kartlarda sebepler zaten sararak gorunuyor, orada da ayni degisiklik uygulanacak (satirlar ~504-506 ve ~665-667).

### Yeni helper fonksiyon:
```
getReasonLabelsList(reasonIds: string[]): string[]
```
Mevcut `getReasonLabels` virgullu string donduruyor. Yeni fonksiyon dizi dondurecek, her eleman bir satir olacak.

## 2. Lot Sutunu Eklenmesi

### Aktif portfoy masaustu tablosu (DesktopTable):
- Tur ve Entry (Giris) sutunlari arasina "Lot" sutunu eklenecek
- Deger: `trade.remaining_lot` (aktif hissede kalan lot)
- Eger `trade.remaining_lot < trade.lot_quantity` ise, yani kismi kapanis yapilmissa, farkli renkte gosterilecek

### Kapali portfoy masaustu tablosu (ClosedEntriesDesktopTable):
- Zaten Lot sutunu mevcut, degisiklik gerekmez

### Aktif portfoy mobil kartlari:
- Fiyat grid'ine Lot bilgisi eklenecek

## 3. Entry -> Giris, Target -> Hedef Degisikligi

Asagidaki dosyalardaki tum gorunen "Entry" ve "Target" etiketleri degisecek:

| Dosya | Entry -> | Target -> |
|-------|----------|-----------|
| `TradeList.tsx` | Giris | Hedef |
| `TradeForm.tsx` | Giris | Hedef |
| `EditTradeModal.tsx` | Giris | Hedef |
| `CloseTradeModal.tsx` | Giris | Hedef |

**Not:** Sadece kullaniciya gorunen etiket metinleri degisecek. Degisken adlari (entryPrice, targetPrice vb.) ve veritabani alan adlari aynen kalacak.

## Degisecek Dosyalar Ozeti

| Dosya | Degisiklikler |
|-------|--------------|
| `src/components/trade/TradeList.tsx` | Sebepler alt alta, Lot sutunu ekleme, Entry->Giris, Target->Hedef |
| `src/components/trade/TradeForm.tsx` | Entry->Giris, Target->Hedef (etiketler) |
| `src/components/trade/EditTradeModal.tsx` | Entry->Giris, Target->Hedef (etiketler) |
| `src/components/trade/CloseTradeModal.tsx` | Entry->Giris, Target->Hedef (etiketler) |

