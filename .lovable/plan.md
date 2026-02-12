

# Ticker Tape Animasyonu - Kesin Cozum

## Kok Neden

Tailwind JIT modu, yalnizca projede **kullanilan siniflar** icin CSS uretir. `@keyframes ticker` tanimini `tailwind.config.ts`'e ekledik, ama kodda hicbir yerde `animate-ticker` sinifi kullanmadik (animasyonu inline `style` ile uyguluyoruz). Bu nedenle Tailwind, `@keyframes ticker` blogunu CSS ciktisina **dahil etmiyor** -- tree-shaking ile siliyor.

Sonuc: Inline style `animation: ticker 60s linear infinite` diyor ama tarayici `ticker` adinda bir keyframes bulamiyor, animasyon calismiyor.

## Onceki Durum (Calisan Hali)

Ticker tape eskiden calisiyordu cunku `@keyframes ticker` dogrudan `index.css` dosyasinda tanimlanmisti. Tailwind config'den bagimsizdi. Son 3-4 degisiklikte bu tanim CSS'ten kaldirildi ve Tailwind config'e tasininca sorun basladi.

## Cozum

Basit ve kesin: `@keyframes ticker` tanimini `index.css`'e geri ekle (herhangi bir `@layer` icinde DEGIL, global scope'ta). Tailwind config'deki tanimi kaldir (karisikligi onlemek icin).

## Degisecek Dosyalar

### 1. `src/index.css` - Dosyanin sonuna ekle

Dosyanin en altina (hicbir `@layer` icinde olmadan) su blok eklenecek:

```css
@keyframes ticker {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
```

Bu global bir CSS kurali oldugu icin Tailwind'in tree-shaking'inden etkilenmez ve inline style'daki `animation: ticker ...` referansi her zaman calisir.

### 2. `tailwind.config.ts` - ticker keyframes kaldir

`keyframes` altindaki `ticker` tanimini sil. Artik gereksiz ve karisikliga neden oluyor.

### 3. `src/components/layout/TickerTape.tsx` - Degisiklik yok

Mevcut inline style yaklasimi dogru ve korunacak:
```tsx
style={{
  animation: duration
    ? `ticker ${duration}s linear infinite`
    : stocks.length > 0
      ? 'ticker 60s linear infinite'
      : 'none',
  willChange: 'transform',
}}
```

## Neden Bu Sefer Kesin Calisacak?

1. `@keyframes ticker` global CSS'te tanimli -- Tailwind islemcisinden bagimsiz
2. Hicbir `@layer` icinde degil -- CSS cascade sorunlari yok
3. Inline `animation` shorthand keyframes adina dogru referans veriyor
4. `will-change: transform` GPU hizlandirma sagliyor (mobil dahil)
5. Hover pause kurali (`ticker-tape:hover`) zaten `@layer components` icinde calisiyor

## Ozet

| Dosya | Degisiklik |
|-------|-----------|
| `src/index.css` | `@keyframes ticker` geri ekle (global scope) |
| `tailwind.config.ts` | `ticker` keyframes kaldir |
| `src/components/layout/TickerTape.tsx` | Degisiklik yok |

