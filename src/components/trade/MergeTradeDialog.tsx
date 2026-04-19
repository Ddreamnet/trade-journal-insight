import { useMemo, useState } from 'react';
import { ArrowRight, Layers, Calendar, ArrowLeft, Split, Merge } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetBody,
} from '@/components/ui/bottom-sheet';
import { Trade } from '@/types/trade';
import { previewMergeActive } from '@/lib/tradeMerge';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/utils';

export interface MergeIncoming {
  stock_symbol: string;
  stock_name: string;
  trade_type: 'buy' | 'sell';
  entry_price: number;
  target_price: number;
  stop_price: number;
  lot_quantity: number;
  reasons: string[];
}

interface MergeTradeDialogProps {
  candidates: Trade[];
  incoming: MergeIncoming;
  onKeepSeparate: () => void;
  onMerge: (targetTradeId: string) => void;
  onClose: () => void;
  isSubmitting?: boolean;
}

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'd MMM yyyy HH:mm', { locale: tr });
  } catch {
    return iso;
  }
}

export function MergeTradeDialog({
  candidates,
  incoming,
  onKeepSeparate,
  onMerge,
  onClose,
  isSubmitting = false,
}: MergeTradeDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    candidates.length === 1 ? candidates[0].id : null
  );
  const [stage, setStage] = useState<'select' | 'preview'>('select');

  const selected = useMemo(
    () => candidates.find((c) => c.id === selectedId) ?? null,
    [candidates, selectedId]
  );

  const preview = useMemo(() => {
    if (!selected) return null;
    return previewMergeActive(selected, incoming);
  }, [selected, incoming]);

  const handleSelectAndContinue = (id: string) => {
    setSelectedId(id);
    setStage('preview');
  };

  const handleBack = () => {
    setStage('select');
    if (candidates.length > 1) setSelectedId(null);
  };

  const handleConfirmMerge = () => {
    if (!selectedId) return;
    onMerge(selectedId);
  };

  return (
    <BottomSheet open onOpenChange={(open) => { if (!open && !isSubmitting) onClose(); }}>
      <BottomSheetContent size="lg">
        <BottomSheetHeader>
          <BottomSheetTitle>
            {stage === 'select' ? (
              <>Açık {incoming.stock_symbol} İşlemi Var</>
            ) : (
              <>Birleştirme Önizlemesi — {incoming.stock_symbol}</>
            )}
          </BottomSheetTitle>
        </BottomSheetHeader>

        <BottomSheetBody>
          <div className="space-y-4 pt-1">
            {stage === 'select' && (
              <>
                <p className="text-sm text-muted-foreground">
                  {candidates.length === 1 ? (
                    <>
                      Bu portföyde zaten bir açık <span className="font-semibold text-foreground">{incoming.stock_symbol}</span> işleminiz var.
                      Bununla birleştirmek ister misiniz, yoksa ayrı mı tutmak istersiniz?
                    </>
                  ) : (
                    <>
                      Bu portföyde <span className="font-semibold text-foreground">{candidates.length} adet</span> açık{' '}
                      <span className="font-semibold text-foreground">{incoming.stock_symbol}</span> işleminiz var.
                      Hangisiyle birleştirmek istediğinizi seçin veya ayrı tutun.
                    </>
                  )}
                </p>

                <div className="space-y-2">
                  {candidates.map((c, i) => {
                    const isSelected = selectedId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectAndContinue(c.id)}
                        className={cn(
                          'w-full text-left p-3 rounded-lg border transition-all',
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50 hover:bg-secondary/40'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">#{i + 1}</span>
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-foreground">{formatDate(c.created_at)}</span>
                          </div>
                          {c.merge_count > 1 && (
                            <span
                              className="inline-flex items-center gap-1 text-caption px-1.5 py-0.5 rounded-md bg-surface-3 text-muted-foreground"
                              title="Daha önce birleşmiş işlem"
                            >
                              <Layers className="w-2.5 h-2.5" />
                              {c.merge_count} birleşme
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div>
                            <div className="text-caption text-muted-foreground">Kalan Lot</div>
                            <div className="font-mono text-xs text-foreground">{c.remaining_lot}/{c.lot_quantity}</div>
                          </div>
                          <div>
                            <div className="text-caption text-muted-foreground">Giriş</div>
                            <div className="font-mono text-xs text-foreground">{formatPrice(c.entry_price, c.stock_symbol)}</div>
                          </div>
                          <div>
                            <div className="text-caption text-muted-foreground">Hedef</div>
                            <div className="font-mono text-xs text-foreground">{formatPrice(c.target_price, c.stock_symbol)}</div>
                          </div>
                          <div>
                            <div className="text-caption text-muted-foreground">Stop</div>
                            <div className="font-mono text-xs text-foreground">{formatPrice(c.stop_price, c.stock_symbol)}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={onKeepSeparate}
                    disabled={isSubmitting}
                  >
                    <Split className="w-4 h-4" />
                    Ayrı Tut
                  </Button>
                  {candidates.length === 1 && (
                    <Button
                      type="button"
                      className="flex-1 gap-2"
                      onClick={() => handleSelectAndContinue(candidates[0].id)}
                      disabled={isSubmitting}
                    >
                      <Merge className="w-4 h-4" />
                      Birleştir
                    </Button>
                  )}
                </div>
              </>
            )}

            {stage === 'preview' && selected && preview && (
              <>
                <p className="text-sm text-muted-foreground">
                  Aşağıdaki ağırlıklı ortalama hesaplanacak. Lotlar toplanacak ve
                  işlem geçmişine bu birleşme kaydedilecek.
                </p>

                {/* Mevcut */}
                <div className="p-3 rounded-lg border border-border bg-secondary/40">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">
                      Mevcut işlem · {formatDate(selected.created_at)}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <Cell label="Lot" value={`${selected.lot_quantity}`} />
                    <Cell label="Giriş" value={formatPrice(selected.entry_price, incoming.stock_symbol)} />
                    <Cell label="Hedef" value={formatPrice(selected.target_price, incoming.stock_symbol)} />
                    <Cell label="Stop" value={formatPrice(selected.stop_price, incoming.stock_symbol)} />
                  </div>
                </div>

                {/* Yeni (eklenecek) */}
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="text-xs font-medium text-foreground mb-2">Eklenecek</div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <Cell label="Lot" value={`${incoming.lot_quantity}`} />
                    <Cell label="Giriş" value={formatPrice(incoming.entry_price, incoming.stock_symbol)} />
                    <Cell label="Hedef" value={formatPrice(incoming.target_price, incoming.stock_symbol)} />
                    <Cell label="Stop" value={formatPrice(incoming.stop_price, incoming.stock_symbol)} />
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>

                {/* Sonuç */}
                <div className="p-3 rounded-lg border border-profit/40 bg-profit/5">
                  <div className="text-xs font-semibold text-profit mb-2">Sonuç (ağırlıklı ortalama)</div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <Cell label="Lot" value={`${preview.newLot}`} highlight />
                    <Cell label="Giriş" value={formatPrice(preview.newEntry, incoming.stock_symbol)} highlight />
                    <Cell label="Hedef" value={formatPrice(preview.newTarget, incoming.stock_symbol)} highlight />
                    <Cell label="Stop" value={formatPrice(preview.newStop, incoming.stock_symbol)} highlight />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={handleBack}
                    disabled={isSubmitting}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Geri
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 gap-2"
                    onClick={handleConfirmMerge}
                    disabled={isSubmitting}
                  >
                    <Merge className="w-4 h-4" />
                    {isSubmitting ? 'Birleştiriliyor...' : 'Birleştir'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  );
}

function Cell({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-caption text-muted-foreground">{label}</div>
      <div className={cn('num-sm mt-0.5', highlight ? 'text-profit font-semibold' : 'text-foreground')}>
        {value}
      </div>
    </div>
  );
}
