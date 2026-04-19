import { useState } from 'react';
import {
  Pencil, Check, FolderOpen, FolderClosed,
  Archive, RotateCcw, Trash2, Loader2, X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetBody,
} from '@/components/ui/bottom-sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePortfolios } from '@/hooks/usePortfolios';
import { Portfolio } from '@/types/portfolio';
import { PortfolioTransferPanel } from './PortfolioTransferPanel';

type Tab = 'list' | 'transfer';

interface ManagePortfoliosModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * ManagePortfoliosModal — settings for the user's portfolios.
 *
 * Two tabs:
 *   - "Portföyler": rename / archive / reopen / delete existing portfolios
 *   - "Aktarım":   move items (cash, assets, stocks) between two portfolios
 *
 * Uses the shared BottomSheet primitive (slides up on mobile, centered
 * dialog on desktop). Desktop size `xl` — the transfer panel needs breathing
 * room for the two-column layout.
 */
export function ManagePortfoliosModal({ open, onClose }: ManagePortfoliosModalProps) {
  const [tab, setTab] = useState<Tab>('list');

  return (
    <BottomSheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <BottomSheetContent size="xl" className="flex flex-col">
        <BottomSheetHeader>
          <BottomSheetTitle>Portföylerim</BottomSheetTitle>
        </BottomSheetHeader>

        <div className="px-5 pb-3">
          <SegmentedControl
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            options={[
              { value: 'list', label: 'Portföyler' },
              { value: 'transfer', label: 'Aktarım' },
            ]}
            aria-label="Görünüm"
          />
        </div>

        <BottomSheetBody>
          {tab === 'list' ? <PortfolioList /> : <PortfolioTransferPanel />}
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  );
}

// ─── Portfolio list (existing functionality) ───────────────────────────────

function PortfolioList() {
  const { portfolios, renamePortfolio, setPortfolioStatus, deletePortfolio } = usePortfolios();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Portfolio | null>(null);

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
    <div className="space-y-3">
      {portfolios.length === 0 ? (
        <div className="text-center text-muted-foreground text-label py-8">
          Henüz portföyünüz yok.
        </div>
      ) : (
        portfolios.map((p) => {
          const isEditing = editingId === p.id;
          const isClosed = p.status === 'closed';
          return (
            <div
              key={p.id}
              className="flex items-center gap-2 p-3 rounded-lg border border-border-subtle bg-surface-1"
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
                    <div className="text-body font-medium text-foreground truncate">
                      {p.name}
                    </div>
                    <div className="text-caption text-muted-foreground">
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
