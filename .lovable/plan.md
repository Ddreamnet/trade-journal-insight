# Varlık Yönetimi ve Raporlarım Yeniden Tasarımı

## Genel Bakış

Bu plan 4 ana bileşenden oluşuyor:

1. Yeni veritabanı tablosu: `user_assets`
2. "Portföy Ekle/Çıkar" diyaloğunun baştan yeniden tasarımı
3. Yeni "Çevirici (Exchange)" butonu ve diyaloğu
4. Raporlarım'a "Varlıklarım" pie chart eklenmesi

---

## 1. Veritabanı Değişiklikleri

### Yeni tablo: `user_assets`

Her varlık kaydı için ayrı bir satır tutacak:

```text
user_assets
-----------
id            uuid (PK)
user_id       uuid
category      text  -- 'cash', 'real_estate', 'commodity'
asset_type    text  -- 'usd', 'eur', 'konut', 'isyeri', 'arsa', 'bitcoin', 'ethereum', 'altin', 'gumus'
amount_usd    numeric  -- USD bazında değer (TL için null)
amount_tl     numeric  -- Sadece Nakit>TL için dolu (portfolio_cash_flows ile senkron)
note          text (nullable)
created_at    timestamptz
updated_at    timestamptz
```

**Kritik not:** Nakit > TL işlemleri mevcut `portfolio_cash_flows` tablosuna eklenmaya devam eder. `user_assets` tablosu sadece USD/EUR/Gayrimenkul/Emtia için kullanılır. TL bakiye kaynağı değişmez.

**RLS:** Her kullanıcı sadece kendi kayıtlarını görebilir/ekleyebilir/silebilir/güncelleyebilir.

---

## 2. Yeni Hook: `useUserAssets`

`src/hooks/useUserAssets.ts` dosyası oluşturulacak:

- `user_assets` tablosundan veri çekme
- Varlık ekleme (`addAsset` mutation)
- Varlık güncelleme (`updateAsset` mutation)
- Varlık silme veya miktarı azaltma (`reduceAsset` mutation) — Exchange satışı için
- USD bazlı toplam hesaplama

---

## 3. Portföy Ekle/Çıkar Diyaloğu Yeniden Tasarımı

`src/components/trade/CashFlowModal.tsx` tamamen baştan yazılacak.

### Diyalog akışı (3 adım):

**Adım 1 — Kategori Seçimi:**

- Yan yana 3 buton: Nakit | Gayrimenkul | Emtia

**Adım 2A — Nakit seçilirse:**

- Yan yana 3 seçenek: TL | USD | EUR
- Tutar input'u
- TL seçilirse: mevcut `portfolio_cash_flows`'a deposit kaydı (kullanılabilir bakiyeye eklenir)
- USD/EUR seçilirse: `user_assets`'e kayıt (bakiyeye eklenmez, sadece varlık)

**Adım 2B — Gayrimenkul seçilirse:**

- Yan yana 3 seçenek: Konut | İşyeri | Arsa
- Değer input'u (USD bazında)
- `user_assets`'e kayıt

**Adım 2C — Emtia seçilirse:**

- Seçenekler: Bitcoin | Ethereum | Altın | Gümüş
- Altın için: `market-series` edge function'dan güncel XAUTRY ve USDTRY kuru çekilerek altın USD değeri hesaplanır, pre-fill edilir (kullanıcı override edebilir)
- Diğerleri: Manuel USD değer girişi (Bitcoin/Ethereum/Gümüş için "ileride otomatik fiyat eklenecek" notu)
- `user_assets`'e kayıt

**Diyaloğun alt kısmı — Geçmiş İşlemler:**

- Mevcut TL nakit akışları + `user_assets` kayıtları kronolojik olarak listelenir

### "Portföy Çıkar" (Para Çekme) kısmı:

- Mevcut TL çekme işlevi korunur (sadece TL çekilebilir)
- Bu tab aynen kalır

### UI detayları:

- Adım adım akış: kategori → tür → tutar → kaydet
- Animasyonlu geçişler (slide/fade)
- Her adımda geri butonu
- Negatif/sıfır değer girişi engellenir
- Başarı mesajı sonrası diyalog kapanır veya sıfırlanır

---

## 4. Yeni Exchange Butonu ve Diyaloğu

`src/components/trade/ExchangeModal.tsx` yeni dosya oluşturulacak.

`src/pages/Index.tsx`'e yeni Exchange butonu eklenecek (Portföy Ekle/Çıkar yanına).

### Exchange Diyaloğu:

**Liste görünümü:** Kullanıcının `user_assets` tablosundaki tüm kayıtları (USD, EUR, Konut, İşyeri, Arsa, Bitcoin, Ethereum, Altın, Gümüş) listelenir.

**Her satır:**

- Varlık türü ikonu + adı
- Kayıtlı miktar/değer (USD olarak)
- "Sat / TL'ye Çevir" butonu

**Satış akışı:**

- Kullanıcı bir varlığa tıklayınca: satılacak USD tutarı girilir
- Güncel USDTRY kuru çekilir (market-series edge function'dan)
- TL karşılığı hesaplanıp gösterilir: `USD tutarı × USDTRY`
- Kullanıcı USD değerini override edebilir
- Onaylayınca:
  1. `user_assets`'ten ilgili değer düşülür (ya silinir ya da güncellenir)
  2. TL karşılığı `portfolio_cash_flows`'a `deposit` olarak eklenir (kullanılabilir bakiyeye girer)

---

## 5. Raporlarım — "Varlıklarım Grafiği" (Pie/Donut)

`src/components/reports/AssetsChart.tsx` yeni dosya oluşturulacak.

`src/pages/Reports.tsx`'e Chart 3'ün altına eklenir.

### Grafik özellikleri:

- Recharts `PieChart` (donut — `innerRadius` ile)
- Başlık: "Varlıklarım"
- Her dilim ayrı renk, legend ile birlikte
- Hover tooltip: varlık adı + USD değeri + toplam içindeki yüzde
- Smooth animasyon: `isAnimationActive` + `animationEasing: 'ease-out'`

### Veri hesaplama mantığı:

- Tüm değerler USD bazında hesaplanır:
  - TL bakiyesi (kullanılabilir bakiye): `availableCash / USDTRY`
  - USD: kayıtlı `amount_usd`
  - EUR: kayıtlı `amount_usd` (USD karşılığı olarak girildiği için doğrudan kullanılır)
  - Gayrimenkul ve Emtia: `amount_usd`
- Değeri 0 olan / kaydı bulunmayan kategoriler grafikte görünmez
- USDTRY kuru: `market-series` edge function'dan (veya `MarketSeriesContext`'ten `usd` verisi kullanılarak son değer alınır)

### Renk paleti (tasarımla uyumlu):

```text
TL Nakit    → hsl(var(--primary))
USD         → #22c55e (yeşil)
EUR         → #3b82f6 (mavi)
Konut       → #f59e0b (turuncu)
İşyeri      → #ef4444 (kırmızı)
Arsa        → #a855f7 (mor)
Bitcoin     → #f97316 (turuncu)
Ethereum    → #6366f1 (indigo)
Altın       → #eab308 (sarı)
Gümüş       → #94a3b8 (gri)
```

---

## Değişecek / Oluşturulacak Dosyalar


| Dosya                                     | Değişiklik                       |
| ----------------------------------------- | -------------------------------- |
| `supabase/migrations/xxx_user_assets.sql` | Yeni `user_assets` tablosu + RLS |
| `src/hooks/useUserAssets.ts`              | Yeni hook                        |
| `src/components/trade/CashFlowModal.tsx`  | Tamamen yeniden yazılacak        |
| `src/components/trade/ExchangeModal.tsx`  | Yeni dosya                       |
| `src/components/reports/AssetsChart.tsx`  | Yeni pie chart bileşeni          |
| `src/pages/Index.tsx`                     | Exchange butonu ekleme           |
| `src/pages/Reports.tsx`                   | AssetsChart ekleme               |


---

## Önemli Mimari Kararlar

1. **TL bakiyesi değişmez:** `portfolio_cash_flows` tablosu ve `availableCash` hesabı dokunulmadan kalır. Exchange satışları bu tabloya yeni deposit olarak eklenir.
2. **USD bazlı varlık kaydı:** Tüm döviz/gayrimenkul/emtia kayıtları `amount_usd` alanında tutulur. Bu sayede pie chart tek bir kur üzerinden normalize edebilir.
3. **Altın fiyatı:** `MarketSeriesContext` üzerinden zaten çekilen `gold` (XAUTRY) ve `usd` (USDTRY) verisinden son değer alınarak `altın_fiyatı_USD = XAUTRY_son / USDTRY_son` hesaplanır. Kullanıcıya gösterilir ve override edilebilir.
4. **Kısmi Exchange satışı:** Bir varlığın tamamı değil bir kısmı satılabilir (ör: 5000 USD'nin 2000 USD'si). `user_assets` kaydı güncellenir (`amount_usd` azalır).  
  
**PROMPT EKİ**
  - Gayrimenkul ve emtialar için “hangi kalemi satıyorum?” ihtiyacı var. Bu nedenle `user_assets` kayıtları “item bazlı” olmalı: her arsa/konut/işyeri ayrı satır, emtia kayıtları da miktar (quantity) içermeli.
  - `user_assets` tablosuna şu alanları ekleyin:
    - `title` (text): real_estate için zorunlu, diğerleri opsiyonel
    - `quantity` (numeric): altın/gümüş gram, btc/eth adet, gayrimenkul için 1
    - `quantity_unit` (text): `gram`, `btc`, `eth`, `unit`
    - (opsiyonel) `metadata` jsonb
  - Portföy Ekle akışında:
    - Gayrimenkul eklerken başlık zorunlu olsun.
    - Altın/Gümüş eklerken gram girilsin; BTC/ETH eklerken adet girilsin.
    - `amount_usd` item’ın toplam USD değeri olsun. Altın için API’den gelen fiyatla prefill edin; kullanıcı toplam USD değerini override edebilsin.
  - ExchangeModal artık “holdings listesi” değil, `user_assets` item satırlarını listelesin. Kullanıcı 3 arsa arasından başlığa bakarak seçebilsin.
  - Satış akışında:
    - Gayrimenkulde kısmi satış kapalı (tamamı satılır).
    - Emtia ve dövizde kısmi satış açık (satılacak miktar + USD tutarı girilir).
    - Satış sonrası `user_assets` satırındaki `quantity` ve `amount_usd` düşsün; 0’a inerse satır silinsin.
    - TL karşılığı `portfolio_cash_flows`’a deposit eklenerek kullanılabilir bakiye artsın.
  - Pie chart’ta dilimler item bazında gösterilebilir:
    - Gayrimenkulde label olarak `title` kullanın (örn. “Arsa – Çatalca”).
    - Emtia/dövizde label `asset_type` + gerekirse miktar. 0 olanlar görünmesin.