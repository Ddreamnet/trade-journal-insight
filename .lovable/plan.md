

# Plan: TradeGunlugu Blog Sistemi

## Genel Bakis

TradeGunlugu sitesine tam kapsamli bir blog sistemi eklenmesi: herkese acik blog sayfasi (/blog, /blog/:slug) ve login gerektiren yazar paneli (/panel/blog). Tiptap zengin metin editoru ve Supabase Storage ile gorsel yukleme destegi.

---

## 1. Veritabani (Supabase Migration)

### blog_posts Tablosu

| Kolon | Tip | Aciklama |
|-------|-----|----------|
| id | uuid (PK) | Otomatik |
| user_id | uuid (NOT NULL) | Yazar |
| title | text (NOT NULL) | Baslik |
| slug | text (UNIQUE, NOT NULL) | SEO URL |
| excerpt | text | Kisa ozet |
| cover_image_url | text | Kapak gorseli URL |
| content | jsonb | Tiptap JSON formati |
| status | text (DEFAULT 'draft') | draft / published |
| published_at | timestamptz | Yayinlanma tarihi |
| reading_time_minutes | integer (DEFAULT 1) | Otomatik hesaplanan |
| tags | text[] (DEFAULT '{}') | Etiketler |
| created_at | timestamptz (DEFAULT now()) | |
| updated_at | timestamptz (DEFAULT now()) | |

### RLS Politikalari

- **SELECT (herkes)**: `status = 'published'` olan yazilar herkese acik (anon + authenticated)
- **SELECT (yazar)**: `auth.uid() = user_id` olan TUM yazilar (taslaklar dahil)
- **INSERT**: `auth.uid() = user_id`
- **UPDATE**: `auth.uid() = user_id`
- **DELETE**: `auth.uid() = user_id`

### updated_at Trigger

Kayit degistiginde `updated_at` otomatik guncellenir.

### Storage Bucket

- `blog-images` adinda **public** bucket olusturulacak
- RLS: Authenticated kullanicilar upload edebilir, herkes okuyabilir
- Kabul edilen formatlar: jpg, png, webp
- Boyut limiti: 5MB (frontend'de kontrol)

---

## 2. Yeni Paketler

- `@tiptap/react` - Tiptap React entegrasyonu
- `@tiptap/starter-kit` - Temel editor ozellikleri (bold, italic, headings, lists, blockquote, code)
- `@tiptap/extension-link` - Link ekleme
- `@tiptap/extension-image` - Gorsel ekleme
- `@tiptap/extension-youtube` - YouTube embed
- `@tiptap/extension-underline` - Alti cizili
- `@tiptap/extension-text-align` - Metin hizalama
- `@tiptap/extension-color` - Yazi rengi
- `@tiptap/extension-text-style` - Text style alt yapisi
- `@tiptap/extension-placeholder` - Placeholder
- `dompurify` - HTML sanitizasyonu (XSS koruması)

---

## 3. Dosya Yapisi

```text
src/
  components/
    blog/
      BlogCard.tsx           -- Blog kart bileseni (liste gorunumu)
      BlogHeader.tsx         -- Public blog icin ozel header
      ShareButton.tsx        -- Paylasim butonu (Web Share API + fallback)
      BlogEditor.tsx         -- Tiptap editor bileseni
      EditorToolbar.tsx      -- Editor toolbar (H1-H3, bold, gorsel, youtube vs.)
      ImageUploader.tsx      -- Gorsel yukleme bileseni (kapak + icerik)
      ReadingTimeWarning.tsx -- 10 dk asim uyarisi
      BlogPostForm.tsx       -- Yazi olusturma/duzenleme formu
      BlogManageList.tsx     -- Panel yazilari listesi
  hooks/
    useBlogPosts.ts          -- Blog CRUD islemleri hook
  pages/
    Blog.tsx                 -- Public blog listesi (/blog)
    BlogPost.tsx             -- Public blog detay (/blog/:slug)
    PanelBlog.tsx            -- Yazar paneli ana sayfa (/panel/blog)
    PanelBlogEditor.tsx      -- Yazi olustur/duzenle (/panel/blog/new, /panel/blog/edit/:id)
  types/
    blog.ts                  -- Blog tip tanimlari
  lib/
    blogUtils.ts             -- Slug olusturma, okuma suresi hesaplama
```

---

## 4. Routing (App.tsx)

```text
/blog              -- Public (login gerektirmez)
/blog/:slug        -- Public (login gerektirmez)
/panel/blog        -- Protected (login gerektirir)
/panel/blog/new    -- Protected
/panel/blog/edit/:id -- Protected
```

Header'daki "Blog" linki `/panel/blog` adresine yonlendirecek (sadece login yapmis kullanici icin gorunur).

---

## 5. Public Blog (/blog)

### Liste Sayfasi

- **Arkaplan**: Acik gri (#F5F6F7), metin rengi siyah (#111)
- **Ozel layout**: MainLayout yerine ozel bir BlogLayout (acik tema)
- **Grid**: Mobil 1 kolon, tablet 2, desktop 3 kolon
- **Kartlar**:
  - Kapak gorseli (aspect-ratio 16:9, lazy-load)
  - Baslik, ozet (max 2 satir), tarih, okuma suresi, etiketler
  - Hover'da soft shadow ve hafif yukari kayma
  - Paylasim ikonu (sag ust kosede)
- **Pagination**: Sayfa basina 9 yazi, alt kisimda sayfa numaralari
- **Bos durum**: "Henuz blog yazisi yok" mesaji
- **Loading**: Skeleton kartlar (3 adet)

### Detay Sayfasi (/blog/:slug)

- Ayni acik gri tema
- Icerik genisligi sinirli (max-w-3xl, ortalanmis)
- Kapak gorseli (tam genislik, aspect-ratio)
- Baslik, tarih, okuma suresi
- Icerik (Tiptap JSON'dan HTML'e render + DOMPurify sanitize)
- YouTube embed'leri responsive (16:9 aspect ratio)
- Paylasim butonlari (X/Twitter, WhatsApp, Telegram, LinkedIn)
- 404 durumu: slug bulunamazsa ozel mesaj

### Paylasim

```text
1. Web Share API destegi varsa: navigator.share() kullan
2. Yoksa fallback:
   - "Linki Kopyala" butonu (toast: "Link kopyalandi")
   - X/Twitter paylas
   - WhatsApp paylas
   - Telegram paylas
   - LinkedIn paylas
```

Paylasim URL'si: `https://tradegunlugu.com/blog/:slug`

---

## 6. Yazar Paneli (/panel/blog)

### Yazi Listesi

- Mevcut dark tema (MainLayout kullanilacak)
- Filtre: "Tumu", "Yayinda", "Taslak" sekmeleri
- Her satirda: baslik, durum badge, tarih, okuma suresi
- Aksiyonlar: Duzenle, Sil, Yayinla/Taslaga Al
- "Yeni Yazi" butonu (sag ust)

### Editor Sayfasi (/panel/blog/new, /panel/blog/edit/:id)

- **Kapak Gorseli**: Ayrı upload alani (drag-drop veya tikla)
- **Baslik**: Buyuk input alani
- **Etiketler**: Virgülle ayrılmış etiket girisi
- **Tiptap Editor**:
  - Toolbar: H1, H2, H3, Bold, Italic, Underline, Link, UL, OL, Blockquote, Code block, Hizalama (sol/orta/sag), Yazi rengi, Undo/Redo
  - Gorsel ekleme: Toolbar'dan veya drag-drop (Supabase Storage'a yukler)
  - YouTube embed: URL yapistirinca otomatik video blogu olusturur
  - Varsayilan yazi rengi: siyah (#111) - public'te dogru goruntulenmesi icin
- **Otomatik kaydetme**: 30 saniyede bir taslak olarak kaydet, "Kaydedildi" feedback'i
- **Yayinla butonu**: status = published, published_at = now()
- **10 dk uyarisi**: Icerik ~2000 kelimeyi astinda badge + toast ile uyari

### Gorsel Yukleme

- Supabase Storage `blog-images` bucket'ina upload
- Upload sirasinda progress bar
- Hata mesajlari (boyut asimi, format hatasi)
- Kabul: jpg, png, webp - max 5MB
- Dosya adi: `{userId}/{timestamp}-{random}.{ext}` formati

---

## 7. SEO

- `document.title` ve `<meta>` taglari React Helmet olmadan, `useEffect` ile dinamik set edilecek
- Blog listesi: "Blog | Trade Gunlugu"
- Blog detay: "{baslik} | Trade Gunlugu Blog"
- OG taglari: og:title, og:description, og:image (kapak gorseli)
- Not: SPA oldugundan tam SSR destegi yok, ama meta tag'lar client-side olarak ayarlanacak

---

## 8. Guvenlik

- Tum HTML ciktisi DOMPurify ile sanitize edilecek
- YouTube embed icin sadece youtube.com ve youtu.be domainleri izinli
- Diger iframe/script icerikleri strip edilecek
- RLS ile sadece yazar kendi yazilarini yonetebilir
- Public okuma icin sadece published yazilar gorunur

---

## 9. Header Degisikligi

Mevcut `navItems` dizisine "Blog" eklenmesi:

```text
Ana Sayfa  |  Raporlarim  |  Blog  |  Cikis
```

- Blog linki `/panel/blog` adresine gider
- Sadece authenticated kullanici icin gorunur (zaten Header login gerektiren alanda)

---

## 10. Uygulama Sirasi

| Adim | Islem |
|------|-------|
| 1 | Veritabani migration (blog_posts tablosu + RLS + storage bucket) |
| 2 | Tiptap ve diger paketleri kur |
| 3 | Tip tanimlari ve yardimci fonksiyonlar (types/blog.ts, lib/blogUtils.ts) |
| 4 | useBlogPosts hook (CRUD islemleri) |
| 5 | Blog editor bilesenleri (Tiptap, toolbar, gorsel yukleme) |
| 6 | Yazar paneli sayfalari (liste + editor) |
| 7 | Public blog sayfalari (liste + detay) |
| 8 | Paylasim bileseni |
| 9 | Header guncelleme |
| 10 | Routing guncelleme (App.tsx) |

---

## 11. Teknik Notlar

- **Tiptap icerigi**: JSON formatinda kaydedilecek (jsonb), render sirasinda `generateHTML()` ile HTML'e cevrilecek
- **Slug uretimi**: Turkce karakterler translitere edilecek (ornegin "Teknik Analiz Nedir?" -> "teknik-analiz-nedir")
- **Okuma suresi**: `Math.ceil(kelimeSayisi / 200)` dakika
- **Autosave**: `useEffect` + `setTimeout` ile 30 sn debounce, sadece draft durumunda
- **Public blog acik tema**: Blog sayfalari icin ayri CSS degiskenleri veya inline stil kullanilacak (ana uygulama dark temasini etkilemeyecek)

