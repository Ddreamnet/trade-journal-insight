

# Varliklarim Pasta Grafigi Tasarim Iyilestirmesi

## Mevcut Durum

Grafik su an temel bir Recharts donut chart: basit renkler, standart legend, minimal tooltip. Sitenin dark/glassmorphism temasina tam uymuyor.

## Yapilacak Iyilestirmeler

### 1. Donut Merkezine Toplam Deger Gosterimi
- Grafigin ortasindaki bos alana toplam USD degeri ve "Toplam Varlik" yazisi eklenecek
- Recharts'in `customized` label ozelligi ile donut merkezine metin yerlestirilecek
- Baslik satirindaki "Toplam: $X" ifadesi kaldirilacak, merkeze tasinacak

### 2. Gradient Dolgulu Dilimler
- Duz renkler yerine her dilim icin radyal gradient tanimlanacak (SVG `<defs>` ile)
- Dilimler daha parlak/derinlikli gorunecek
- Hover durumunda dilim hafifce buyuyecek (`activeShape` ile)

### 3. Gelismis Tooltip
- Tooltip'e glassmorphism efekti (backdrop-blur, yari saydam arka plan)
- Renkli nokta gostergesi eklenmesi
- Deger + yuzde bilgisi daha okunakli sekilde gosterilecek

### 4. Ozel Legend (Aciklama) Tasarimi
- Recharts varsayilan Legend'i kaldirilacak
- Grafigin altina ozel tasarimli bir grid legend eklenecek
- Her legend itemi: renkli daire + isim + yuzde + USD degeri
- Mobilde 2 sutun, masaustunde 3 sutun grid

### 5. Gorsel Parlama ve Golge Efektleri
- Donut etrafina hafif glow/shadow efekti (SVG filter ile)
- Dilimler arasi bosluk (paddingAngle) korunacak
- Stroke rengi card arka planina uyumlu olacak

## Teknik Degisiklikler

| Alan | Degisiklik |
|------|-----------|
| Donut merkezi | SVG text elementi ile toplam deger |
| Dilim renkleri | Radyal gradient tanimlamalari (SVG defs) |
| Hover efekti | `activeShape` prop ile buyume animasyonu |
| Tooltip | Glassmorphism stil, renkli gosterge, iki satirli bilgi |
| Legend | Ozel React komponenti, responsive grid, deger + yuzde |
| Genel | Golge/glow efektleri, temaya uyumlu stroke |

## Dokunulmayacak Alanlar (Islevsellik)
- Veri hesaplama mantigi (chartData useMemo) aynen kalacak
- TL->USD donusumu degismeyecek
- Varlik gruplama/birlestirme mantigi korunacak
- Loading ve bos durum ekranlari korunacak

Tek dosyada degisiklik: `src/components/reports/AssetsChart.tsx`

