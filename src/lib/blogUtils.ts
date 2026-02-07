/**
 * Turkish character transliteration map
 */
const TR_MAP: Record<string, string> = {
  ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I',
  ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U',
};

/**
 * Generate URL-friendly slug from Turkish text
 */
export function generateSlug(text: string): string {
  return text
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TR_MAP[ch] || ch)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Calculate reading time in minutes (~200 words/min)
 */
export function calculateReadingTime(content: unknown): number {
  const text = extractTextFromTiptap(content);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

/**
 * Extract plain text from Tiptap JSON content
 */
export function extractTextFromTiptap(content: unknown): string {
  if (!content || typeof content !== 'object') return '';

  const node = content as { type?: string; text?: string; content?: unknown[] };

  if (node.text) return node.text;

  if (Array.isArray(node.content)) {
    return node.content.map((child) => extractTextFromTiptap(child)).join(' ');
  }

  return '';
}

/**
 * Generate auto excerpt from content (first ~160 chars)
 */
export function generateExcerpt(content: unknown, maxLength = 160): string {
  const text = extractTextFromTiptap(content).trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).replace(/\s+\S*$/, '') + '…';
}

/**
 * Format date for display (Turkish locale)
 */
export function formatBlogDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Validate image file for upload
 */
export function validateImageFile(file: File): string | null {
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Sadece JPG, PNG ve WebP formatları kabul edilir.';
  }

  if (file.size > MAX_SIZE) {
    return 'Dosya boyutu 5MB\'ı aşamaz.';
  }

  return null;
}

/**
 * Generate unique file path for storage upload
 */
export function generateImagePath(userId: string, file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${userId}/${timestamp}-${random}.${ext}`;
}

/**
 * Set SEO meta tags dynamically
 */
export function setSEOMeta(opts: {
  title: string;
  description?: string;
  ogImage?: string;
  ogUrl?: string;
}) {
  document.title = opts.title;

  const setMeta = (property: string, content: string, isOg = false) => {
    const attr = isOg ? 'property' : 'name';
    let el = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, property);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  if (opts.description) {
    setMeta('description', opts.description);
    setMeta('og:description', opts.description, true);
  }

  setMeta('og:title', opts.title, true);
  setMeta('og:type', 'article', true);

  if (opts.ogImage) {
    setMeta('og:image', opts.ogImage, true);
    setMeta('twitter:image', opts.ogImage);
  }

  if (opts.ogUrl) {
    setMeta('og:url', opts.ogUrl, true);
  }
}
