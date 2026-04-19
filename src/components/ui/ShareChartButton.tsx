import { useState, useRef, useEffect } from 'react';
import { Share2, Download, Copy, X, Check, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { cn } from '@/lib/utils';

interface ShareChartButtonProps {
  /** Ref to the element to capture */
  targetRef: React.RefObject<HTMLElement>;
  /** Base filename for downloads (no extension) */
  filename?: string;
  /** Compact mode renders a 32px icon-only button (for use inside card headers). */
  compact?: boolean;
}

// ─── Capture helper ──────────────────────────────────────────────────────────
async function captureElement(el: HTMLElement): Promise<Blob> {
  const bg = getComputedStyle(el).backgroundColor;
  const canvas = await html2canvas(el, {
    backgroundColor: bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#0f0f17',
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false,
    imageTimeout: 8000,
  });
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
  );
}

function blobToObjectUrl(blob: Blob) {
  return URL.createObjectURL(blob);
}

// ─── Share menu (desktop fallback) ───────────────────────────────────────────
function ShareMenu({
  blob,
  filename,
  onClose,
}: {
  blob: Blob;
  filename: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [previewUrl] = useState(() => blobToObjectUrl(blob));
  const menuRef = useRef<HTMLDivElement>(null);

  // Revoke object URL on unmount
  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `${filename}.png`;
    a.click();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: download
      handleDownload();
    }
  };

  const handleTwitter = () => {
    const text = encodeURIComponent('Portföy grafiğim 📊 #yatırım #borsa');
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener');
  };

  const handleWhatsApp = () => {
    // WhatsApp web only supports text; user needs to attach from clipboard/downloads
    handleCopy();
    const text = encodeURIComponent('Portföy grafiğim 📊');
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
  };

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full mb-2 right-0 z-50 w-72 rounded-xl border border-border shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
      style={{ background: 'hsl(var(--card))' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border">
        <span className="text-sm font-semibold text-foreground">Grafiği Paylaş</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Preview */}
      <div className="p-3 border-b border-border/50">
        <img
          src={previewUrl}
          alt="Önizleme"
          className="w-full rounded-lg object-cover max-h-28"
          style={{ background: '#0f0f17' }}
        />
      </div>

      {/* Actions */}
      <div className="p-3 grid grid-cols-2 gap-2">
        {/* Twitter / X */}
        <button
          onClick={handleTwitter}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/40 hover:bg-secondary transition-colors text-sm font-medium text-foreground"
        >
          {/* X logo */}
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.254 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
          </svg>
          Twitter / X
        </button>

        {/* WhatsApp */}
        <button
          onClick={handleWhatsApp}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/40 hover:bg-secondary transition-colors text-sm font-medium text-foreground"
        >
          {/* WhatsApp logo */}
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-[#25D366]" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          WhatsApp
        </button>

        {/* Copy */}
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm font-medium',
            copied
              ? 'border-profit/50 bg-profit/10 text-profit'
              : 'border-border bg-secondary/40 hover:bg-secondary text-foreground'
          )}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Kopyalandı!' : 'Kopyala'}
        </button>

        {/* Download */}
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/40 hover:bg-secondary transition-colors text-sm font-medium text-foreground"
        >
          <Download className="w-4 h-4" />
          İndir (.png)
        </button>
      </div>

      {/* WhatsApp hint */}
      <p className="text-[10px] text-muted-foreground text-center pb-2.5 px-3">
        WhatsApp için görsel otomatik kopyalanır, yapıştırarak paylaşabilirsiniz.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ShareChartButton({
  targetRef,
  filename = 'portfoy-grafik',
  compact = false,
}: ShareChartButtonProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [menuBlob, setMenuBlob] = useState<Blob | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleShare = async () => {
    if (!targetRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const blob = await captureElement(targetRef.current);

      // Mobile: use native Web Share API if supported
      const file = new File([blob], `${filename}.png`, { type: 'image/png' });
      if (
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({ files: [file], title: 'Portföy Grafiği' });
          return;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return; // User cancelled
          // Fall through to desktop menu
        }
      }

      // Desktop fallback: show menu
      setMenuBlob(blob);
    } catch (err) {
      console.error('[ShareChartButton] capture error:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative inline-block">
      {compact ? (
        <button
          onClick={handleShare}
          disabled={isCapturing}
          aria-label="Grafiği paylaş"
          className={cn(
            'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
            'text-muted-foreground hover:text-foreground hover:bg-surface-2',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isCapturing && 'opacity-60 cursor-not-allowed'
          )}
        >
          {isCapturing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Share2 className="w-4 h-4" />
          )}
        </button>
      ) : (
        <button
          onClick={handleShare}
          disabled={isCapturing}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
            'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
            isCapturing && 'opacity-60 cursor-not-allowed'
          )}
        >
          {isCapturing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Share2 className="w-3.5 h-3.5" />
          )}
          {isCapturing ? 'Hazırlanıyor…' : 'Paylaş'}
        </button>
      )}

      {menuBlob && (
        <ShareMenu
          blob={menuBlob}
          filename={filename}
          onClose={() => setMenuBlob(null)}
        />
      )}
    </div>
  );
}
