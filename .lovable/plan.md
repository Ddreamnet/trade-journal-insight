# Plan: Raporlarim Kartlari + Grafikler (1. 2. 3. grafik) + Zaman Araligi Mantigi (v2)

Onceki plana 6 netlestirme entegre edilmistir. Diger tum maddeler aynen korunmustur.

---

## Yapilacaklar Ozeti

```text
A) Ust kartlar: zaman araligi filtresi + "En Iyi Seri" -> Basarili/Basarisiz karti
B) Grafik alani: baslik/duzenleme temizligi + isimlendirme
C) 1. Grafik: "% Cizgi Grafigi" -- benchmark + portfoy normalizasyonu aralik baslangicina gore
D) 2. Grafik: "% Sutun Grafigi" -- Portfoy butonu eklenmesi
E) 3. Grafik: Portfoyun t0'dan itibaren ilerleyisi (tek cizgi, kur secimi, nakit jump, alim markeri)
```

---

## A) Ust 4 Kart: Zaman Araligi Filtresi

### Degisiklikler

**TimeRange tipi (`types/trade.ts`):**

- `'1w'` secenegi kaldirilir. Kalan: 1m, 3m, 6m, 1y, 3y.
- `getTimeRangeDates` ve diger yerlerdeki `'1w'` case'leri temizlenir.

**Filtreleme kriteri -- "kapanis olaylari":**

- Kartlar icin PnL ve islem sayisi hesabi artik sadece `closed_at`'e gore degil, **kapanis olaylari** uzerinden filtrelenir.
- Bir trade henuz tam kapanmamis (status=active) olsa bile, o aralikta `trade_partial_closes` kaydi varsa o kismi cikisin realized PnL'i dahil edilir.
- Veri kaynagi: `trade_partial_closes` tablosundaki `created_at` tarihi zaman araligina gore filtrelenir.
- Toplam islem sayisi: Secili aralikta herhangi bir kapanis olayi olan **benzersiz trade** sayisi (partial closes'tan distinct trade_id + aralikta tam kapanan trade'ler). “Realized PnL hesaplarında tek kaynak trade_partial_closes’tur; trades üzerindeki kapanış alanları para hesabında kullanılmaz.”
- Toplam K/Z: Aralikta gerceklesen tum partial close'larin `realized_pnl` toplami.

**Basarili/Basarisiz sayimi -- trade'in FINAL kapanis turune gore:**

- Bir trade'in "basarili" veya "basarisiz" sayilmasi icin trade'in tamamen kapanmis olmasi (`status = 'closed'`) VE `closed_at`'in secili aralik icinde olmasi gerekir.
- Basarili = `closing_type === 'kar_al'` olan tam kapanmis trade sayisi.
- Basarisiz = `closing_type === 'stop'` olan tam kapanmis trade sayisi.
- Kismi cikislari devam eden (hala active) trade'ler bu sayima dahil edilmez.

**"En Iyi Seri" karti -> "Basarili / Basarisiz" karti:**

- Kart boyutu/olculeri ayni kalacak.
- Kartinin ortasinda ince dikey bir `Separator` cizgisi olacak.
- Sol tarafta: "Basarili" yazisi + altinda basarili islem sayisi.
- Sag tarafta: "Basarisiz" yazisi + altinda basarisiz islem sayisi.

**Kar Al % hesabi:**

- `winRate = basarili / (basarili + basarisiz)`. Sadece tam kapanmis trade'lerden hesaplanir.

### Veri Ihtiyaci

- `trade_partial_closes` verisini Reports sayfasinda cekmek gerekecek (yeni query veya hook).
- Alternatif: `usePortfolioCash` hook'undan realized_pnl zaten var ama trade bazli degil. Reports icin ayri bir query gerekli.

### Degisecek Dosyalar

- `src/types/trade.ts` (1w kaldirilacak)
- `src/pages/Reports.tsx` (4. kart UI + stats hesabi + partial_closes query)
- `src/components/reports/TimeRangeSelector.tsx` (otomatik)
- `src/hooks/useEquityCurveData.ts` (1w case temizligi)

---

## B) Grafik Alani Baslik ve Duzen

- "Equity Curve" yazisi ve Settings (dislisi) butonu/Popover tamamen kaldirilacak.
- Baslangic sermayesi ayari simdilik kalkar (localStorage verisi korunur, silinmez).
- 1. grafigin basligini "% Cizgi Grafigi" yap.
- 2. grafigin basligini "% Sutun Grafigi" yap.
- 3. grafik eklenir (detay E bolumunde).

### Degisecek Dosyalar

- `src/pages/Reports.tsx`

---

## C) 1. Grafik: "% Cizgi Grafigi"

### Benchmark Normalizasyonu

**Yeni mantik:** Hem benchmarklar hem portfoy, **secili zaman araliginin baslangicina** gore 100'den baslar.

- Normalizasyon baslangici = `max(t0, viewStartDate)`.
- Ornegin 1 ay secildiginde: 1 ay onceki deger = 100.

**Uygulama (`useEquityCurveData.ts`):**

- `normalizeBenchmarkFromT0WithCarryForward` fonksiyonunun baslangic parametresini `effectiveStart = max(t0, viewStartDate)` olarak degistir.
- Portfoy icin: tam index t0'dan bugune hesaplanir, sonra view window baslangicindaki deger (`viewStartIndex`) bulunur ve tum gorunen degerler `(rawIndex / viewStartIndex) * 100` olarak yeniden normalize edilir.

### PnL Adim Yaklasimayla (Step)

- Lineer dagitim (PnL'i gunlere bolme) kaldirilacak.
- PnL sadece `closed_at` tarihinde adim olarak eklenir.
- **Netlestirme:** Kismi cikislar da dahil. `trade_partial_closes` kayitlarinin `created_at` tarihinde `realized_pnl` adim olarak eklenir. Trade'in final kapanisinda ise son parcainin PnL'i `closed_at` tarihinde eklenir.

### 1-2. Grafik Nakit Akisi Haric Tutma

- 1. ve 2. grafik "performans" grafikleri olarak nakit akislarini (deposit/withdraw) **tamamen haric tutar**.
- Portfoy index hesabi sadece realized PnL'e dayalidir. Nakit girisi/cikisi index'i etkilemez.
- Nakit jump'lari **sadece** 3. grafikte gosterilir.

### Portfoy Cizgisi Kalinligi

- `EquityCurveChart.tsx`: `strokeWidth={3}` -> `strokeWidth={1.5}`.

### Degisecek Dosyalar

- `src/hooks/useEquityCurveData.ts`
- `src/components/reports/EquityCurveChart.tsx`

---

## D) 2. Grafik: "% Sutun Grafigi" -- Portfoy Butonu

### Degisiklikler

**BenchmarkSelector'a "Portfoy" secenegi ekle:**

- Benchmark seciciye "Portfoy" butonu eklenir (ozel, BENCHMARKS dizisine dahil degil).
- Varsayilan olarak **secili degil**.
- Kullanici portfoy butonuna tikladiginda portfoy sutunu eklenir.

**ReturnComparisonChart mantik degisikligi:**

- Portfoy her zaman otomatik eklenmeyecek. Sadece `portfolioSelected` prop'u true ise eklensin.
- "En az 2 varlik" kisiti kaldirilacak. Tek varlik secildiginde bile sutun gosterilecek.

### Degisecek Dosyalar

- `src/pages/Reports.tsx` (portfolioSelected state)
- `src/components/reports/ReturnComparisonChart.tsx` (portfolioSelected prop)
- `src/components/reports/BenchmarkSelector.tsx` (Portfoy butonu)

---

## E) 3. Grafik: Portfoyun t0'dan Itibaren Ilerleyisi

### Kritik Ozellik: TimeRange'e Bagli DEGIL

- 3. grafik her zaman t0'dan bugune gosterir. Zaman araligi secimi bu grafigi etkilemez.

### t0 ve Baslangic Degeri

- t0 = kapali islemler arasinda en erken `created_at` tarihi (mevcut `calculateT0FromClosedTrades`).
- **t0 baslangic degeri:** t0 gunu olusturulurken, t0'a kadar olan net nakit akisi + realized PnL ile baslatilir.
  - `portfolioValue(t0) = SUM(deposits before t0) - SUM(withdrawals before t0) + SUM(realized_pnl before t0)`.
  - Cogu durumda t0 ilk islem tarihi oldugu icin bu deger genellikle ilk deposit'e esit olur. Ama t0 oncesinde birden fazla nakit hareketi varsa hepsi dahil edilir.

### Portfoy Degeri Serisi

Her gun icin:

```text
portfolioValue(tarih) = 
  SUM(deposits until tarih) - SUM(withdrawals until tarih) + SUM(realized_pnl until tarih)
```

- Nakit girisi/cikisi olan gunlerde grafik degerinde dikey atlama (dogal jump).
- Bu gunler tooltip'te "Para Girisi: +X TL" veya "Para Cikisi: -X TL" olarak gosterilir.

### Islem Markerlari

- Yeni islem acildiginda portfoy degeri degismez (nakit azalir, pozisyon degeri eklenir).
- Bu tarihlerde grafik uzerinde kucuk marker gosterilir.
- Tooltip'te "THYAO Alim" gibi bilgi verilir.

### Kur/Deger Secimi

- Varsayilan: TL bazinda.
- Kullanici USD, EUR, Altin secebilir.
- Secildiginde: `portfolioValueCurrency = portfolioValueTL / kurDegeri(tarih)`.
- Kur verisi: `MarketSeriesContext`'ten (`getSeriesData` ile absolute degerler).

**Kur serilerinde eksik gunler: carry-forward**

- Hafta sonlari ve tatil gunlerinde kur verisi yoksa, en son bilinen deger kullanilir (carry-forward).
- Bu zaten `findValueAtDateWithCarryForward` fonksiyonu ile mevcut, ayni mantik uygulanacak.

**Kur verisi tamamen yoksa: TL fallback**

- Bir kur secilmis ama o kur icin hic veri gelmemisse (API hata, vb.), grafik TL bazinda gosterilir ve kullaniciya "Kur verisi alinamadi, TL bazinda gosteriliyor" bilgisi verilir.

### Degisecek/Olusacak Dosyalar

- `src/components/reports/PortfolioValueChart.tsx` (yeni)
- `src/hooks/usePortfolioValueData.ts` (yeni)
- `src/pages/Reports.tsx` (3. grafigi entegre et)

---

## Uygulama Sirasi


| Adim | Is Kalemi                                                                                | Gerekce                 |
| ---- | ---------------------------------------------------------------------------------------- | ----------------------- |
| 1    | TimeRange'den 1w kaldir                                                                  | Kucuk, her seyi etkiler |
| 2    | Ust kartlar: stats hesabi guncelle (partial_closes query + basarili/basarisiz)           | Veri katmani            |
| 3    | Ust kartlar: Basarili/Basarisiz kart UI                                                  | UI degisikligi          |
| 4    | Grafik baslik temizligi (Equity Curve + Settings kaldir, yeniden isimlendir)             | Bagimsiz                |
| 5    | 1. Grafik: normalizasyonu aralik baslangicina cek + PnL step yaklasimayla + cizgi incelt | Ana mantik              |
| 6    | 2. Grafik: Portfoy butonu + tek varlik gosterimi                                         | 5'e bagimli             |
| 7    | 3. Grafik: PortfolioValueChart + usePortfolioValueData (kur, jump, marker)               | Yeni komponent          |


---

## Teknik Detaylar

### Normalizasyon Degisikligi (1. Grafik)

```text
effectiveStart = max(t0, viewStartDate)

// Benchmark:
normalizeBenchmark(points, effectiveStart, endDate)
  -> effectiveStart'taki deger = 100

// Portfoy:
viewStartIndex = portfolioIndexMap.get(effectiveStart)?.index || 100
normalizedPortfolioIndex = (rawIndex / viewStartIndex) * 100
```

### PnL Step Yaklasimayla -- Partial Closes Dahil

```text
// Eski: PnL'i gunlere dagit (lineer)
// Yeni:
for each partialClose:
  key = format(partialClose.created_at, 'yyyy-MM-dd')
  dailyPnL[key] += partialClose.realized_pnl

// Tam kapanis icin de son parcainin PnL'i closed_at'e yazilir
// (Bu zaten close_trade_partial RPC'si ile trade_partial_closes'a kaydediliyor)
```

Not: Tum kapanislar `trade_partial_closes` tablosuna kaydedildigi icin (tam kapanis = remaining_lot'u sifirlayan son partial close), PnL hesabi icin sadece `trade_partial_closes` tablosu kullanilabilir. Ayrica trade'in kendi `exit_price` ve `position_amount` uzerinden hesap yapmaya gerek kalmaz.

### 3. Grafik Portfoy Degeri Hesabi

```text
portfolioValue(tarih) = 
  cumulative_deposits(tarih) - cumulative_withdrawals(tarih) + cumulative_realized_pnl(tarih)

// t0 baslangici:
portfolioValue(t0) = net_cash_before_t0 + realized_pnl_before_t0

// Kur donusumu:
USD bazinda: portfolioValue(tarih) / usd_tl_kuru(tarih)  // carry-forward ile
Altin bazinda: portfolioValue(tarih) / altin_tl_gram_fiyati(tarih)

// Kur verisi yoksa: TL fallback + uyari mesaji
```

---

## Test Kontrol Listesi

### Zaman Araligi Filtresi

- 1 Hafta secenegi goruntulenmemeli
- 1 Ay secildiginde kartlar son 1 ayda gerceklesen kapanis olaylarini yansitmali
- Kismi cikisi olan ama hala aktif trade'in o araliktaki realized PnL'i toplam K/Z'ye dahil olmali
- Zaman araligi degistiginde kartlar ve 1-2. grafik guncellenmeli, 3. grafik degismemeli

### Ust Kartlar

- Toplam K/Z: Aralikta gerceklesen tum partial close realized_pnl toplami
- Basarili sayisi: Aralikta tam kapanan + closing_type='kar_al' olan trade sayisi (final kapanis turune gore)
- Basarisiz sayisi: Aralikta tam kapanan + closing_type='stop' olan trade sayisi
- Hala aktif olan (kismi cikis yapmis ama kapanmamis) trade'ler basarili/basarisiz sayisina dahil olmamali
- Dikey ayirici cizgi mobilde ve desktopte gorunmeli

### 1. Grafik: % Cizgi Grafigi

- 1 Ay secildiginde benchmark ve portfoy 1 ay oncesi = 100'den baslamali
- PnL adim seklinde eklenmeli (lineer dagitim yok)
- Kismi cikis PnL'i partial_close tarihinde adim olarak gorunmeli
- Nakit akislari (deposit/withdraw) portfoy index'ini etkilememeli
- Portfoy cizgisi ~1.5px kalinliginda olmali
- "Equity Curve" yazisi ve Settings ikonu gorunmemeli

### 2. Grafik: % Sutun Grafigi

- "Portfoy" butonu Benchmark seciciye eklenmis olmali
- Portfoy butonu varsayilan olarak secili olmamali
- Tek varlik secildiginde bile sutun goruntulenmeli
- Nakit akislari portfoy getiri hesabini etkilememeli

### 3. Grafik: Portfoy Degeri

- Grafik t0'dan bugune gostermeli (timeRange'den bagimsiz)
- Zaman araligi degistiginde 3. grafik degismemeli
- t0 baslangic degeri: t0 oncesi net nakit + realized PnL ile baslamali
- Nakit girisi/cikisi gunlerinde dikey atlama (jump) olmali
- Islem acilis gunlerinde marker gorunmeli
- TL varsayilan baz olmali
- USD secildiginde farkli bir egri cizmeli (kur etkisi)
- Kur verisinde eksik gunler carry-forward ile doldurulmali
- Kur verisi tamamen yoksa TL fallback + uyari mesaji gostermeli
- Kapanmis islem yoksa bos durum mesaji gostermeli

### Mobil Uyum

- Kartlar 2x2 grid'de duzgun gorunmeli
- Basarili/Basarisiz karti mobilde ayirici ile duzgun gorunmeli
- 3 grafik mobilde tam genislikte gorunmeli
- Kur secici butonlari mobilde tasmamali