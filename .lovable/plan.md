

# Plan: Ticker Tape Animasyonunu Duzelt

## Sorun Analizi

Ticker tape animasyonu calismama nedeni: `useEffect` ile `scrollWidth` olcumu, DOM henuz tam olarak layout'u tamamlamadan yapiliyor olabilir. Ayrica `durationRef` ile duration sadece bir kez hesaplaniyor — eger ilk olcum basarisiz olursa (scrollWidth = 0), animasyon bir daha duzgun baslayamaz.

Ek olarak, stocks cache'den yuklendiginde `useState` initializer'da set edilir ve `useEffect([stocks])` sadece bir kez tetiklenir. Eger o anda DOM hazir degilse, scrollWidth 0 olur ve animasyon hic baslamaz.

## Cozum

`TickerTape.tsx` dosyasinda su degisiklikler yapilacak:

### 1. requestAnimationFrame ile Olcum Zamanlama

`useEffect` icinde `requestAnimationFrame` kullanarak DOM'un layout'u tamamlamasini bekle. Bu, `scrollWidth`'in dogru olculmesini garanti eder.

### 2. durationRef Kilidini Kaldir

Eger `scrollWidth` 0 donerse, `durationRef`'i set etme — bir sonraki render'da tekrar dene. Boylece cache'den yuklenen bos bir state'te takilma olmaz.

### 3. Fallback duration'i Iyilestir

`duration` null oldugunda animasyon `15s` ile calisiyor ama icerik yokken bu anlamsiz. Stocks bos iken animasyonu tamamen devre disi birak (`animationDuration: '0s'` veya animation yok).

### 4. will-change Ekleme

Performans icin ticker-tape'e CSS'te `will-change: transform` ekle. Mobilde GPU hizlandirmasi saglayarak akici animasyon elde edilir.

## Teknik Detay

### TickerTape.tsx Degisiklikleri

```text
useEffect:
  - stocks.length === 0 ise return (bos veriyle olcum yapma)
  - durationRef.current !== null ise return (zaten hesaplandi)
  - requestAnimationFrame icinde scrollWidth olc
  - scrollWidth > 0 ise duration hesapla ve set et
  - scrollWidth === 0 ise bir sey yapma (bir sonraki render'da tekrar dener)

style:
  - duration varsa: { animationDuration: `${duration}s` }
  - duration yoksa VE stocks varsa: { animationDuration: '60s' } (makul fallback)
  - stocks yoksa: animasyon yok
```

### index.css Degisiklikleri

```css
.ticker-tape {
  animation-name: ticker;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform;  /* GPU hizlandirma */
}
```

## Degisecek Dosyalar

| Dosya | Degisiklik |
|-------|-----------|
| `src/components/layout/TickerTape.tsx` | useEffect icinde rAF, fallback iyilestirme |
| `src/index.css` | will-change: transform ekleme |

## Mobil Uyumluluk

- `will-change: transform` mobilde GPU compositing saglar, animasyon akici olur
- `translateX(-50%)` yuzde bazli oldugu icin her ekran boyutunda dogru calisir
- Mevcut `overflow-hidden` ve gradient fade'ler korunur

