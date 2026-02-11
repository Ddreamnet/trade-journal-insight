

# Plan: Her Grafige Kendi Benchmark Secicisini Ekle

## Mevcut Durum

Su an tek bir `BenchmarkSelector` sayfanin en altinda duruyor ve her iki grafik (Cizgi + Sutun) ayni `selectedBenchmarks` state'ini paylasiyor. Kullanici bir benchmark sectigi zaman hem 1. hem 2. grafik ayni anda degisiyor.

## Hedef

- Her grafik kendi icerisinde, kartla bitisik sekilde kendi benchmark secicisine sahip olacak.
- 1. Grafik (% Cizgi Grafigi): Benchmark secici VAR, Portfoy butonu YOK.
- 2. Grafik (% Sutun Grafigi): Benchmark secici VAR, Portfoy butonu VAR.
- 3. Grafik (Portfoy Degeri): Zaten kendi kur secicisi var, degismeyecek.
- Sayfanin altindaki ortak BenchmarkSelector tamamen kaldirilacak.

## Degisiklikler

### 1. Reports.tsx

- `selectedBenchmarks` state'ini ikiye bol:
  - `lineChartBenchmarks` (1. grafik icin)
  - `barChartBenchmarks` (2. grafik icin)
- Her biri icin ayri `toggleBenchmark` fonksiyonu olustur.
- `portfolioSelected` state'i sadece 2. grafik icin kalacak (aynen).
- **Sayfanin altindaki ortak BenchmarkSelector kartini tamamen kaldir.**

#### 1. Grafik karti icerisine:
- Grafik altina `BenchmarkSelector` ekle.
- `onPortfolioToggle` prop'u gonderilmeyecek (Portfoy butonu gorunmeyecek).
- Bilgi mesaji: "Piyasa verileri Stooq ve TCMB EVDS'den cekilmektedir..."

#### 2. Grafik karti icerisine:
- `ReturnComparisonChart`'in icine veya hemen altina (ayni kart icerisinde) `BenchmarkSelector` ekle.
- `onPortfolioToggle` prop'u gonderilecek (Portfoy butonu gorunecek).
- Bilgi mesaji ayni.

### 2. Diger Dosyalar

Hicbir degisiklik yok. `BenchmarkSelector`, `EquityCurveChart`, `ReturnComparisonChart`, `PortfolioValueChart` komponentleri degismiyor. Tek degisen Reports.tsx'teki layout ve state yonetimi.

---

## Teknik Detay

```text
Reports.tsx state degisikligi:

ONCE:
  selectedBenchmarks        -> hem Chart1 hem Chart2
  toggleBenchmark            -> tek fonksiyon

SONRA:
  lineChartBenchmarks       -> sadece Chart1
  barChartBenchmarks        -> sadece Chart2
  toggleLineChartBenchmark  -> Chart1 icin
  toggleBarChartBenchmark   -> Chart2 icin
```

### Layout Yapisi (sonrasi)

```text
[Stats Kartlari]

[Kart: % Cizgi Grafigi]
  - Baslik + TimeRangeSelector
  - EquityCurveChart
  - BenchmarkSelector (Portfoy butonu YOK)
  - Bilgi mesaji

[Kart: % Sutun Grafigi]
  - ReturnComparisonChart (icinde grafik)
  - BenchmarkSelector (Portfoy butonu VAR)
  - Bilgi mesaji

[Kart: Portfoy Degeri]
  - Kur secici (mevcut, degismez)
  - PortfolioValueChart
```

---

## Uygulama

Sadece `src/pages/Reports.tsx` dosyasi guncellenecek:

1. State'leri ikiye bol
2. Toggle fonksiyonlarini ikiye bol
3. Chart 1 kartinin icine BenchmarkSelector ekle (portfolioToggle yok)
4. Chart 2 kartinin altina (ayni kart icinde) BenchmarkSelector ekle (portfolioToggle var)
5. Sayfanin altindaki ortak BenchmarkSelector kartini sil

