import { AlertTriangle } from 'lucide-react';

interface ReadingTimeWarningProps {
  readingTime: number;
  threshold?: number;
}

export function ReadingTimeWarning({ readingTime, threshold = 10 }: ReadingTimeWarningProps) {
  if (readingTime <= threshold) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-600">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="text-sm">
        Bu yazı yaklaşık {readingTime} dk — kısaltmak ister misin?
      </span>
    </div>
  );
}
