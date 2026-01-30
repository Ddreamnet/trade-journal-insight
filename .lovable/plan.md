

# Plan: Yeni Portföy Performans Grafiği - Birim Pay/NAV Mantığı

## Genel Bakış

Bu plan, Raporlarım sayfasındaki performans grafiğini tamamen yeni bir mantıkla yeniden tasarlıyor. Portföy bir yatırım fonu gibi çalışacak: nakit giriş/çıkışları birim değeri değiştirmeyecek, sadece kâr/zarar birim değeri etkileyecek. Grafik "Relatif Baseline" mantığıyla çalışacak - portföy her zaman 0 çizgisinde olacak, benchmarklar portföye göre göreli fark olarak gösterilecek.

---

## 1. Veritabanı Değişiklikleri

### Yeni Tablo: `portfolio_events`
Tüm portföy olaylarını (nakit giriş/çıkış, işlem PnL) tarih bazlı kaydeder.

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | uuid | Primary key |
| user_id | uuid | Kullanıcı ID (RLS için) |
| event_type | enum | 'deposit', 'withdraw', 'pnl' |
| amount_tl | numeric | Tutar (deposit/withdraw +/-, pnl için realized_pnl) |
| trade_id | uuid (nullable) | PnL eventleri için ilişkili işlem |
| note | text (nullable) | Opsiyonel not |
| created_at | timestamptz | Event tarihi |

### Yeni Tablo: `portfolio_snapshots`
Her event sonrası portföy durumunu saklar (hesaplama optimizasyonu için).

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | uuid | Primary key |
| user_id | uuid | Kullanıcı ID |
| event_id | uuid | İlişkili event |
| snapshot_date | date | Snapshot tarihi |
| shares_total | numeric | Toplam pay sayısı |
| unit_price | numeric | Birim fiyat |
| portfolio_value | numeric | Toplam portföy değeri |
| created_at | timestamptz | Oluşturulma zamanı |

### RLS Politikaları
- Kullanıcılar sadece kendi portföy eventlerini görebilir/ekleyebilir
- Snapshotlar sadece okunabilir (trigger ile güncellenir)

### Trigger: `on_trade_close_create_pnl_event`
İşlem kapandığında otomatik olarak `portfolio_events` tablosuna `pnl` event ekler.

---

## 2. Birim Pay (Unit Price/NAV) Hesaplama Mantığı

### Başlangıç Durumu
- Kullanıcı ilk kez para eklediğinde:
  - `unit_price = 1.00`
  - `shares = deposit_amount`
  - `portfolio_value = deposit_amount`

### Nakit Ekleme (Deposit)
```text
shares_added = deposit_amount / current_unit_price
shares_total += shares_added
portfolio_value += deposit_amount
unit_price DEĞİŞMEZ
```

### Nakit Çekme (Withdraw)
```text
shares_removed = withdraw_amount / current_unit_price
shares_total -= shares_removed
portfolio_value -= withdraw_amount
unit_price DEĞİŞMEZ
```

**Validasyon:** Yetersiz bakiye/pay kontrolü - negatif pay olmasın.

### Performans (PnL Event)
```text
portfolio_value += realized_pnl
unit_price = portfolio_value / shares_total
shares_total DEĞİŞMEZ
```

---

## 3. Relatif Baseline Grafik Mantığı

### Temel Prensipler
- Portföy çizgisi **daima 0 çizgisinde** (merkez baseline)
- Portföyün kendisi yukarı/aşağı çizilmez
- Diğer çizgiler (USD, EUR, Altın, Enflasyon) portföye **göreli fark** olarak gösterilir

### Hesaplama Formülleri

**Seçilen periyodun başlangıç tarihine göre:**

```text
Portföy Getiri Yüzdesi:
portfolio_return_pct(t) = (unit_price(t) / unit_price(start) - 1) * 100

Benchmark Getiri Yüzdesi:
asset_return_pct(t) = (price(t) / price(start) - 1) * 100

Grafikte Çizilecek Değer:
relative_diff_pct(t) = asset_return_pct(t) - portfolio_return_pct(t)

Portföy Baseline: Her zaman 0
```

**Örnek Senaryo:**
- Portföy getirisi %20, Dolar getirisi %15 ise:
  - Dolar çizgisi = 15 - 20 = -5% (portföyün altında)
- Portföy %20, Altın %25 ise:
  - Altın çizgisi = 25 - 20 = +5% (portföyün üstünde)

---

## 4. Enflasyon Gösterimi

### "x param y olmuş" Mantığı
Enflasyon oranı yerine **paranın değeri** mantığıyla gösterilecek:

```text
inflation_factor(t) = CPI(t) / CPI(start)
Gösterim: "100 TL → {100 * inflation_factor} TL"
```

### Tooltip ve Sağ Panel Metni
- "%42 enflasyon" yerine: "100 TL → 142 TL olmuş (aynı alım gücü için)"

### Grafikte Opsiyonel Çizgi
```text
inflation_return_pct = (CPI(t) / CPI(start) - 1) * 100
inflation_relative = inflation_return_pct - portfolio_return_pct
```
Toggle ile açılıp kapanabilir.

---

## 5. UI Değişiklikleri

### 5.1 Periyot Seçimi Güncelleme
Mevcut seçenekleri güncelle:
- **1A** (1 Ay)
- **3A** (3 Ay)
- **1Y** (1 Yıl)
- **YB** (Yılbaşından Beri - YTD)

### 5.2 Nakit Ekle/Çek Butonları
Ana Sayfa header'ına veya Raporlarım sayfasına:
- "Nakit Ekle" butonu
- "Nakit Çek" butonu
- Modal: Tutar girişi + onay

### 5.3 Benchmark Toggle Butonları
Grafiğin yanında toggle butonlar (mevcut yapı korunacak):
- Dolar
- Euro
- Altın
- Enflasyon

### 5.4 Gelişmiş Tooltip
Tıklanabilir noktalar/hover:
```text
+----------------------------------+
| Tarih: 15 Mart 2024              |
| Portföy Durumu: +%12             |
| Altın: +%15                      |
| Net Fark: Altın'ın %3 gerisinde  |
| Enflasyon: 100 TL → 138 TL       |
+----------------------------------+
```

### 5.5 Sağ Güncel Değer Paneli (Yeni)
Grafiğin sağında sabit panel:
- **Portföy Unit Price:** 1.26 TL
- **Portföy Getirisi:** +%26
- **Seçili Benchmarkların Relatif Farkı:**
  - Altın: +4.2% (portföyün önünde)
  - Dolar: -3.1% (portföyün gerisinde)
- **Enflasyon:** 100 TL → 1xx TL

Hover/tıklama varsa o günün değerini, yoksa son günü gösterir.

---

## 6. Yeni Dosya Yapısı

```text
src/
├── components/
│   └── reports/
│       ├── EquityCurveChart.tsx     (Tamamen yeniden yazılacak)
│       ├── TimeRangeSelector.tsx    (Güncelleme: YB ekleme)
│       ├── BenchmarkSelector.tsx    (Mevcut - minimal değişiklik)
│       ├── CurrentValuePanel.tsx    (Yeni - sağ panel)
│       └── CashFlowModal.tsx        (Yeni - nakit ekle/çek)
├── hooks/
│   └── usePortfolioEvents.ts        (Yeni)
├── types/
│   └── portfolio.ts                 (Yeni)
└── pages/
    ├── Reports.tsx                  (Güncellenecek)
    └── Index.tsx                    (Nakit butonları için güncelleme)

supabase/
├── migrations/
│   └── xxxx_create_portfolio_tables.sql  (Yeni)
└── functions/
    └── market-series/index.ts            (Mevcut - değişiklik yok)
```

---

## 7. Uygulama Sırası

### Aşama 1: Veritabanı Altyapısı
1. `portfolio_events` tablosu oluştur
2. `portfolio_snapshots` tablosu oluştur
3. RLS politikalarını ekle
4. İşlem kapanışında PnL event oluşturan trigger ekle

### Aşama 2: Nakit Giriş/Çıkış UI
1. `CashFlowModal` komponenti oluştur
2. `usePortfolioEvents` hook oluştur
3. Ana Sayfa/Raporlar'a nakit butonları ekle

### Aşama 3: Yeni Hesaplama Mantığı
1. `portfolio.ts` types dosyası oluştur
2. Birim fiyat hesaplama fonksiyonları
3. Relatif baseline hesaplama fonksiyonları

### Aşama 4: Grafik Yeniden Tasarımı
1. `EquityCurveChart` tamamen yeniden yaz
2. `CurrentValuePanel` oluştur
3. Gelişmiş tooltip implementasyonu

### Aşama 5: Periyot ve Benchmark Güncellemeleri
1. TimeRangeSelector'a "YB" ekle
2. Enflasyon gösterimini "100 TL → X TL" formatına çevir

---

## Teknik Detaylar

### Veritabanı Migration SQL

```sql
-- Enum type for event types
CREATE TYPE portfolio_event_type AS ENUM ('deposit', 'withdraw', 'pnl');

-- Portfolio events table
CREATE TABLE portfolio_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type portfolio_event_type NOT NULL,
  amount_tl NUMERIC NOT NULL,
  trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Portfolio snapshots table
CREATE TABLE portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES portfolio_events(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  shares_total NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  portfolio_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_portfolio_events_user ON portfolio_events(user_id);
CREATE INDEX idx_portfolio_events_created ON portfolio_events(created_at);
CREATE INDEX idx_portfolio_snapshots_user ON portfolio_snapshots(user_id);
CREATE INDEX idx_portfolio_snapshots_date ON portfolio_snapshots(snapshot_date);

-- RLS Policies
ALTER TABLE portfolio_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events" ON portfolio_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events" ON portfolio_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own snapshots" ON portfolio_snapshots
  FOR SELECT USING (auth.uid() = user_id);
```

### Snapshot Hesaplama Fonksiyonu

```sql
CREATE OR REPLACE FUNCTION calculate_portfolio_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  last_snapshot RECORD;
  new_shares NUMERIC;
  new_unit_price NUMERIC;
  new_portfolio_value NUMERIC;
BEGIN
  -- Get latest snapshot for this user
  SELECT * INTO last_snapshot
  FROM portfolio_snapshots
  WHERE user_id = NEW.user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no previous snapshot, this is first deposit
  IF last_snapshot IS NULL THEN
    IF NEW.event_type = 'deposit' THEN
      new_unit_price := 1.00;
      new_shares := NEW.amount_tl;
      new_portfolio_value := NEW.amount_tl;
    ELSE
      RAISE EXCEPTION 'First event must be a deposit';
    END IF;
  ELSE
    -- Calculate based on event type
    IF NEW.event_type = 'deposit' THEN
      new_shares := last_snapshot.shares_total + 
                    (NEW.amount_tl / last_snapshot.unit_price);
      new_portfolio_value := last_snapshot.portfolio_value + NEW.amount_tl;
      new_unit_price := last_snapshot.unit_price; -- unchanged
    ELSIF NEW.event_type = 'withdraw' THEN
      new_shares := last_snapshot.shares_total - 
                    (NEW.amount_tl / last_snapshot.unit_price);
      IF new_shares < 0 THEN
        RAISE EXCEPTION 'Insufficient shares for withdrawal';
      END IF;
      new_portfolio_value := last_snapshot.portfolio_value - NEW.amount_tl;
      new_unit_price := last_snapshot.unit_price; -- unchanged
    ELSIF NEW.event_type = 'pnl' THEN
      new_shares := last_snapshot.shares_total; -- unchanged
      new_portfolio_value := last_snapshot.portfolio_value + NEW.amount_tl;
      new_unit_price := new_portfolio_value / new_shares;
    END IF;
  END IF;

  -- Insert new snapshot
  INSERT INTO portfolio_snapshots (
    user_id, event_id, snapshot_date, 
    shares_total, unit_price, portfolio_value
  ) VALUES (
    NEW.user_id, NEW.id, NEW.created_at::date,
    new_shares, new_unit_price, new_portfolio_value
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER after_portfolio_event_insert
AFTER INSERT ON portfolio_events
FOR EACH ROW EXECUTE FUNCTION calculate_portfolio_snapshot();
```

### Trade Kapanışında PnL Event Oluşturma

```sql
CREATE OR REPLACE FUNCTION create_pnl_event_on_trade_close()
RETURNS TRIGGER AS $$
DECLARE
  realized_pnl NUMERIC;
BEGIN
  -- Only run when trade status changes to closed
  IF NEW.status = 'closed' AND OLD.status = 'active' 
     AND NEW.exit_price IS NOT NULL 
     AND NEW.position_amount IS NOT NULL THEN
    
    -- Calculate realized PnL
    IF NEW.trade_type = 'buy' THEN
      realized_pnl := NEW.position_amount * 
                      ((NEW.exit_price - NEW.entry_price) / NEW.entry_price);
    ELSE
      realized_pnl := NEW.position_amount * 
                      ((NEW.entry_price - NEW.exit_price) / NEW.entry_price);
    END IF;

    -- Insert PnL event
    INSERT INTO portfolio_events (user_id, event_type, amount_tl, trade_id, note)
    VALUES (
      NEW.user_id, 
      'pnl', 
      realized_pnl, 
      NEW.id,
      'İşlem kapanışı: ' || NEW.stock_symbol
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_trade_close_create_pnl_event
AFTER UPDATE ON trades
FOR EACH ROW EXECUTE FUNCTION create_pnl_event_on_trade_close();
```

### TypeScript Hesaplama Fonksiyonları

```typescript
// types/portfolio.ts
export interface PortfolioEvent {
  id: string;
  user_id: string;
  event_type: 'deposit' | 'withdraw' | 'pnl';
  amount_tl: number;
  trade_id: string | null;
  note: string | null;
  created_at: string;
}

export interface PortfolioSnapshot {
  id: string;
  user_id: string;
  event_id: string;
  snapshot_date: string;
  shares_total: number;
  unit_price: number;
  portfolio_value: number;
}

export interface RelativeChartPoint {
  date: string;
  rawDate: string;
  portfolioReturnPct: number;
  gold?: number;      // relative diff (asset - portfolio)
  usd?: number;
  eur?: number;
  inflation_tr?: number;
}
```

### Relatif Baseline Hesaplama

```typescript
function calculateRelativeData(
  snapshots: PortfolioSnapshot[],
  benchmarkData: Record<string, MarketSeriesPoint[]>,
  startDate: Date
): RelativeChartPoint[] {
  // Find start unit price
  const startSnapshot = snapshots.find(s => 
    new Date(s.snapshot_date) >= startDate
  );
  if (!startSnapshot) return [];
  
  const startUnitPrice = startSnapshot.unit_price;
  
  // Find start prices for benchmarks
  const startBenchmarkPrices: Record<string, number> = {};
  for (const [asset, points] of Object.entries(benchmarkData)) {
    const startPoint = points.find(p => new Date(p.date) >= startDate);
    if (startPoint) startBenchmarkPrices[asset] = startPoint.value;
  }

  return snapshots
    .filter(s => new Date(s.snapshot_date) >= startDate)
    .map(snapshot => {
      const portfolioReturnPct = 
        ((snapshot.unit_price / startUnitPrice) - 1) * 100;
      
      const result: RelativeChartPoint = {
        date: format(new Date(snapshot.snapshot_date), 'd MMM', { locale: tr }),
        rawDate: snapshot.snapshot_date,
        portfolioReturnPct,
      };

      // Calculate relative diff for each benchmark
      for (const [asset, points] of Object.entries(benchmarkData)) {
        const startPrice = startBenchmarkPrices[asset];
        if (!startPrice) continue;

        const currentPoint = findLatestValue(points, snapshot.snapshot_date);
        if (!currentPoint) continue;

        const assetReturnPct = ((currentPoint / startPrice) - 1) * 100;
        result[asset] = assetReturnPct - portfolioReturnPct;
      }

      return result;
    });
}
```

---

## Kabul Kriterleri

1. Deposit yapınca unit_price değişmiyor, sadece pay artıyor
2. Withdraw yapınca unit_price değişmiyor, sadece pay azalıyor
3. PnL event'i (işlem kapanışı) olunca unit_price doğru güncelleniyor
4. Periyot değişince tüm seriler 0'dan yeniden normalize ediliyor
5. Relatif grafikte portföy 0 çizgisi; benchmarklar +/- fark olarak doğru çiziliyor
6. Enflasyon oran olarak değil "100 TL → X TL" olarak gösteriliyor
7. Sağ panel güncel/hover değerlerini doğru gösteriyor
8. Dark theme korunuyor, mobil uyumluluk sağlanıyor

