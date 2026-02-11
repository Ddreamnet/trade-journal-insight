

# Plan: Ticker + Portfoy (Nakit) + Islem Formu + Kismi Cikis + Kapali Portfoy UX (Final v3)

Onceki final v2 plana 1 ek kritik duzeltme entegre edilmistir. Diger tum maddeler aynen korunmustur.

---

## Yapilacaklar Ozeti ve Bagimliliklar

```text
1. Ticker Tape Reset Sorunu          -- Bagimsiz
2. Buton Yerlesimleri                 -- Bagimsiz (ama 3'e UI baglantisi var)
3. Portfoy Nakit Yonetimi (yeni)     -- DB migration gerekli
4. Islem Formu Validasyonu           -- Bagimsiz
5. Lot Mantigi (position_amount -> lot) -- DB migration gerekli, 3'e bagimli
6. Kismi Cikis (Partial Close)       -- 5'e bagimli (lot sistemi gerekli)
7. Kapali Portfoy UX Iyilestirmeleri -- Bagimsiz
```

---

## 1. Ticker Tape Reset Sorunu

### Kok Neden
`MarketDataContext` her 60 sn'de `setStocks(response.items)` cagiriyor. Yeni dizi referansi React'in TickerTape'i re-render etmesine yol aciyor. `displayStocks = [...stocks, ...stocks]` yeniden hesaplaniyor ve CSS `animation: ticker 15s linear infinite` sifirdan basliyor. Ayrica sabit `15s` duration, farkli ekran genisliklerinde farkli gorsel hiz yaratiyor.

### Cozum

**MarketDataContext.tsx -- Referans Stabilizasyonu:**
- `setStocks` cagrilmadan once mevcut `stocks` ile gelen veriyi karsilastir (symbol+last+chgPct hash). Sadece icerik degismisse `setStocks` cagir. Bu gereksiz re-render'i kokunden onler.

**TickerTape.tsx -- React.memo + Sabit px/sn Hiz:**
- `React.memo` ile sarmala.
- `displayStocks` icin `useMemo([...stocks, ...stocks], [stocks])`.
- **Tek bir `useRef`** ile `.ticker-tape` elementinin `scrollWidth` degerini ol.
- Sabit hiz sabiti: `SPEED = 50` px/sn.
- `animation-duration = (scrollWidth / 2) / SPEED` saniye olarak hesapla.
- **Duration SADECE ilk mount + ilk veri yuklemesinde set edilecek.** Sonraki veri guncellemelerinde veya window resize/orientation degisikliklerinde yeniden hesaplanmayacak.
- Bunu saglamak icin: `useEffect` icinde `if (durationRef.current === null && scrollWidth > 0)` kontrolu ile sadece bir kez set et.

**index.css:**
- `.ticker-tape` sinifindaki `animation: ticker 15s linear infinite` satirindan `15s` kaldirilacak. Duration inline style olarak bir kez atanacak.
- `animation-name`, `timing-function`, `iteration-count` CSS'te kalacak.

### Degisecek Dosyalar
- `src/contexts/MarketDataContext.tsx`
- `src/components/layout/TickerTape.tsx`
- `src/index.css`

---

## 2. Buton Yerlesimleri

### Layout (Index.tsx, satir 64-74)
- **Desktop (sm ve uzeri):** `flex flex-col sm:flex-row sm:justify-end gap-3`. "Yeni Islem Ekle" solda, "Portfoy Ekle/Cikar" sagda.
- **Mobil:** Ust uste, tam genislik. "Portfoy Ekle/Cikar" ustte, "Yeni Islem Ekle" altta.

### Degisecek Dosyalar
- `src/pages/Index.tsx`

---

## 3. Portfoy Nakit Yonetimi (Yeni Ozellik)

### Veri Modeli

**Yeni tablo: `portfolio_cash_flows`** (APPEND-ONLY)

| Kolon | Tip | Aciklama |
|-------|-----|----------|
| id | uuid PK DEFAULT gen_random_uuid() | |
| user_id | uuid NOT NULL | |
| flow_type | text NOT NULL | 'deposit' veya 'withdraw' |
| amount | numeric NOT NULL CHECK (amount > 0) | Her zaman pozitif |
| note | text | Opsiyonel |
| created_at | timestamptz DEFAULT now() | |

**RLS (Append-Only):**
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: Hicbir policy yok (yasak)
- DELETE: Hicbir policy yok (yasak)

Yanlis giris icin ters islem eklenir (ornegin yanlis deposit icin withdraw).

### Kullanilabilir Nakit Hesabi

**Realized PnL dahil edilecek. Legacy blokaj fallback'i uygulanacak.**

```text
Kullanilabilir Nakit =
  SUM(deposits) - SUM(withdrawals)
  - SUM(aktif islem bloklari)
  + SUM(realized PnL)
```

**KRITIK -- Legacy Aktif Islem Blokaj Fallback'i:**

Her aktif islem icin blokaj su sekilde hesaplanir:

```text
Aktif islem blokaji =
  CASE
    WHEN remaining_lot > 0 THEN entry_price * remaining_lot
    WHEN remaining_lot = 0 AND position_amount > 0 THEN position_amount
    ELSE 0
  END
```

- `remaining_lot > 0`: Normal yeni sistem, blokaj = entry * remaining_lot
- `remaining_lot = 0` VE `position_amount > 0`: Legacy aktif islem, lot henuz girilmemis. Eski `position_amount` degeri blokaj olarak kullanilir. Bu kullanicinin lot=0 eski islemleri varken "sinirsiz islem acma" kapisi birakilmasini engeller.
- Her ikisi de 0: blokaj 0 (beklendigi gibi)

Bu fallback mantigi su **uc yerde ayni sekilde** uygulanacak:
1. `create_trade_with_cash_check` RPC fonksiyonu icinde
2. `create_withdraw_with_check` RPC fonksiyonu icinde
3. Frontend `usePortfolioCash` hook'unda UI'da gosterilen "kullanilabilir nakit" hesabinda

### Atomik / Server-Side Kontrol

**SQL Function: `create_trade_with_cash_check(...)`**
- Kullanilabilir nakdi hesaplar (deposit - withdraw - blokaj + realized PnL)
- Blokaj hesabinda legacy fallback kullanir (yukaridaki CASE ifadesi)
- `entry_price * lot_quantity <= kullanilabilir_nakit` kontrolu
- Yeterliyse INSERT, yetersizse RAISE EXCEPTION

**SQL Function: `create_withdraw_with_check(p_user_id, p_amount, p_note)`**
- Ayni blokaj hesabi (legacy fallback dahil)
- Cekilecek tutar <= kullanilabilir nakit kontrolu

### UI
1. Modal: "Para Ekle" / "Para Cikar" sekmeleri
2. Ust kisimda mevcut kullanilabilir nakit (legacy fallback dahil hesaplanmis)
3. Gecmis islemler listesi (salt okunur, silinemez)
4. Toast ile bildirim

### Degisecek/Olusacak Dosyalar
- Migration SQL
- `src/hooks/usePortfolioCash.ts` (yeni -- legacy blokaj fallback dahil)
- `src/components/trade/CashFlowModal.tsx` (yeni)
- `src/pages/Index.tsx`

---

## 4. Islem Formu Validasyonu (AL/SAT Yonune Gore)

### Kurallar

**AL (buy):**
- Target <= Entry -> hata: "AL isleminde hedef fiyat giris fiyatindan buyuk olmali"
- Stop >= Entry -> hata: "AL isleminde stop fiyat giris fiyatindan kucuk olmali"

**SAT (sell):**
- Target >= Entry -> hata: "SAT isleminde hedef fiyat giris fiyatindan kucuk olmali"
- Stop <= Entry -> hata: "SAT isleminde stop fiyat giris fiyatindan buyuk olmali"

### RR Hesabi Duzeltmesi (Frontend)
Mevcut TradeForm.tsx (satir 53): `(parsedTarget - parsedEntry) / (parsedEntry - parsedStop)` + `Math.abs()` -- bu SAT icin yanlis.

Duzeltme:
- AL: `(target - entry) / (entry - stop)`
- SAT: `(entry - target) / (stop - entry)`
- `Math.abs()` kaldirilacak

Server-side `calculate_rr_ratio` zaten dogru calisiyor.

### UI
- Hata mesaji alan altinda kirmizi
- Kaydet butonu disabled

### Degisecek Dosyalar
- `src/components/trade/TradeForm.tsx`
- `src/components/trade/EditTradeModal.tsx`

---

## 5. Lot Mantigi (Islem Tutari -> Lot)

### DB Degisikligi

`trades` tablosuna:
- `lot_quantity` (integer, NOT NULL, DEFAULT 0) -- Baslangic lot adedi, **TAM SAYI**
- `remaining_lot` (integer, NOT NULL, DEFAULT 0) -- Kalan lot, **TAM SAYI**

`position_amount` kolonu kalacak, `entry_price * lot_quantity` olarak trigger ile otomatik hesaplanacak.

### Eski Kayit Migrasyonu

- `lot_quantity = 0` ve `remaining_lot = 0` olarak set edilir
- Kullanici bu kayitlari EditTradeModal'dan manuel duzeltir
- Nakit blokaj hesabinda legacy fallback devreye girer (Madde 3'teki CASE ifadesi)

```text
UPDATE trades SET lot_quantity = 0, remaining_lot = 0;
```

### Legacy Kayitlarda Rapor/PnL Fallback

Lot=0 olan eski kapali kayitlar rapor ve PnL hesaplarinda 0'a dusmeyecek:
- `lot_quantity = 0` VE `position_amount > 0` ise: `PnL = position_amount * ((exit - entry) / entry)` (AL) veya `position_amount * ((entry - exit) / entry)` (SAT)
- Aktif islemlerde lot=0 ise kullaniciya "Bu islemin lot bilgisi eksik" uyarisi gosterilir

### Trigger Guncellemesi

```text
IF TG_OP = 'INSERT' THEN
  NEW.remaining_lot := NEW.lot_quantity;
END IF;
NEW.position_amount := NEW.entry_price * NEW.lot_quantity;
```

### UI Degisikligi

**TradeForm.tsx:**
- "Islem Tutari" alani kaldirilir
- Yerine "Lot / Kagit Adedi" alani: `NumberInput step="1" min="1"`, ondalik kabul etmez
- Bilgi satiri: "Islem Tutari: {entry * lot} TL"
- Nakit kontrolu: `create_trade_with_cash_check` RPC kullanilir

**EditTradeModal.tsx:**
- Ayni degisiklik
- Kismi kapanisi olmayan aktif islemlerde lot duzenlenince remaining_lot esitlenir
- Kismi kapanisi olan islemlerde lot alani kilitli (disabled)

### Degisecek Dosyalar
- Migration SQL
- `src/components/trade/TradeForm.tsx`
- `src/components/trade/EditTradeModal.tsx`
- `src/hooks/useTrades.ts`
- `src/hooks/useEquityCurveData.ts` (fallback PnL hesabi)
- `src/types/trade.ts`

---

## 6. Kismi Cikis (Partial Close)

### Yeni Tablo: `trade_partial_closes`

| Kolon | Tip | Aciklama |
|-------|-----|----------|
| id | uuid PK | |
| trade_id | uuid NOT NULL FK -> trades | |
| user_id | uuid NOT NULL | |
| exit_price | numeric NOT NULL | Cikis fiyati |
| lot_quantity | integer NOT NULL | Satilan lot (tam sayi) |
| closing_type | text NOT NULL | kar_al / stop |
| stop_reason | text | |
| closing_note | text | |
| realized_pnl | numeric | Hesaplanan K/Z |
| created_at | timestamptz DEFAULT now() | |

**RLS:** SELECT + INSERT icin `auth.uid() = user_id`. UPDATE/DELETE yok (append-only).

### Server-Side RPC: `close_trade_partial(...)`

Atomik olarak:
1. `remaining_lot >= p_lot_quantity` kontrolu
2. `trade_partial_closes`'a INSERT (realized_pnl hesaplanir)
3. `trades.remaining_lot -= p_lot_quantity`
4. Eger `remaining_lot = 0`:
   - `trades.status = 'closed'`
   - `trades.exit_price` = bu son parcainin cikis fiyati
   - `trades.closing_type`, `trades.closed_at` set edilir
5. Eger `remaining_lot > 0`: trade `active` kalir, `trades.exit_price` NULL kalir
6. Portfolio event (PnL) olusturulur (varsa)

### Kapanis Fiyati Semantigi

- `trades.exit_price`: sadece tam kapanis aninda son parcainin cikis fiyati yazilir. Kismi cikis sirasinda NULL kalir.
- Gercek K/Z hesaplari her zaman `trade_partial_closes` kayitlarindan yapilir.

### Blokaj-Nakit Uyumu

Kismi cikis sonrasi:
- `remaining_lot` azalir
- Blokaj = `entry_price * remaining_lot` (azalmis degerle)
- Serbest nakit otomatik artar
- Realized PnL kullanilabilir nakde eklenir

### UI (CloseTradeModal)

1. Mevcut cikis fiyati alani korunur
2. Yeni alan: "Satilacak Lot" (NumberInput step="1", tam sayi)
3. Buton: "Tum Lotlar ({remaining_lot})"
4. Validasyon: lot > 0 VE lot <= remaining_lot VE tam sayi
5. Bilgi: "Gerceklesen K/Z: {(exit - entry) * lot} TL"

### Degisecek/Olusacak Dosyalar
- Migration SQL
- `src/components/trade/CloseTradeModal.tsx`
- `src/hooks/useTrades.ts`
- `src/types/trade.ts`

---

## 7. Kapali Portfoy UX Iyilestirmeleri

### 7a. "Islem Sebepleri" Gizleme (EditTradeModal)

- `isClosed` true ise TRADE_REASONS grid renderlanmayacak
- Mevcut `reasons` degerleri DB'de korunur, sadece UI'da gizlenir
- `reasons.length > 0` validasyonunu kapali islemler icin atla

### 7b. Notlar: Popover -> Dialog (TradeList)

- Desktop ve mobil icin `Popover` yerine `Dialog` kullan
- Dialog icinde: "{stock_symbol} - Notlar" basligi, stop sebebi, kapanma notu, `ScrollArea` ile uzun icerik destegi

### Degisecek Dosyalar
- `src/components/trade/EditTradeModal.tsx`
- `src/components/trade/TradeList.tsx`

---

## Uygulama Sirasi

| Adim | Is Kalemi | Gerekce |
|------|-----------|---------|
| 1 | DB Migrations (portfolio_cash_flows + trades lot kolonlari + trade_partial_closes + RPC fonksiyonlari) | Altyapi once |
| 2 | Ticker Tape duzeltmesi | Bagimsiz, hizli |
| 3 | Islem formu validasyonu (AL/SAT kurallari + RR duzeltmesi) | Bagimsiz |
| 4 | Kapali portfoy UX (sebepler gizle + notlar dialog) | Bagimsiz |
| 5 | Lot mantigi (UI + hook degisiklikleri + legacy fallback) | DB'ye bagimli |
| 6 | Portfoy nakit yonetimi (hook + modal + realized PnL + legacy blokaj fallback) | DB'ye + lot'a bagimli |
| 7 | Buton yerlesimleri + CashFlowModal entegrasyonu | 6'ya bagimli |
| 8 | Kismi cikis (CloseTradeModal + RPC + lot kilidi) | 5'e bagimli |

---

## Test Kontrol Listesi

### Ticker Tape
- [ ] 60+ sn sonra ticker sicramiyor/sifirlanmiyor
- [ ] Fiyat guncellendikten sonra animasyon kesintisiz devam ediyor
- [ ] Mobil, tablet, desktop hizi tutarli (px/sn sabiti)
- [ ] Window resize'da animasyon resetlenmiyor
- [ ] Hover'da animasyon duruyor, birakinca devam ediyor

### Buton Yerlesimi
- [ ] Desktop: iki buton yan yana, sag hizali
- [ ] Mobil: ust uste, tam genislik

### Nakit Yonetimi
- [ ] Para ekleme basariyla kaydediliyor
- [ ] Para cikarma: yetersiz bakiye sunucu hatasi doner
- [ ] Kullanilabilir nakit dogru (deposit - withdraw - bloklanan + realized PnL)
- [ ] Realized PnL nakit hesabina dahil ediliyor
- [ ] Kar edilen islem sonrasi kullanilabilir nakit artiyor
- [ ] Gecmis islemler silinemez
- [ ] Iki sekme ayni anda islem -> ikincisi reddediliyor
- [ ] Legacy aktif islem (lot=0, position_amount>0) blokaji position_amount olarak hesaplaniyor
- [ ] Legacy islem varken yeni islem acmak nakdi dogru dusuruyor

### Islem Formu Validasyonu
- [ ] AL: target <= entry hata, stop >= entry hata
- [ ] SAT: target >= entry hata, stop <= entry hata
- [ ] Hata varken Kaydet disabled
- [ ] RR hesabi AL ve SAT icin dogru

### Lot Mantigi
- [ ] Lot alani tam sayi kabul ediyor, ondalik reddediliyor
- [ ] Islem tutari = entry * lot otomatik gosteriliyor
- [ ] Yetersiz nakit: sunucu hatasi + frontend uyarisi
- [ ] Eski kayitlar lot_quantity=0 ile gorunuyor, hata vermiyor
- [ ] Eski kapali kayitlarin PnL'i fallback ile dogru hesaplaniyor (0'a dusmuyor)
- [ ] Eski aktif kayitlarda "lot bilgisi eksik" uyarisi gorunuyor
- [ ] Kullanici eski kayitlari EditTradeModal'dan duzeltebiliyor

### Kismi Cikis
- [ ] "Tum Lotlar" butonu kalan lotu dolduruyor
- [ ] Kismi cikis: islem active, remaining_lot azaliyor
- [ ] Tam cikis: islem closed, exit_price = son parca fiyati
- [ ] Birden fazla kismi cikis yapilabiliyor
- [ ] Kismi cikis sonrasi serbest nakit artiyor (blokaj azaliyor + realized PnL ekleniyor)
- [ ] PnL raporlara dogru yansiyor
- [ ] Kismi kapanisi olan islemde lot duzenleme KILITLI
- [ ] Kismi kapanisi olmayan aktif islemde lot duzenlenince remaining_lot esitleniyor

### Kapali Portfoy UX
- [ ] Duzenleme: "Islem Sebepleri" gorunmuyor
- [ ] Notlar ikonu -> tam dialog (popover degil)
- [ ] Uzun notlar scroll ile okunuyor
- [ ] Desktop + mobil dialog duzgun

