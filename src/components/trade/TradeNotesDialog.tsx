import { StickyNote } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { getStopReasonLabels } from '@/lib/tradeUtils';

interface TradeNotesDialogProps {
  symbol: string;
  stopReason: string | null;
  closingNote: string | null;
}

export function TradeNotesDialog({ symbol, stopReason, closingNote }: TradeNotesDialogProps) {
  if (!stopReason && !closingNote) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="p-1 rounded hover:bg-secondary transition-colors" title="Notlar">
          <StickyNote className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{symbol} - Notlar</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-3">
            {stopReason && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 font-medium">Stop Sebebi</div>
                <p className="text-sm text-foreground">{getStopReasonLabels(stopReason)}</p>
              </div>
            )}
            {closingNote && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 font-medium">Not</div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{closingNote}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
