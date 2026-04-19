# Trade Günlüğü

Borsa işlemlerinizi kaydedin, portföyünüzü takip edin ve performansınızı
analiz edin. Çoklu portföy desteği, canlı BIST/kripto fiyatları, benchmark
karşılaştırmalı portföy eğrisi ve dağılım raporları içerir.

## Yerel geliştirme

Gereksinimler: Node.js (önerilen: son LTS) ve npm.

```sh
# Projeyi klonlayın
git clone <repo-url>
cd trade-journal-insight

# Bağımlılıkları kurun
npm install

# Dev sunucusunu başlatın
npm run dev
```

Dev sunucusu varsayılan olarak `http://localhost:8080` üzerinde çalışır.

## Teknoloji yığını

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (auth, database, edge functions)
- Recharts (grafikler)
- TanStack Query (veri yönetimi)

## Yapı

- `src/pages/` — rota bileşenleri
- `src/components/` — paylaşımlı UI, feature bileşenleri
- `src/hooks/` — veri/durum hook'ları
- `src/contexts/` — global context provider'lar (portföy, piyasa verisi)
- `src/integrations/supabase/` — Supabase client ve tip tanımları
- `supabase/functions/` — edge function'lar (fiyat/veri kaynakları)

## Komutlar

```sh
npm run dev        # dev sunucusunu başlat
npm run build      # production build
npm run lint       # ESLint
npm run test       # Vitest
```
