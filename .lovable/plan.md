

# Aktif ve Kapali Portfoy Etklesim Degisiklikleri

## Ozet

Aktif portfoylerde duzenleme ikonu kaldirilip hisse gorseli+ismi tiklanabilir hale getirilecek. Kapali portfoylerde de ayni alan tiklanabilir olacak ve acilan dialogda "Geri Al" ve "Sil" secenekleri sunulacak.

## 1. Aktif Portfoy: Hisse Alani Tiklanabilir Olsun

**Dosya:** `src/components/trade/TradeList.tsx`

- Desktop ve mobile gorunumde hisse gorseli + isim alani `cursor-pointer` ve `hover` efekti ile buton haline getirilecek
- Tiklandiginda mevcut `setEditingTrade(trade)` cagirilacak (ayni EditTradeModal acilacak)
- Kalem (Pencil) ikonu **aktif islemler icin** kaldirilacak
- Not (StickyNote) ikonu oldugu gibi kalacak

## 2. Kapali Portfoy: Hisse Alani Tiklanabilir + Yeni Dialog

**Dosya:** `src/components/trade/TradeList.tsx`

- Kapali portfoylerde (ClosedEntries) hisse gorseli + isim alanina tiklandiginda yeni bir dialog acilacak
- Bu dialog iki secenek sunacak:
  - **Geri Al**: Kapanisi geri alir, islem aktif portfoye doner
  - **Sil**: Islemi tamamen siler (hic acilmamis gibi)
- Her iki islem icin onay (AlertDialog) gosterilecek

## 3. Geri Alma Islemi (Revert)

**Dosya:** `src/hooks/useTrades.ts`

Yeni bir `revertPartialClose` mutation eklenecek:

1. `trade_partial_closes` tablosundan ilgili kayit silinecek
2. Parent trade'in `remaining_lot` degeri geri arttirilacak (kapatilan lot kadar)
3. Eger trade statusu `closed` ise (tam kapanmissa), status `active`'e cevirilecek ve `exit_price`, `closing_type`, `stop_reason`, `closing_note`, `closed_at` alanlari temizlenecek
4. Ilgili `portfolio_events` kaydi da silinecek (PnL eventi)
5. Tum ilgili query'ler invalidate edilecek: `trades`, `trade_partial_closes`, `portfolio_events`, `portfolio_snapshots`, `portfolioCash`, `equityCurve`

**Onemli:** `portfolio_events` tablosunda `trade_id` alani var. Kapanisa ait PnL event'i bu trade_id ile bulunup silinecek. Ancak partial close'larda PnL event'i `trade_partial_closes` trigger'i uzerinden degil, `close_trade_partial` RPC icinde olusturulmuyor - mevcut trigger `create_pnl_event_on_trade_close` sadece tam kapanislarda calisiyor. Bu nedenle geri alma islemi sirasinda portfolio_events'ten ilgili kaydin silinmesi gerekecek.

## 4. Silme Islemi (Delete Closed Trade)

**Dosya:** `src/hooks/useTrades.ts`

Yeni bir `deleteClosedTrade` mutation eklenecek:

1. `trade_partial_closes` tablosundan bu trade'e ait tum kayitlar silinecek
2. `portfolio_events` tablosundan bu trade_id ile iliskili tum PnL eventleri silinecek
3. `trades` tablosundan trade silinecek
4. Tum ilgili query'ler invalidate edilecek

## 5. TradeList Props Guncelleme

**Dosya:** `src/components/trade/TradeList.tsx`

TradeListProps'a yeni callback'ler eklenecek:
- `onRevertClose?: (entryId: string, tradeId: string) => void`
- `onDeleteClosedTrade?: (entryId: string, tradeId: string) => void`

## 6. Index Sayfasi Entegrasyonu

**Dosya:** `src/pages/Index.tsx`

- Kapali portfoy TradeList'e yeni handler'lar baglanacak
- `useTrades` hook'undan yeni mutation'lar alinacak
- Handler fonksiyonlari olusturulacak

## 7. Grafik Guncellemesi

Mevcut grafik hook'lari (`useEquityCurveData`, `usePortfolioValueData`) zaten `portfolio_events` ve `portfolio_snapshots` query'lerine bagli. Bu query'ler invalidate edildiginde grafikler otomatik guncellenecek. Ek olarak `portfolioCash` query'si de invalidate edilecek ki kullanilabilir nakit dogru gosterilsin.

## Degisecek Dosyalar

| Dosya | Degisiklik |
|-------|-----------|
| `src/components/trade/TradeList.tsx` | Hisse alani tiklanabilir, pencil ikonu kaldirilma, kapali portfoy dialog ekleme |
| `src/hooks/useTrades.ts` | `revertPartialClose` ve `deleteClosedTrade` mutation'lari |
| `src/pages/Index.tsx` | Yeni handler'larin baglanmasi |

## Riskler

- **Snapshot tutarsizligi**: `portfolio_snapshots` tablosu trigger ile olusturuluyor. PnL event silindiginde ilgili snapshot da silinmeli veya recalculate edilmeli. En guvenli yol: ilgili snapshot'i da silmek ve sonraki snapshot'lari yeniden hesaplatmak. Ancak bu karmasik olabilir. Alternatif olarak sadece `portfolio_events`'ten silip snapshot'larin stale kalmasina izin verebiliriz - bu durumda equity curve verileri tam dogru olmayabilir. En iyi yaklasim: Geri alma/silme isleminde ilgili event_id'ye ait snapshot'i da silmek.
- **Partial close cascade**: Bir trade'in birden fazla partial close'u olabilir. Geri alma tek bir partial close icin calisacak. Tum trade'i silme ise hepsini temizleyecek.

