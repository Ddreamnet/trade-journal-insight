
# Plan: Alım Sebeplerini Stop Sebepleriyle Birleştirme

## Mevcut Durum

| Alan | Mevcut Seçenekler |
|------|-------------------|
| **TradeForm (İşlem Sebepleri)** | 10 adet: 14/22/50/100/200 MA Üstü, 3 trend kırılımı, hacim artışı, takas toplu |
| **CloseTradeModal (Stop Sebepleri)** | 18 adet: MA üstü/altı kapanışları, trend kırılımları, takas, hacim artış/azalış |

## İstenen Değişiklik

TradeForm'daki "İşlem Sebepleri" bölümü, CloseTradeModal'daki 18 seçenekli "Stop Sebepleri" listesiyle aynı olacak.

---

## Değişiklikler

### Dosya: `src/components/trade/TradeForm.tsx`

| Satır | Değişiklik |
|-------|------------|
| 7 | Import: `TRADE_REASONS` → `STOP_REASONS`, `TradeReason` → `StopReason` |
| 28 | State tipi: `TradeReason[]` → `StopReason[]` |
| 57-63 | `toggleReason` fonksiyonu: `TradeReason` → `StopReason` |
| 187 | Map: `TRADE_REASONS` → `STOP_REASONS` |

#### Kod Değişiklikleri

**Import (satır 7):**
```typescript
// Önce
import { Stock, TradeType, TradeReason, TRADE_REASONS } from '@/types/trade';

// Sonra
import { Stock, TradeType, StopReason, STOP_REASONS } from '@/types/trade';
```

**State (satır 28):**
```typescript
// Önce
const [reasons, setReasons] = useState<TradeReason[]>([]);

// Sonra
const [reasons, setReasons] = useState<StopReason[]>([]);
```

**Toggle fonksiyonu (satır 57-63):**
```typescript
// Önce
const toggleReason = (reasonId: TradeReason) => { ... };

// Sonra
const toggleReason = (reasonId: StopReason) => { ... };
```

**Liste render (satır 186-204):**
```typescript
// Önce
{TRADE_REASONS.map((reason) => ( ... ))}

// Sonra
{STOP_REASONS.map((reason) => ( ... ))}
```

---

## Sonuç

Her iki formda da aynı 18 seçenek görünecek:

| Seçenek | Label |
|---------|-------|
| 14ma_ustu_kapanis | 14 MA Üstü Kapanış |
| 14ma_alti_kapanis | 14 MA Altı Kapanış |
| 22ma_ustu_kapanis | 22 MA Üstü Kapanış |
| 22ma_alti_kapanis | 22 MA Altı Kapanış |
| 50ma_ustu_kapanis | 50 MA Üstü Kapanış |
| 50ma_alti_kapanis | 50 MA Altı Kapanış |
| 100ma_ustu_kapanis | 100 MA Üstü Kapanış |
| 100ma_alti_kapanis | 100 MA Altı Kapanış |
| 200ma_ustu_kapanis | 200 MA Üstü Kapanış |
| 200ma_alti_kapanis | 200 MA Altı Kapanış |
| yukselen_trend_asagi_kirilimi | Yükselen Trend Aşağı Kırılımı |
| dusen_trend_yukari_kirilimi | Düşen Trend Yukarı Kırılımı |
| yatay_trend_yukari_kirilimi | Yatay Trend Yukarı Kırılımı |
| yatay_trend_asagi_kirilimi | Yatay Trend Aşağı Kırılımı |
| takas_toplu | Takas Toplu |
| takas_bozulmus | Takas Bozulmuş |
| hacim_artisi | Hacim Artışı |
| hacim_azalisi | Hacim Azalışı |

---

## Teknik Not

- Database'deki `reasons` sütunu `text[]` tipinde olduğundan, yeni ID'ler sorunsuz kaydedilecek
- Mevcut trade'lerdeki eski ID'ler (örn: `14_ma_ustu`) görüntülemede eşleşmeyebilir, ancak yeni işlemler doğru çalışacak
