import { useCallback, useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
  imageUrl: string | null;
  onUpload: (file: File) => Promise<string>;
  onRemove: () => void;
  label?: string;
}

export function ImageUploader({ imageUrl, onUpload, onRemove, label = 'Kapak Görseli' }: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setIsUploading(true);
    try {
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yükleme başarısız');
    } finally {
      setIsUploading(false);
    }
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  if (imageUrl) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        <div className="relative rounded-lg overflow-hidden border border-border">
          <img
            src={imageUrl}
            alt="Kapak"
            className="w-full aspect-video object-cover"
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            aria-label="Görseli kaldır"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50',
          isUploading && 'pointer-events-none opacity-60'
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Sürükle bırak veya tıkla
            </p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, WebP — max 5MB
            </p>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
