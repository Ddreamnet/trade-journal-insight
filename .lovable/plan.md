
# Plan: Trade Listesi UI İyileştirmeleri ve Çoklu Stop Sebep Seçimi

## Özet
Bu plan 4 temel değişikliği kapsıyor:
1. Düzenleme ve not ikonlarını satırın en sağına taşıma
2. Mobil görünümde düzenleme ikonunu not ikonu ile birlikte ekleme
3. Sebepler metnini mobilde alt satırlara akıtma, masaüstünde tooltip ile gösterme
4. İşlem kapatırken çoklu stop sebebi seçimine izin verme

---

## Değişiklikler

### 1. Desktop: İkonları Satırın En Sağına Taşıma
Düzenleme (Pencil) ve Not (StickyNote) ikonları şu anda ilk sütunda. Bunları satırın en sağına, yeni bir sütun olarak ekleyeceğiz.

**Değişiklikler:**
- `TableHead` ve `TableCell` için ilk sütundaki ikon sütununu kaldır
- Tablonun en sağına yeni bir "Aksiyon İkonları" sütunu ekle
- Aktif işlemlerde "Kapat" butonunun yanında, kapalı işlemlerde "Sonuç" sütununun sağında olacak

### 2. Mobil: Düzenleme ve Not İkonlarını Yan Yana Sağa Yerleştirme
Mobil kartlarda düzenleme ikonu sol üstte, şimdi sağ tarafa alınacak ve not ikonu yanına eklenecek.

**Değişiklikler:**
- Kart üst satırında düzenleme ikonunu sağ tarafa, RR'nin yanına taşı
- Not ikonu (varsa) düzenleme ikonunun hemen sağında olacak
- İkonlar için uygun boyut ve padding

### 3. Sebepler Metni: Mobilde Sarma, Desktop'ta Tooltip
Mobilde "..." gösterimi yerine metin alt satırlara akacak. Desktop'ta hover ile tooltip gösterilecek.

**Değişiklikler:**
- **Mobil:** `line-clamp-1` sınıfını kaldır, metnin doğal akmasına izin ver
- **Desktop:** Sebepler hücresine `Tooltip` ekle, hover'da tam listeyi göster

### 4. Çoklu Stop Sebep Seçimi
`CloseTradeModal`'da stop seçildiğinde RadioGroup yerine Checkbox listesi kullanılacak.

**Değişiklikler:**
- `stopReason` state'ini `string[]` tipine dönüştür
- `RadioGroup` yerine `Checkbox` listesi kullan
- Veritabanına kaydetmeden önce sebepleri virgülle birleştir veya array olarak kaydet
- Validation: en az bir sebep seçilmiş olmalı

---

## Teknik Detaylar

### Dosya: `src/components/trade/TradeList.tsx`

**Desktop Tablo Yapısı (yeni sütun sırası):**
```
Hisse | Tür | Entry | [Anlık] | Target | Stop | Sebepler | RR | [Exit] | [Sonuç] | [Kapat] | İkonlar
```

**Sebepler için Tooltip:**
```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="text-xs text-muted-foreground line-clamp-2 cursor-default">
        {getReasonLabels(trade.reasons)}
      </span>
    </TooltipTrigger>
    <TooltipContent className="max-w-xs">
      <p>{getReasonLabels(trade.reasons)}</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

**Mobil Kart İkon Yerleşimi:**
```tsx
{/* Row 1: Sol taraf (hisse bilgisi) + Sağ taraf (tür, RR, ikonlar) */}
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
    {/* Hisse ikonu ve bilgisi */}
  </div>
  <div className="flex items-center gap-2">
    {/* Tür badge, RR badge */}
    <div className="flex items-center gap-0.5">
      <button onClick={() => setEditingTrade(trade)}>
        <Pencil className="w-5 h-5" />
      </button>
      {(trade.closing_note || trade.stop_reason) && (
        <Popover>...</Popover>
      )}
    </div>
  </div>
</div>
```

**Mobil Sebepler (sarmalı):**
```tsx
<div className="text-[10px] text-muted-foreground mb-2">
  <span className="font-medium">Sebepler:</span> {getReasonLabels(trade.reasons)}
</div>
```

---

### Dosya: `src/components/trade/CloseTradeModal.tsx`

**State Değişikliği:**
```tsx
// Eski
const [stopReason, setStopReason] = useState<StopReason | ''>('');

// Yeni
const [stopReasons, setStopReasons] = useState<StopReason[]>([]);
```

**Checkbox Listesi:**
```tsx
import { Checkbox } from '@/components/ui/checkbox';

{closingType === 'stop' && (
  <div>
    <label className="text-sm font-medium text-muted-foreground mb-3 block">
      Stop Sebepleri (birden fazla seçebilirsiniz)
    </label>
    <div className="grid gap-2">
      {STOP_REASONS.map((reason) => (
        <Label
          key={reason.id}
          htmlFor={`stop-${reason.id}`}
          className={cn(
            'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
            stopReasons.includes(reason.id)
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-muted-foreground/50'
          )}
        >
          <Checkbox
            id={`stop-${reason.id}`}
            checked={stopReasons.includes(reason.id)}
            onCheckedChange={(checked) => {
              if (checked) {
                setStopReasons([...stopReasons, reason.id]);
              } else {
                setStopReasons(stopReasons.filter(r => r !== reason.id));
              }
            }}
          />
          <span className="text-sm text-foreground">{reason.label}</span>
        </Label>
      ))}
    </div>
  </div>
)}
```

**Validation Güncelleme:**
```tsx
const isValid = closingType !== null && 
  progressPercent !== null && 
  (closingType === 'kar_al' || (closingType === 'stop' && stopReasons.length > 0));
```

**handleConfirm Güncelleme:**
```tsx
const handleConfirm = () => {
  if (!closingType || progressPercent === null) return;
  if (closingType === 'stop' && stopReasons.length === 0) return;
  
  onConfirm(
    parseFloat(exitPrice),
    closingType,
    closingType === 'stop' ? stopReasons.join(',') : undefined,
    closingNote.trim() || undefined
  );
};
```

---

### Dosya: `src/components/trade/TradeList.tsx` - Stop Reason Görüntüleme

Çoklu sebepler virgülle ayrıldığında bunları düzgün göstermek için:

```tsx
const getStopReasonLabels = (stopReasonIds: string | null) => {
  if (!stopReasonIds) return null;
  return stopReasonIds.split(',')
    .map(id => STOP_REASONS.find((r) => r.id === id)?.label || id)
    .join(', ');
};
```

---

## Etkilenen Dosyalar
1. `src/components/trade/TradeList.tsx` - Desktop ve mobil görünüm güncellemeleri
2. `src/components/trade/CloseTradeModal.tsx` - Çoklu stop sebep seçimi
