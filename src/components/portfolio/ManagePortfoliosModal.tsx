import { useState } from 'react';
import {
  X, Pencil, Check, FolderOpen, FolderClosed,
  Archive, RotateCcw, Trash2, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePortfolios } from '@/hooks/usePortfolios';
import { Portfolio } from '@/types/portfolio';

interface ManagePortfoliosModalProps {
  open: boolean;
  onClose: () => void;
}

export function ManagePortfoliosModal({ open, onClose }: ManagePortfoliosModalProps) {
  const { portfolios, renamePortfolio, setPortfolioStatus, deletePortfolio } = usePortfolios();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Portfolio | null>(null);

  if (!open) return null;

  const startEdit = (p: Portfolio) => {
    setEditingId(p.id);
    setDraftName(p.name);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraftName('');
  };
  const commitEdit = async (p: Portfolio) => {
    const name = draftName.trim();
    if (!name || name === p.name) {
      cancelEdit();
      return;
    }
    await renamePortfolio.mutateAsync({ id: p.id, name });
    cancelEdit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md max-h-[85vh] bg-background-secondary border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col animate-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Portföylerim</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {portfolios.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              Henüz portföyünüz yok.
            </div>
          ) : (
            portfolios.map((p) => {
              const isEditing = editingId === p.id;
              const isClosed = p.status === 'closed';
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2 p-3 rounded-lg border border-border bg-secondary/40"
                >
                  <div className="shrink-0">
                    {isClosed ? (
                      <FolderClosed className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <FolderOpen className="w-5 h-5 text-profit" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(p);
                          else if (e.key === 'Escape') cancelEdit();
                        }}
                        maxLength={60}
                        className="h-8"
                      />
                    ) : (
                      <>
                        <div className="text-sm font-medium text-foreground truncate">
                          {p.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isClosed ? 'Kapalı' : 'Aktif'}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isEditing ? (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => commitEdit(p)}>
                          {renamePortfolio.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 text-profit" />
                          )}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={cancelEdit}>
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEdit(p)}
                          title="Yeniden adlandır"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setPortfolioStatus.mutate({
                              id: p.id,
                              status: isClosed ? 'active' : 'closed',
                            })
                          }
                          title={isClosed ? 'Yeniden aç' : 'Kapat'}
                        >
                          {isClosed ? (
                            <RotateCcw className="w-4 h-4 text-primary" />
                          ) : (
                            <Archive className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setConfirmDelete(p)}
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4 text-loss" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-border shrink-0">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Kapat
          </Button>
        </div>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Portföyü sil?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.name}" portföyüne ait <strong>tüm işlemler, kısmi çıkışlar, nakit hareketleri ve varlıklar</strong> kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-loss text-loss-foreground hover:bg-loss/90"
              onClick={() => {
                if (confirmDelete) {
                  deletePortfolio.mutate(confirmDelete.id);
                }
                setConfirmDelete(null);
              }}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
