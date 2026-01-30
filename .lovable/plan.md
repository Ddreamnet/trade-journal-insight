
# Raporlarım Grafiği - Yeniden Tasarım Planı

## Genel Bakış

Bu plan, Raporlarım sayfasındaki grafik sistemini sıfırdan yeniden yapılandırır. Temel prensip: **İşlem açmak portföy değerini değiştirmez, sadece işlem kapanışlarından doğan realize kâr/zarar portföy değerini etkiler.**

---

## 1. Mevcut Durum Analizi

### Şu Anki Yapı
- `EquityCurveChart.tsx`: 100 bazlı normalize edilmiş grafikler
- Benchmark verileri Stooq ve EVDS API'larından çekilip 100'e normalize ediliyor
- Portföy equity değeri kapalı işlemlerin PnL toplamından hesaplanıyor (doğru)
- Benchmark'lar işlem bazlı değil, piyasa verisi olarak gösteriliyor (yanlış)

### Sorunlar
1. Benchmark'lar "işlem tutarı ile o dönem bu enstrümana yatırsaydım" mantığında değil
2. Grafik 100 bazından başlıyor, portföy referanslı değil
3. Sağ panel yok (güncel/tıklanan nokta değerleri)
4. Enflasyon "x TL → y TL" formatında gösterilmiyor

---

## 2. Yeni Veri Modeli

### 2.1 Portfolio Equity Serisi (Mevcut Mantık - Doğru)

```
Başlangıç: equity = initial_capital (örn: 1000 TL)

Her kapanan işlem için (closed_at sırasına göre):
  - Long:  pnl = position_amount * ((exit_price - entry_price) / entry_price)
  - Short: pnl = position_amount * ((entry_price - exit_price) / entry_price)
  
  equity += pnl
```

**Önemli:** İşlem açma anında equity değişmez. Sadece kapanışlarda güncellenir.

### 2.2 Benchmark Equity Serisi (Yeni Mantık)

Her benchmark için, **aynı işlemler üzerinden** simüle edilmiş equity:

```
Başlangıç: bench_equity = initial_capital

Her kapanan işlem için:
  - entry_date = opened_at (veya created_at)
  - exit_date = closed_at
  - position_amount_tl = işleme ayrılan para
  
  - units = position_amount_tl / benchmark_price(entry_date)
  - bench_value_at_exit = units * benchmark_price(exit_date)
  - bench_pnl = bench_value_at_exit - position_amount_tl
  
  bench_equity += bench_pnl
```

Bu sayede: "Aynı tarihlerde aynı parayla bu enstrümana yatırsaydım ne olurdu?" sorusuna cevap verilir.

### 2.3 Periyot Seçimi ve Normalizasyon

Periyot butonları: **1A, 3A, 1Y, YB** (Yılbaşından Beri)

Seçilen periyodun başlangıcında:
- `portfolio_return_pct = 0` (baseline)
- `bench_relative_diff_pct = bench_return - portfolio_return`

---

## 3. Grafik Görünümü

### 3.1 Portföy Referanslı Görüntü

```
- Portföy çizgisi: 0% referans çizgisi (görünmez veya ince kesikli)
- Benchmark çizgileri: Portföye göre yüzdesel fark olarak çizilir
  - > 0: Benchmark portföyden iyi performans göstermiş
  - < 0: Benchmark portföyden kötü performans göstermiş
```

### 3.2 Y Ekseni

```
+5% ----
 0% ---- (Portföy baseline)
-5% ----
```

### 3.3 Benchmark Toggle'ları

Mevcut toggle sistemi korunacak:
- Dolar (USD)
- Euro (EUR)
- Altın (XAU)
- BIST 100
- NASDAQ 100
- Enflasyon (TR)

---

## 4. Sağ Panel Tasarımı

### 4.1 Panel İçeriği

```
┌─────────────────────────────┐
│ 📊 Portföy                  │
│ Güncel: 1.375 ₺             │
│ 1.000 ₺ → 1.375 ₺ (+37.5%)  │
├─────────────────────────────┤
│ 💵 Dolar (seçiliyse)        │
│ Simüle: 1.420 ₺             │
│ Portföye göre: +3.3%        │
├─────────────────────────────┤
│ 💰 Altın (seçiliyse)        │
│ Simüle: 1.510 ₺             │
│ Portföye göre: +9.8%        │
├─────────────────────────────┤
│ 📈 Enflasyon                │
│ 1.000 ₺ → 1.450 ₺           │
│ (Aynı alım gücü için)       │
└─────────────────────────────┘
```

### 4.2 Hover/Tıklama Davranışı

- Varsayılan: Periyodun son noktası
- Grafikte bir noktaya hover/tıklayınca: O tarihin değerleri

---

## 5. Tooltip Tasarımı

Tıklanan noktada gösterilecek:

```
┌────────────────────────────────┐
│ 15 Ocak 2026                   │
├────────────────────────────────┤
│ Portföy: 1.250 ₺ (+25.0%)      │
│ Dolar:   1.280 ₺ (+28.0%)      │
│ → Dolar %3.0 önde              │
├────────────────────────────────┤
│ Enflasyon: 1.000 ₺ → 1.380 ₺   │
└────────────────────────────────┘
```

---

## 6. Teknik Uygulama Detayları

### 6.1 Yeni TimeRange Seçenekleri

```typescript
// src/types/trade.ts - TIME_RANGES güncelleme
export const TIME_RANGES: TimeRangeOption[] = [
  { id: '1m', label: '1A' },    // 1 Ay
  { id: '3m', label: '3A' },    // 3 Ay
  { id: '1y', label: '1Y' },    // 1 Yıl
  { id: 'ytd', label: 'YB' },   // Yılbaşından Beri
];
```

### 6.2 Benchmark Fiyat Verisi Eşleştirme

Edge function'dan gelen günlük veriler:
- Eksik gün (haftasonu/tatil): En yakın önceki işlem günü verisi kullanılır (carry-back)

```typescript
function findPriceAtDate(points: SeriesPoint[], targetDate: Date): number {
  // Tarihe eşit veya önceki en yakın veriyi bul
  let latestPrice = points[0]?.value;
  for (const point of points) {
    if (parseISO(point.date) <= targetDate) {
      latestPrice = point.value;
    } else break;
  }
  return latestPrice;
}
```

### 6.3 Hook: useEquityCurve

Yeni bir custom hook oluşturulacak:

```typescript
interface EquityCurveData {
  // Ham veri
  portfolioEquity: { date: string; value: number }[];
  benchmarkEquities: Record<MarketAsset, { date: string; value: number }[]>;
  
  // Normalize veri (grafik için)
  chartData: ChartDataPoint[];
  
  // Özet istatistikler
  summary: {
    initialCapital: number;
    currentPortfolioValue: number;
    portfolioReturnPct: number;
    benchmarkDiffs: Record<MarketAsset, number>;
    inflationPurchasingPower: { from: number; to: number };
  };
}

function useEquityCurve(
  closedTrades: Trade[],
  timeRange: TimeRange,
  selectedBenchmarks: MarketAsset[],
  initialCapital: number
): EquityCurveData
```

### 6.4 Enflasyon Hesaplaması

Enflasyon verisi aylık yüzde değişim olarak geliyor. Kümülatif hesaplama:

```typescript
function calculateInflationPurchasingPower(
  inflationPoints: SeriesPoint[],
  startDate: Date,
  endDate: Date,
  initialAmount: number
): { from: number; to: number } {
  // Seçili dönemdeki enflasyon oranlarını kümülatif uygula
  let factor = 1;
  for (const point of inflationPoints) {
    const pointDate = parseISO(point.date);
    if (pointDate >= startDate && pointDate <= endDate) {
      factor *= (1 + point.value / 100);
    }
  }
  
  return {
    from: initialAmount,
    to: initialAmount * factor,
  };
}
```

---

## 7. Dosya Değişiklikleri

### 7.1 Güncellenecek Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `src/types/trade.ts` | TimeRange seçenekleri güncelleme (1w, 6m, 3y kaldır, ytd ekle) |
| `src/pages/Reports.tsx` | Sağ panel ve yeni hook entegrasyonu |
| `src/components/reports/EquityCurveChart.tsx` | Tamamen yeniden yazılacak |
| `src/components/reports/TimeRangeSelector.tsx` | Yeni seçeneklerle uyumlu |
| `src/contexts/MarketSeriesContext.tsx` | Benchmark veri yönetimi korunacak |

### 7.2 Yeni Oluşturulacak Dosyalar

| Dosya | Amaç |
|-------|------|
| `src/hooks/useEquityCurve.ts` | Equity curve hesaplama mantığı |
| `src/components/reports/EquityPanel.tsx` | Sağ taraf bilgi paneli |
| `src/components/reports/EquityTooltip.tsx` | Özelleştirilmiş tooltip |

---

## 8. Grafik Veri Akışı

```
trades (Supabase)
      │
      ▼
useEquityCurve Hook
      │
      ├── Portfolio Equity hesapla (kapanış PnL'lerinden)
      │
      ├── Benchmark Equity hesapla (her işlem için simülasyon)
      │       │
      │       └── market-series API (Stooq/EVDS)
      │
      └── Relative Diff hesapla (bench - portfolio)
              │
              ▼
        ChartData + Summary
              │
              ▼
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
EquityCurveChart    EquityPanel
```

---

## 9. Edge Case'ler ve Çözümler

### 9.1 Benchmark Verisi Eksik Gün
- **Sorun:** Hafta sonu veya resmi tatilde fiyat verisi yok
- **Çözüm:** Carry-back (en yakın önceki işlem günü)

### 9.2 İşlem Açma Tarihinde Benchmark Verisi Yok
- **Sorun:** İşlem çok eski veya veri eksik
- **Çözüm:** Mevcut en eski veri noktasını kullan, uyarı göster

### 9.3 position_amount Boş
- **Sorun:** Eski işlemlerde işlem tutarı girilmemiş
- **Çözüm:** Bu işlemler equity hesabına dahil edilmez, kullanıcıya bilgi mesajı

### 9.4 Enflasyon Verisi Aylık
- **Sorun:** Günlük interpolasyon gerekli mi?
- **Çözüm:** Hayır, aylık step function olarak kullan (ay başlarında değişir)

### 9.5 Grafikte Veri Noktası Sayısı
- **Sorun:** 1 yıllık dönemde 365 nokta çok kalabalık
- **Çözüm:** Haftalık veya aylık gruplama (mevcut mantık korunacak)

---

## 10. Kabul Kriterleri

1. Farklı tarihlerde farklı tutarlarla işlemler açıp kapatınca portföy equity doğru hesaplanıyor
2. İşlem açma anında grafikte zıplama/hoplama olmuyor
3. Benchmark equity "aynı işlemlerdeki para" senaryosuna göre doğru hesaplanıyor
4. Periyot değişince tüm veriler yeniden normalize ediliyor
5. Sağ panel güncel veya tıklanan tarihin değerlerini doğru gösteriyor
6. Tooltip'te portföye göre yüzdesel fark doğru
7. Enflasyon "1.000 ₺ → 1.450 ₺" formatında gösteriliyor
8. Dark theme korunuyor (dark gray arka plan, beyaz yazılar)
9. Mobilde responsive ve okunabilir

---

## 11. UI Mockup (Mobil Öncelikli)

```
┌──────────────────────────────────┐
│ Raporlarım                       │
│ İşlem performansınızı analiz edin│
├──────────────────────────────────┤
│ [Toplam] [KârAl%] [K/Z] [Seri]   │ ← Stats kartları
├──────────────────────────────────┤
│ Equity Curve      [1A|3A|1Y|YB] │
├──────────────────────────────────┤
│                                  │
│     Relative Performance (%)     │
│  +10% ─────────────────────      │
│   +5% ──────🟡──────────────     │
│    0% ════════════════════════   │ ← Portföy baseline
│   -5% ──────────────────────     │
│  -10% ─────────────────────      │
│       Jan   Feb   Mar   Apr      │
│                                  │
├──────────────────────────────────┤
│ 📊 Portföy                       │
│ Güncel: 1.375 ₺ (+37.5%)         │
│ 1.000 ₺ → 1.375 ₺                │
├──────────────────────────────────┤
│ 💵 Dolar    +3.3%                │
│ 💰 Altın    +9.8%                │
│ 📈 Enflasyon: 1.000→1.450 ₺      │
├──────────────────────────────────┤
│ Karşılaştır                      │
│ [Dolar] [Euro] [Altın] [BIST]    │
│ [NASDAQ] [Enflasyon]             │
└──────────────────────────────────┘
```

---

## 12. Uygulama Sırası

1. `src/types/trade.ts` - TimeRange güncelleme
2. `src/hooks/useEquityCurve.ts` - Yeni hook oluştur
3. `src/components/reports/EquityPanel.tsx` - Sağ panel bileşeni
4. `src/components/reports/EquityCurveChart.tsx` - Grafik yeniden yazımı
5. `src/pages/Reports.tsx` - Entegrasyon
6. Test ve hata düzeltme
