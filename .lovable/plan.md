
# Revize Plan: 100 Bazlı Retroaktif Equity Curve (Düzeltmeler Dahil)

## Kritik Düzeltmeler Özeti

Bu plan önceki onaylanan planın üzerine inşa edilmiştir ve aşağıdaki kritik düzeltmeleri içermektedir:

| # | Sorun | Düzeltme |
|---|-------|----------|
| 1 | Test senaryosunda aritmetik hata | Doğru hesaplama: 1000 + 3750 = 4750 (3750 değil) |
| 2 | t0 sadece closed trades'den hesaplanıyor | t0 = TÜM trades'in en erken created_at tarihi |
| 3 | Same-day trade bug (open==close) | Aynı gün kapanan işlemlere 1 günlük katkı yazılacak |
| 4 | startingCapital sabit 1000 TL | Kullanıcı ayarlayabilecek veya ilk position_amount default |
| 5 | Overlap TL bazlı netleştirme | Yüzde değil, TL bazlı günlük katkılar toplanacak |
| 6 | Empty state eksik | 0 closed trade = "Henüz kapanmış işlem yok" mesajı |
| 7 | Benchmark carry-forward | Boş günlerde son bilinen değer taşınacak |

---

## Düzeltilmiş Hesaplama Algoritması

### 1. t0 Belirleme (TÜM İşlemlerden)

```text
// YANLIŞ (eski):
const t0 = closedTrades.reduce((earliest, trade) => ...)

// DOĞRU:
const t0 = allTrades.reduce((earliest, trade) => {
  const tradeStart = parseISO(trade.created_at);
  return tradeStart < earliest ? tradeStart : earliest;
}, new Date());
```

Grafik üretimi kuralı:
- 0 kapanmış işlem varsa: Empty state göster
- En az 1 kapanmış işlem varsa: t0'dan bugüne seri üret

### 2. Same-Day Trade Bug Düzeltmesi

```text
// Eski kod (HATALI):
const days = differenceInDays(endDate, startDate) || 1;
while (currentDay < endDate) { ... }  // endDate == startDate ise loop çalışmaz!

// Düzeltilmiş kod:
const days = differenceInDays(endDate, startDate);

if (days === 0) {
  // Same-day trade: tüm PnL'i o güne yaz
  const key = format(startDate, 'yyyy-MM-dd');
  dailyPnL.set(key, (dailyPnL.get(key) || 0) + pnl);
} else {
  // Normal: günlere dağıt (created_at dahil, closed_at hariç)
  const dailyContribution = pnl / days;
  let currentDay = startDate;
  while (currentDay < endDate) {
    const key = format(currentDay, 'yyyy-MM-dd');
    dailyPnL.set(key, (dailyPnL.get(key) || 0) + dailyContribution);
    currentDay = addDays(currentDay, 1);
  }
}
```

### 3. Düzeltilmiş Test Senaryosu

```text
İşlem A: 1 Ocak open, 5 Ocak close, 30000 TL, E=30, X=45
İşlem B: 3 Ocak open, 8 Ocak close, 50000 TL, E=50, X=60

Hesaplamalar:
A: pnl = 30000 × (45-30)/30 = 15000 TL
   D = 5 Ocak - 1 Ocak = 4 gün
   daily = 15000 / 4 = 3750 TL/gün
   Aktif günler: 1, 2, 3, 4 Ocak (5 hariç)

B: pnl = 50000 × (60-50)/50 = 10000 TL
   D = 8 Ocak - 3 Ocak = 5 gün
   daily = 10000 / 5 = 2000 TL/gün
   Aktif günler: 3, 4, 5, 6, 7 Ocak (8 hariç)

Günlük TL Katkıları:
├─ 1 Ocak: 3750 (A)
├─ 2 Ocak: 3750 (A)
├─ 3 Ocak: 3750 + 2000 = 5750 (A+B overlap)
├─ 4 Ocak: 3750 + 2000 = 5750 (A+B overlap)
├─ 5 Ocak: 2000 (B, A kapandı)
├─ 6 Ocak: 2000 (B)
├─ 7 Ocak: 2000 (B)
└─ 8+ Ocak: 0 (hepsi kapandı)

Kümülatif Portföy (P0=1000 TL):
├─ 1 Ocak: 1000 + 3750 = 4750 TL → Index: 475
├─ 2 Ocak: 4750 + 3750 = 8500 TL → Index: 850
├─ 3 Ocak: 8500 + 5750 = 14250 TL → Index: 1425
├─ 4 Ocak: 14250 + 5750 = 20000 TL → Index: 2000
├─ 5 Ocak: 20000 + 2000 = 22000 TL → Index: 2200
├─ 6 Ocak: 22000 + 2000 = 24000 TL → Index: 2400
├─ 7 Ocak: 24000 + 2000 = 26000 TL → Index: 2600
└─ 8+ Ocak: 26000 TL → Index: 2600 (düz devam)

Toplam PnL = 15000 + 10000 = 25000 TL
Son değer = 1000 + 25000 = 26000 TL ✓
```

### 4. Same-Day Trade Test Senaryosu (Yeni)

```text
İşlem C: 10 Ocak open, 10 Ocak close (aynı gün), 20000 TL, E=100, X=110

pnl = 20000 × (110-100)/100 = 2000 TL
D = 0 gün (same-day)
→ Tüm 2000 TL, 10 Ocak'a yazılır (tek gün)

Portföy (P0=1000 TL):
├─ 9 Ocak: 1000 TL → Index: 100
├─ 10 Ocak: 1000 + 2000 = 3000 TL → Index: 300
└─ 11+ Ocak: 3000 TL → Index: 300 (düz)
```

---

## Dosya Değişiklikleri

### Dosya 1: `src/components/reports/EquityCurveChart.tsx`

Tamamen yeniden yazılacak. Ana değişiklikler:

```typescript
interface EquityCurveChartProps {
  timeRange: TimeRange;
  selectedBenchmarks: string[];
  benchmarks: BenchmarkData[];
  allTrades: Trade[];           // YENİ: t0 hesabı için tüm trade'ler
  closedTrades: Trade[];        // Grafik hesabı için kapanmış olanlar
  startingCapital: number;      // YENİ: Kullanıcı ayarlayabilir
}

// t0 hesabı - TÜM trade'lerden
function calculateT0(allTrades: Trade[]): Date | null {
  if (allTrades.length === 0) return null;
  return allTrades.reduce((earliest, trade) => {
    const d = parseISO(trade.created_at);
    return d < earliest ? d : earliest;
  }, parseISO(allTrades[0].created_at));
}

// Same-day bug düzeltmeli PnL dağıtımı
function calculateDailyPnLContributions(
  closedTrades: Trade[]
): Map<string, number> {
  const dailyPnL = new Map<string, number>();

  for (const trade of closedTrades) {
    if (!trade.position_amount || !trade.exit_price || !trade.closed_at) continue;

    const r = trade.trade_type === 'buy'
      ? (trade.exit_price - trade.entry_price) / trade.entry_price
      : (trade.entry_price - trade.exit_price) / trade.entry_price;
    const pnl = trade.position_amount * r;

    const startDate = startOfDay(parseISO(trade.created_at));
    const endDate = startOfDay(parseISO(trade.closed_at));
    const days = differenceInDays(endDate, startDate);

    if (days === 0) {
      // Same-day trade: tek güne yaz
      const key = format(startDate, 'yyyy-MM-dd');
      dailyPnL.set(key, (dailyPnL.get(key) || 0) + pnl);
    } else {
      // Normal: günlere dağıt
      const dailyContribution = pnl / days;
      let currentDay = startDate;
      while (currentDay < endDate) {
        const key = format(currentDay, 'yyyy-MM-dd');
        dailyPnL.set(key, (dailyPnL.get(key) || 0) + dailyContribution);
        currentDay = addDays(currentDay, 1);
      }
    }
  }

  return dailyPnL;
}

// Benchmark carry-forward normalizasyonu
function normalizeBenchmarkFromT0WithCarryForward(
  points: MarketSeriesPoint[],
  t0: Date,
  endDate: Date
): MarketSeriesPoint[] {
  // t0'daki değeri bul (carry-forward ile)
  const t0Value = findValueAtDateWithCarryForward(points, t0);
  if (!t0Value) return [];

  // Her gün için değer üret
  const result: MarketSeriesPoint[] = [];
  let lastKnownValue = t0Value;
  let currentDay = t0;

  while (currentDay <= endDate) {
    const key = format(currentDay, 'yyyy-MM-dd');
    const pointValue = points.find(p => p.date === key)?.value;
    
    if (pointValue !== undefined) {
      lastKnownValue = pointValue;
    }
    
    result.push({
      date: key,
      value: 100 * (lastKnownValue / t0Value),
    });
    
    currentDay = addDays(currentDay, 1);
  }

  return result;
}
```

### Dosya 2: `src/pages/Reports.tsx`

Değişiklikler:
- `allTrades` prop'u eklenecek (t0 hesabı için)
- `startingCapital` state olarak eklenecek
- Küçük bir ayar butonu/input eklenecek

```typescript
export default function Reports() {
  const [startingCapital, setStartingCapital] = useState<number>(() => {
    // İlk trade'in position_amount'u veya default 1000
    return 1000;
  });
  
  const { trades, closedTrades, isLoading } = useTrades();

  // İlk yüklemede default'u ayarla
  useEffect(() => {
    if (trades.length > 0 && startingCapital === 1000) {
      const firstTrade = [...trades].sort(
        (a, b) => parseISO(a.created_at).getTime() - parseISO(b.created_at).getTime()
      )[0];
      if (firstTrade?.position_amount) {
        setStartingCapital(firstTrade.position_amount);
      }
    }
  }, [trades]);

  return (
    // ...
    <EquityCurveChart
      timeRange={selectedTimeRange}
      selectedBenchmarks={selectedBenchmarks}
      benchmarks={BENCHMARKS}
      allTrades={trades}
      closedTrades={filteredTrades}
      startingCapital={startingCapital}
    />
    
    {/* Başlangıç sermayesi ayarı */}
    <div className="flex items-center gap-2 mt-4">
      <label className="text-sm text-muted-foreground">
        Başlangıç Sermayesi:
      </label>
      <input
        type="number"
        value={startingCapital}
        onChange={(e) => setStartingCapital(Number(e.target.value) || 1000)}
        className="w-24 px-2 py-1 text-sm rounded border"
        min={100}
      />
      <span className="text-sm text-muted-foreground">TL</span>
    </div>
  );
}
```

### Dosya 3: `src/contexts/MarketSeriesContext.tsx`

Enflasyon bileşik endeks fonksiyonu eklenecek:

```typescript
// Enflasyon aylık oranlarını bileşik endekse çevir
const convertInflationToCompoundIndex = useCallback(
  (monthlyRates: MarketSeriesPoint[], t0: Date): MarketSeriesPoint[] => {
    if (!monthlyRates || monthlyRates.length === 0) return [];

    // t0'dan önceki oranları filtrele, sonrakileri hesapla
    const sortedRates = [...monthlyRates].sort(
      (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()
    );

    // t0 ayını bul
    const t0Month = format(t0, 'yyyy-MM');
    const t0Index = sortedRates.findIndex(r => r.date.startsWith(t0Month));
    
    // t0'dan itibaren bileşik hesapla
    let index = 100;
    const result: MarketSeriesPoint[] = [];

    for (let i = t0Index; i < sortedRates.length; i++) {
      const rate = sortedRates[i].value;
      if (i > t0Index) {
        index = index * (1 + rate / 100);
      }
      result.push({
        date: sortedRates[i].date,
        value: parseFloat(index.toFixed(2)),
      });
    }

    return result;
  },
  []
);
```

---

## UI Bileşenleri

### Empty State (0 kapanmış işlem)

```typescript
if (closedTradesWithPositionAmount.length === 0) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground text-sm mb-2">
          Henüz kapanmış işlem bulunmuyor
        </p>
        <p className="text-xs text-muted-foreground">
          İşlemler kapandığında grafik burada görünecek
        </p>
      </div>
    </div>
  );
}
```

### Sağ Değer Paneli

```typescript
function ValuePanel({ 
  portfolioValue, 
  benchmarkValues, 
  inflationValue,
  benchmarks,
  selectedBenchmarks 
}: ValuePanelProps) {
  return (
    <div className="w-28 border-l border-border pl-3 flex flex-col gap-2">
      {/* Portföy */}
      <div>
        <div className="text-xs text-muted-foreground">Portföy</div>
        <div className="text-lg font-bold text-primary font-mono">
          {portfolioValue.toFixed(1)}
        </div>
      </div>

      {/* Benchmarklar */}
      {selectedBenchmarks
        .filter(id => id !== 'inflation_tr')
        .map(id => {
          const benchmark = benchmarks.find(b => b.id === id);
          const value = benchmarkValues[id];
          if (!benchmark || value === undefined) return null;
          
          return (
            <div key={id}>
              <div className="text-xs text-muted-foreground">
                {benchmark.symbol}
              </div>
              <div 
                className="text-sm font-semibold font-mono"
                style={{ color: benchmark.color }}
              >
                {value.toFixed(1)}
              </div>
            </div>
          );
        })}

      {/* Enflasyon (özel format) */}
      {selectedBenchmarks.includes('inflation_tr') && (
        <div>
          <div className="text-xs text-muted-foreground">Enflasyon</div>
          <div className="text-sm font-semibold font-mono text-orange-500">
            100 → {inflationValue.toFixed(0)} TL
          </div>
        </div>
      )}
    </div>
  );
}
```

### Tooltip (Portföye Göre Fark)

```typescript
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  const portfolioValue = payload.find(p => p.dataKey === 'portfolioIndex')?.value;

  return (
    <div className="bg-popover border rounded-lg p-3 shadow-lg">
      <div className="font-medium mb-2">{label}</div>
      
      {/* Portföy */}
      <div className="flex justify-between gap-4">
        <span>Portföy:</span>
        <span className="font-mono font-semibold">
          {portfolioValue?.toFixed(1)}
        </span>
      </div>

      <hr className="my-2 border-border" />

      {/* Benchmarklar ve farkları */}
      {payload.filter(p => p.dataKey !== 'portfolioIndex').map(p => {
        const diff = ((p.value / portfolioValue) - 1) * 100;
        const diffText = diff >= 0 
          ? `portföyün %${diff.toFixed(1)} önünde`
          : `portföyün %${Math.abs(diff).toFixed(1)} gerisinde`;
        
        return (
          <div key={p.dataKey} className="text-sm">
            <span style={{ color: p.color }}>{p.name}:</span>{' '}
            <span className="font-mono">{p.value?.toFixed(1)}</span>
            <div className="text-xs text-muted-foreground">{diffText}</div>
          </div>
        );
      })}
    </div>
  );
};
```

---

## Özet: Yapılacak Değişiklikler

| Dosya | Değişiklik Türü | Açıklama |
|-------|-----------------|----------|
| `EquityCurveChart.tsx` | Tamamen yeniden yaz | t0 düzeltmesi, same-day fix, carry-forward, sağ panel |
| `Reports.tsx` | Güncelle | allTrades prop'u, startingCapital state ve ayar UI |
| `MarketSeriesContext.tsx` | Fonksiyon ekle | convertInflationToCompoundIndex |

---

## Doğrulama Testleri

Uygulama sonrası şunlar kontrol edilmeli:

1. **Overlap testi**: A/B senaryosu ile günlük katkılar doğru mu?
2. **Same-day testi**: Aynı gün açılıp kapanan trade PnL kaybediyor mu?
3. **t0 testi**: Açık trade varken t0 doğru seçiliyor mu?
4. **Empty state**: Hiç kapanmış trade yokken mesaj gösteriliyor mu?
5. **Benchmark carry-forward**: Hafta sonu günlerinde değerler korunuyor mu?
