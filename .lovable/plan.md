

# Eksik Maddelerin Tamamlanması Planı

Mevcut uygulamada 5 eksik madde tespit edildi. Bunlar planın onaylanan versiyonunda yer alan ama henüz kodlanmamış maddelerdir.

---

## 1. createTrade: Doğrudan INSERT yerine RPC Kullanımı

**Sorun:** `useTrades.ts` satır 72-86'da `supabase.from('trades').insert(...)` kullanılıyor. Bu atomik nakit kontrolü sağlamıyor.

**Çözüm:** `createTrade` mutation'ını `supabase.rpc('create_trade_with_cash_check', ...)` çağrısına dönüştür. RPC uuid döndürdüğü için, dönen trade_id ile `supabase.from('trades').select('*').eq('id', trade_id).single()` ile tam kaydı çek.

**Değişecek dosya:** `src/hooks/useTrades.ts`

---

## 2. CloseTradeModal: Kısmi Çıkış UI ve RPC Entegrasyonu

**Sorun:** CloseTradeModal'da "Satılacak Lot" alanı, "Tüm Lotlar" butonu yok. `close_trade_partial` RPC çağrılmıyor.

**Çözüm:**
- Çıkış fiyatı alanının altına "Satılacak Lot" NumberInput (step="1", tam sayı) ekle
- "Tüm Lotlar (remaining_lot)" butonu ekle
- Validasyon: lot > 0 VE lot <= remaining_lot
- Bilgi satırı: "Gerçekleşen K/Z: (exit - entry) * lot TL" (trade_type'a göre)
- `onConfirm` callback'ine `lotQuantity` parametresi ekle

**Değişecek dosyalar:**
- `src/components/trade/CloseTradeModal.tsx` -- lot alanı + UI
- `src/components/trade/TradeList.tsx` -- onConfirm parametresi güncelle
- `src/pages/Index.tsx` -- handleCloseTrade parametresi güncelle

---

## 3. closeTrade Mutation: close_trade_partial RPC Kullanımı

**Sorun:** `useTrades.ts` satır 108-143'te doğrudan `supabase.from('trades').update(...)` yapılıyor.

**Çözüm:** `closeTrade` mutation'ını `supabase.rpc('close_trade_partial', ...)` çağrısına dönüştür. RPC partial_close id döndürdüğü için, sonrasında trade verisini yeniden çek ve cache güncelle. `CloseTradeParams` interface'ine `lotQuantity` ekle.

**Değişecek dosya:** `src/hooks/useTrades.ts`

---

## 4. useEquityCurveData: Legacy PnL Fallback

**Sorun:** `trades_sync_lot` trigger'ı `position_amount = entry_price * lot_quantity` yapıyor. Eski kapanmış işlemlerde lot_quantity=0 olduğundan migration sonrası position_amount da 0 olacak. Bu equity curve'de bu işlemlerin PnL'inin kaybolmasına yol açar.

**Kritik Karar:** Migration'da eski kayıtları UPDATE ettiğimizde trigger tetiklenir ve `position_amount` sıfırlanır. Bu sorunu önlemek için iki seçenek:
- **Seçenek A:** Trigger'ı lot_quantity=0 ise position_amount'a dokunmaması için güncelle
- **Seçenek B:** Migration'dan sonra eski position_amount değerlerini geri yükle

Seçenek A daha temiz: Trigger'da `IF NEW.lot_quantity > 0 THEN NEW.position_amount := NEW.entry_price * NEW.lot_quantity; END IF;` şeklinde güncelle. Böylece lot=0 olan kayıtların eski position_amount değeri korunur.

Ayrıca `useEquityCurveData` satır 93'teki `calculateDailyPnLContributions` fonksiyonunda fallback eklenmeli: lot_quantity=0 ve position_amount>0 olan kayıtlar için mevcut hesaplama zaten çalışır (position_amount kullanıyor). Ek fallback gerekmez, yeter ki trigger position_amount'ı sıfırlamasın.

**Değişecek dosyalar:**
- Yeni migration SQL (trigger güncelleme)
- `src/hooks/useEquityCurveData.ts` -- Doğrulama (mevcut kod zaten position_amount bazlı, fallback otomatik çalışır)

---

## 5. EditTradeModal: Lot Değiştiğinde remaining_lot Eşitleme

**Sorun:** Kısmi kapanışı olmayan aktif işlemlerde lot düzenlendiğinde remaining_lot otomatik eşitlenmiyor.

**Çözüm:** `updateTrade` mutation'ında, eğer `lot_quantity` değişiyorsa ve `hasPartialCloses` false ise, `remaining_lot = lot_quantity` olarak da güncelle. Bu mantığı EditTradeModal'daki handleSave'de uygula: updateData'ya `remaining_lot` ekle.

**Değişecek dosyalar:**
- `src/components/trade/EditTradeModal.tsx` -- handleSave'de remaining_lot ekleme

---

## Uygulama Sırası

| Adım | İş | Gerekçe |
|------|----|---------|
| 1 | Trigger güncelle (lot=0 ise position_amount'a dokunma) | Veri bütünlüğü |
| 2 | useTrades: createTrade RPC | Atomik nakit kontrolü |
| 3 | useTrades: closeTrade RPC + lotQuantity parametresi | Kısmi çıkış altyapısı |
| 4 | CloseTradeModal: lot UI + RPC entegrasyonu | Kısmi çıkış arayüzü |
| 5 | EditTradeModal: remaining_lot eşitleme | Lot düzenleme tutarlılığı |

