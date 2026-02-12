
# Ticker Tape Animasyonu - Kokten Cozum

## Bulunan Sorunlar

### Sorun 1: @keyframes ticker CSS ciktisinda yok

`@keyframes ticker` index.css'in sonunda global scope'ta tanimli olmasina ragmen, Vite'in CSS islemcisi (PostCSS + Tailwind) bunu final CSS ciktisina DAHIL ETMIYOR. Tarayicidaki network yaniti incelendi ve CSS ciktisi kontrol edildi -- keyframes tarayiciya ulasmadigi icin inline style'daki `animation: ticker 60s linear infinite` hicbir ise yaramiyor cunku tarayici `ticker` adinda bir keyframe bulamiyor.

**Bu neden onceden calisiyordu?** Orijinal kodda `@keyframes ticker` buyuk ihtimalle `@layer components` icinde tanimliydi. `@layer` icindeki keyframes Tailwind tarafindan islenir ve ciktiya dahil edilir. Sonraki degisikliklerde once `@layer`'dan cikarildi, sonra Tailwind config'e tasindi (tree-shaking ile silindi), sonra tekrar global scope'a eklendi -- ama global scope'taki keyframes de Vite'in CSS pipeline'inda kaybolabiliyor.

### Sorun 2: translateX(-50%) yanlis mesafe hesapliyor

`@keyframes ticker` sunu diyor: `translateX(-50%)`. CSS'te `translateX` yuzde degeri elementin **kendi genisligine** (CSS box width) gore hesaplanir, scrollWidth'e gore DEGIL.

Ticker div `display: flex` (block-level) oldugu icin genisligi = viewport genisligi (ornegin 1280px). Ama icerik genisligi (scrollWidth) cok daha buyuk (ornegin 6000px, 100 hisse x ~60px, iki kere tekrarlandi).

- `translateX(-50%)` = -640px (viewport genisliginin yarisi)
- Olmasi gereken = -3000px (scrollWidth'in yarisi, yani ilk kopyanin uzunlugu)

Bu yuzden animasyon dogru calissa bile, sorunsuz bir dongu olusturamaz -- "basa sarma" (reset/jump) gorunur.

**Bu neden onceden 10-15sn'de basa sariyordu?** Animasyon calisiyordu ama yanlis mesafe hesapladigi icin dongu noktasinda gorunur bir ziplama oluyordu.

## Cozum

### Yaklasim: Component icinde style tag + CSS custom property

1. `@keyframes` tanimini React bileseninin icinde `<style>` tag ile enjekte et -- CSS build pipeline'indan tamamen bagimsiz
2. `translateX(-50%)` yerine `translateX(var(--ticker-offset))` kullan
3. `--ticker-offset` degerini JavaScript'te piksel cinsinden hesapla (`-${scrollWidth/2}px`)
4. Hover pause icin CSS class'i koru

### Detayli Degisiklikler

**src/components/layout/TickerTape.tsx:**

```text
Yeni yaklasim:

1. halfWidth state'i ekle (scrollWidth / 2 piksel degeri)

2. useEffect icinde:
   - scrollWidth olc
   - halfWidth = scrollWidth / 2
   - duration = halfWidth / SPEED
   - Her ikisini de state'e kaydet

3. JSX icinde:
   - <style> tag ile @keyframes ticker tanimla:
     @keyframes ticker-scroll {
       from { transform: translateX(0); }
       to { transform: translateX(var(--ticker-offset)); }
     }

   - ticker div'ine inline style:
     --ticker-offset: `-${halfWidth}px` (veya fallback)
     animation: ticker-scroll ${duration}s linear infinite
     will-change: transform

4. ticker-tape className'i korunacak (hover pause icin)
```

**src/index.css:**

```text
Degisiklikler:
- Dosya sonundaki @keyframes ticker blogunu SIL (artik component icinde)
- @layer components icindeki .ticker-tape:hover kuralini KORU
  (ama animation-play-state yerine daha guvenilir bir yaklasim kullan)

Hover pause sorun: Inline style'daki animation shorthand,
animation-play-state'i de reset eder (running). Bu yuzden
CSS'teki .ticker-tape:hover { animation-play-state: paused }
calismaz (inline style daha yuksek oncelikli).

Cozum: animation shorthand yerine ayri ayri property'ler kullan:
- animation-name: ticker-scroll (CSS class'ta)
- animation-timing-function: linear (CSS class'ta)
- animation-iteration-count: infinite (CSS class'ta)
- animation-duration: inline style
- animation-play-state: CSS class'ta (hover icin override edilebilir)
```

Guncellenmis yaklasim:

**src/components/layout/TickerTape.tsx:**

```text
1. <style> tag ile sadece @keyframes tanimla
2. .ticker-tape CSS class'i animasyon ozelliklerini tasir:
   animation-name, timing-function, iteration-count
3. Inline style SADECE su degerleri set eder:
   --ticker-offset (piksel)
   animation-duration (saniye)
   will-change: transform
4. Hover pause CSS'te calisir cunku animation shorthand
   kullanilmiyor
```

**src/index.css:**

```text
@layer components icinde .ticker-tape'e eklenmesi gerekenler:
  .ticker-tape {
    animation-name: ticker-scroll;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }
  .ticker-tape:hover {
    animation-play-state: paused;
  }

Dosya sonundaki @keyframes ticker silinecek
(component icinde <style> ile tanimlanacak)
```

## Degisecek Dosyalar

| Dosya | Degisiklik |
|-------|-----------|
| `src/components/layout/TickerTape.tsx` | style tag + CSS custom property + ayri animation property'ler |
| `src/index.css` | .ticker-tape class guncelle, eski @keyframes sil |

## Neden Bu Sefer Kesin Calisacak?

1. `@keyframes` component icinde `<style>` tag ile -- hicbir build pipeline'ina bagimli degil
2. `var(--ticker-offset)` ile piksel bazli mesafe -- dogru dongu, ziplama yok
3. Animation shorthand yerine ayri property'ler -- hover pause calisiyor
4. `will-change: transform` -- GPU hizlandirma
5. Fallback duration (60s) -- olcum basarisiz olsa bile animasyon baslar
