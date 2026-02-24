

# USD ve EUR Cizgi Grafikte Duz Gorunme Sorunu - Cozum Plani

## Sorunun Kaynagi

Bu bir veri veya kod hatasi degil, **gorsel olcekleme sorunudur**. API verileri dogrulanmis ve dogrudir.

TCMB yonetimli kur politikasi (crawling peg) nedeniyle USD/TRY ve EUR/TRY gunluk bazda cok kucuk degisimler gosteriyor (gunluk %0.03-0.18). Diger varliklar (altin, BIST) cok daha buyuk yuzdesel hareketler yaptiginda, Y ekseni genis bir araliga yayiliyor ve dolar/euro cizgileri "dumduz" gorunuyor.

Ornek: 1 yillik araliklata altin 100'den 200'e cikarken, dolar 100'den sadece 121'e cikiyor. Ayni Y ekseninde dolar cizgisi duz gorunur.

## Cozum: Dinamik Y Ekseni ve Gorsel Iyilestirmeler

### 1. Y eksenini sadece gorunen verilere gore optimize et

Recharts YAxis'ta `domain={['auto', 'auto']}` zaten kullaniliyor, ancak bu portfoy + benchmark dahil TUM verileri kapsayan bir aralik olusturuyor. Cizgi uclarindaki deger etiketleri zaten mevcut, bu nedenle asil sorun degerlerin birbirine cok yakin veya cok uzak olmasindan kaynaklaniyor.

### 2. Benchmark secildiginde Y ekseninin alt/ust sinirini %5 padding ile ayarla

`EquityCurveChart.tsx` icinde YAxis domain hesaplamasini iyilestir:
- Tum gorunen serilerin min/max degerlerini hesapla
- Daha dar bir araliga sikistir (daha iyi gorsel ayrim)
- Padding ekleyerek cizgilerin uste/alta yapismasini engelle

```text
Onceki: domain={['auto', 'auto']}  --> Recharts'in varsayilan hesaplamasi
Sonraki: domain={[minValue * 0.98, maxValue * 1.02]} --> Daha siki aralik
```

### 3. Tooltip'e yuzdesel degisim bilgisi ekle

Cizgi duz gorundugunde bile tooltip'te net bilgi versin:
- "USD: 121.3 (baslangictan +%21.3)" seklinde gosterim
- Boylece kullanici cizgi duz gorunse de degisimi anlayabilir

## Teknik Degisiklikler

### Dosya: `src/components/reports/EquityCurveChart.tsx`

1. **Y ekseni domain hesaplamasi** -- chartData'dan tum gorunen serilerin min/max degerlerini hesapla, %2-5 padding uygula
2. **Tooltip'te yuzde degisim gosterimi** -- benchmark degerinin 100 bazina gore farkini tooltip'te "baslangictan +%X" olarak goster

### Dosya degisiklikleri ozeti

| Dosya | Degisiklik | Etki |
|-------|-----------|------|
| EquityCurveChart.tsx | YAxis domain'i dinamik hesapla (min/max + padding) | Dusuk degisimli seriler daha belirgin gorunur |
| EquityCurveChart.tsx | Tooltip'e yuzde degisim ekle | Kullanici duz cizgide bile degisimi gorebilir |

Toplam 1 dosyada 2 degisiklik. Veri akisi ve API tarafinda degisiklik gerekmez.

