

# Kismi Kapanislari "Kapali Portfoyler" Sekmesinde Gosterme

## Sorun

Su an "Kapali Portfoyler" sekmesi sadece `trades` tablosundaki `status = 'closed'` kayitlari gosteriyor. Bir hissenin sadece bir kisminin kapatildigi durumlarda (ornegin 100 lotun 50'si satildiysa), trade hala `active` statusunde kalir ve kapali portfoyde hicbir sey gorunmez. Kullanici her kismi kapanisi ayri bir kart/satir olarak gormek istiyor.

## Cozum

`trade_partial_closes` tablosundan verileri cekip, her bir kismi kapanis kaydini parent trade bilgileriyle birlestirerek "Kapali Portfoyler" sekmesinde gostermek.

## Teknik Degisiklikler

### 1. `src/hooks/useTrades.ts`

- `trade_partial_closes` tablosundan verileri ceken yeni bir query ekle
- Her partial close kaydini parent trade bilgileriyle (stock_symbol, stock_name, trade_type, entry_price, target_price, stop_price, reasons, rr_ratio) eslestir
- Yeni bir `ClosedTradeEntry` tipi tanimla:

```text
ClosedTradeEntry {
  id: string              // partial close id
  trade_id: string        // parent trade id
  stock_symbol: string
  stock_name: string
  trade_type: 'buy' | 'sell'
  entry_price: number
  target_price: number
  stop_price: number
  reasons: string[]
  rr_ratio: number | null
  exit_price: number
  closing_type: string
  stop_reason: string | null
  closing_note: string | null
  lot_quantity: number    // kapatilan lot miktari
  realized_pnl: number | null
  created_at: string      // kapanma tarihi
}
```

- `closedTradeEntries` adinda yeni bir dizi don (tarihe gore sirali)
- Mevcut `closedTrades` (tam kapanis) yerine bu yeni listeyi kullan

### 2. `src/components/trade/TradeList.tsx`

- `type === 'closed'` icin yeni `ClosedTradeEntry` tipini kabul et
- Kapali trade listesi icin `Trade` yerine `ClosedTradeEntry` tipini kullan
- Her satir/kart su bilgileri gosterir:
  - Hisse sembol ve adi (parent trade'den)
  - Alis/Satis turu
  - Entry, Target, Stop fiyatlari (parent trade'den)
  - Exit fiyati (partial close'dan)
  - Lot miktari (kapatilan lot)
  - Sonuc (Kar Al / Stop)
  - Sebepler (parent trade'den)
  - RR (parent trade'den)
  - Not ve stop sebebi (partial close'dan)
- Edit ve delete butonlari kapali kayitlarda gosterilmez (partial close kayitlari degistirilemez)

### 3. `src/pages/Index.tsx`

- `closedTrades` yerine `closedTradeEntries` kullan
- Tab badge sayisi `closedTradeEntries.length` olacak

## Degisecek Dosyalar

| Dosya | Degisiklik |
|-------|-----------|
| `src/hooks/useTrades.ts` | `trade_partial_closes` query + `ClosedTradeEntry` tipi + parent trade eslestirme |
| `src/components/trade/TradeList.tsx` | Kapali portfoy icin `ClosedTradeEntry` desteği, props guncellemesi |
| `src/pages/Index.tsx` | `closedTradeEntries` kullanimi |

