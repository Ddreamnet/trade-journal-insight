import { Undo2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ClosedTradeEntry } from '@/types/trade';

interface ClosedTradeActionDialogProps {
  entry: ClosedTradeEntry | null;
  confirmAction: 'revert' | 'delete' | null;
  onAction: (action: 'revert' | 'delete') => void;
  onConfirm: () => void;
  onClose: () => void;
  onCancelConfirm: () => void;
}

export function ClosedTradeActionDialog({
  entry,
  confirmAction,
  onAction,
  onConfirm,
  onClose,
  onCancelConfirm,
}: ClosedTradeActionDialogProps) {
  return (
    <>
      <Dialog open={!!entry && !confirmAction} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{entry?.stock_symbol} - İşlem Seçenekleri</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => onAction('revert')}
            >
              <Undo2 className="w-4 h-4" />
              İşlemi Geri Al
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-loss hover:text-loss"
              onClick={() => onAction('delete')}
            >
              <Trash2 className="w-4 h-4" />
              İşlemi Sil
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) onCancelConfirm(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'revert' ? 'İşlemi Geri Al' : 'İşlemi Sil'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'revert'
                ? `${entry?.stock_symbol} kapatma kaydını geri almak istediğinize emin misiniz? ${entry?.lot_quantity} lot ana işleme geri eklenecektir.`
                : `${entry?.stock_symbol} kapatma kaydını kalıcı olarak silmek istediğinize emin misiniz? ${entry?.lot_quantity} lot ana işleme geri eklenecektir.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              className={confirmAction === 'delete' ? 'bg-loss hover:bg-loss/90' : ''}
            >
              {confirmAction === 'revert' ? 'Geri Al' : 'Sil'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
