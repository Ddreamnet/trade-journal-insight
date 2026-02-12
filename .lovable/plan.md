

# Plan: Ticker Tape Animasyonunu Kesin Duzelt

## Sorun Analizi

Mevcut yaklasimda animasyon iki farkli kaynaktan yonetiliyor:
- CSS dosyasinda (`index.css`): `@keyframes ticker`, `animation-name`, `animation-timing-function`, `animation-iteration-count`
- React inline style'da: `animationDuration`

Bu karisik yaklasim, Vite/PostCSS/Tailwind'in CSS dosyasini islerken `@keyframes ticker` tanimini duzgun cozememe riskini tasiyor. Ayrica CSS `@layer` disinda tanimlanan kurallar, Tailwind'in urettigi CSS ile etkilesime girebiliyor.

## Cozum

Animasyonu tamamen React bileseninin icinde inline style olarak tanimla. CSS dosyasindan ticker animasyon kurallarini kaldir. Boylece hicbir CSS islemcisine bagimlilik kalmaz.

## Degisecek Dosyalar

### 1. `src/components/layout/TickerTape.tsx`

- `@keyframes ticker` icin CSS'e bagimlilik tamamen kaldirilacak
- `className` icinden `ticker-tape` sinifi kaldirilacak (veya sadece hover icin birakilacak)
- Tum animasyon ozellikleri inline `style` uzerinden ayarlanacak:
  - `animation`: `ticker ${duration}s linear infinite`
- Hover ile durdurma icin CSS class korunacak (sadece `animation-play-state: paused`)

### 2. `src/index.css`

- Dosyanin altindaki `@keyframes ticker` ve `.ticker-tape` animasyon kurallari silinecek
- `@keyframes ticker` tanimini global scope'ta birakarak yalnizca keyframes tanimlayacagiz (React inline style `animation` shorthand icinde referans edecek)

Aslinda daha iyi yaklasim: keyframes'i de component icinde `useEffect` ile `<style>` olarak enjekte etmek veya Tailwind config'e tanimlamak.

En temiz cozum: **Tailwind config'e `ticker` keyframes tanimla**, boylece Tailwind'in kendi build pipeline'i icinde kalir ve inline style sadece `animation` shorthand'ini kullanir.

### Detayli Degisiklikler

**tailwind.config.ts:**
- `keyframes` altina `ticker` ekle:
  ```
  ticker: {
    "0%": { transform: "translateX(0)" },
    "100%": { transform: "translateX(-50%)" }
  }
  ```
- `animation` altina `ticker` eklemeye gerek yok (duration dinamik oldugu icin inline style kullanilacak)

**src/components/layout/TickerTape.tsx:**
- `className`'den `ticker-tape` kaldirilip, sadece hover-pause icin CSS class birakilacak
- Inline style'a tam animasyon shorthand eklenecek:
  ```
  style={{
    animation: duration
      ? `ticker ${duration}s linear infinite`
      : stocks.length > 0
        ? `ticker 60s linear infinite`
        : 'none'
  }}
  ```
- `will-change: 'transform'` inline style'a eklenecek

**src/index.css:**
- Dosyanin altindaki `@keyframes ticker` ve `.ticker-tape` bloklari silinecek
- `@layer components` icindeki `.ticker-tape:hover` kurali `ticker-tape` sinif adi korunarak birakilacak

### Neden Bu Yaklasim?

1. Tailwind config icindeki keyframes, Tailwind'in build pipeline'inda dogru sekilde islenir
2. Inline `animation` shorthand, CSS cascade/layer sorunlarindan etkilenmez
3. `will-change: transform` GPU hizlandirmayi saglar (mobil dahil)
4. Hover ile durdurma CSS class ile calisir (`animation-play-state: paused`)

