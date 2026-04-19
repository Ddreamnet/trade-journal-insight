import { useMemo, useState } from 'react';
import {
  ArrowRight, ArrowLeftRight, Wallet, DollarSign, Euro,
  Coins, Building2, TrendingUp, TrendingDown, Loader2,
  AlertCircle, CheckCircle2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { StockLogo } from '@/components/ui/stock-logo';

import { usePortfolios } from '@/hooks/usePortfolios';
import { usePortfolioCash } from '@/hooks/usePortfolioCash';
import { useUserAssets, UserAsset } from '@/hooks/useUserAssets';
import { useTrades } from '@/hooks/useTrades';
import {
  usePortfolioTransfer,
  TransferItem,
} from '@/hooks/usePortfolioTransfer';
import { Trade } from '@/types/trade';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/utils';

// ─── Row configuration ─────────────────────────────────────────────────────

const ASSET_TYPE_LABEL: Record<string, string> = {
  usd: 'USD Nakit', eur: 'EUR Nakit',
  bitcoin: 'Bitcoin', ethereum: 'Ethereum',
  altin: 'Altın', gumus: 'Gümüş',
  konut: 'Konut', isyeri: 'İşyeri', arsa: 'Arsa',
};

function assetTypeIcon(type: string) {
  switch (type) {
    case 'usd': return <DollarSign className="w-4 h-4" />;
    case 'eur': return <Euro className="w-4 h-4" />;
    case 'bitcoin':
    case 'ethereum':
    case 'altin':
    case 'gumus': return <Coins className="w-4 h-4" />;
    case 'konut':
    case 'isyeri':
    case 'arsa': return <Building2 className="w-4 h-4" />;
    default: return <Coins className="w-4 h-4" />;
  }
}

function unitSymbol(u: string): string {
  switch (u) {
    case 'usd': return '$';
    case 'eur': return '€';
    case 'gram': return 'gr';
    case 'btc': return 'BTC';
    case 'eth': return 'ETH';
    default: return '';
  }
}

/** Format a native-unit amount with its symbol, short. */
function formatAmountShort(amount: number, unit: string): string {
  if (unit === 'usd') return '$' + amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (unit === 'eur') return '€' + amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (unit === 'gram') return amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + ' gr';
  if (unit === 'btc') return amount.toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' BTC';
  if (unit === 'eth') return amount.toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' ETH';
  return amount.toLocaleString('en-US');
}

function formatTL(v: number): string {
  return '₺' + v.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ─── Row data shape ────────────────────────────────────────────────────────

type RowKey = string;

type Row =
  | {
      key: RowKey;
      kind: 'tl_cash';
      label: string;
      available: number;        // TL
    }
  | {
      key: RowKey;
      kind: 'asset_fungible';
      label: string;
      asset_type: string;
      unit: string;             // 'usd' | 'eur' | 'btc' | 'eth' | 'gram'
      /** Sum of `quantity` across source rows of this asset_type. */
      availableQty: number;
      /** Sum of `amount_usd` across source rows (for display). */
      availableUsd: number;
      /** Source user_asset rows, oldest first. */
      sourceRows: UserAsset[];
    }
  | {
      key: RowKey;
      kind: 'asset_full';
      label: string;
      asset: UserAsset;
    }
  | {
      key: RowKey;
      kind: 'stock';
      label: string;
      trade: Trade;
    };

// ─── Main component ────────────────────────────────────────────────────────

interface Props {
  /** Optional preset for the source portfolio (e.g. from the global selector). */
  initialFromId?: string;
}

export function PortfolioTransferPanel({ initialFromId }: Props = {}) {
  const { portfolios } = usePortfolios();
  const { transfer } = usePortfolioTransfer();

  const [fromId, setFromId] = useState<string>(initialFromId ?? '');
  const [toId, setToId] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  /** staged: rowKey → amount (native unit). Absence = not staged. */
  const [staged, setStaged] = useState<Record<string, number>>({});

  // Data for source portfolio. Pass `[]` (not `null`) when nothing is
  // selected — `null` means "all portfolios combined" in both hooks, which
  // would leak the user's total balance into this panel before they pick a
  // source.
  const { availableCash: sourceTlCash } = usePortfolioCash(fromId || []);
  const { assets: sourceAssets } = useUserAssets(fromId || []);
  const { trades } = useTrades();

  const sourcePortfolio = portfolios.find((p) => p.id === fromId);
  const targetPortfolio = portfolios.find((p) => p.id === toId);

  // ── Build rows ──────────────────────────────────────────────────────────
  const rows = useMemo<Row[]>(() => {
    if (!fromId) return [];
    const list: Row[] = [];

    // TL Nakit
    if (sourceTlCash > 0) {
      list.push({
        key: 'tl_cash',
        kind: 'tl_cash',
        label: 'TL Nakit',
        available: sourceTlCash,
      });
    }

    // Fungible assets — aggregate per asset_type
    const fungibleTypes = ['usd', 'eur', 'bitcoin', 'ethereum', 'altin', 'gumus'];
    for (const t of fungibleTypes) {
      const rowsOfType = sourceAssets
        .filter((a) => a.asset_type === t)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      if (rowsOfType.length === 0) continue;
      const totalQty = rowsOfType.reduce((s, a) => s + a.quantity, 0);
      const totalUsd = rowsOfType.reduce((s, a) => s + a.amount_usd, 0);
      if (totalQty <= 0) continue;

      list.push({
        key: `asset_fungible:${t}`,
        kind: 'asset_fungible',
        label: ASSET_TYPE_LABEL[t] ?? t,
        asset_type: t,
        unit: rowsOfType[0].quantity_unit,
        availableQty: totalQty,
        availableUsd: totalUsd,
        sourceRows: rowsOfType,
      });
    }

    // Real estate — each row individually
    sourceAssets
      .filter((a) => a.category === 'real_estate')
      .forEach((a) => {
        const typeLabel = ASSET_TYPE_LABEL[a.asset_type] ?? a.asset_type;
        const displayLabel = a.title ? `${typeLabel} · ${a.title}` : typeLabel;
        list.push({
          key: `asset_full:${a.id}`,
          kind: 'asset_full',
          label: displayLabel,
          asset: a,
        });
      });

    // Active stocks in this portfolio
    trades
      .filter(
        (t) =>
          t.portfolio_id === fromId &&
          t.status === 'active' &&
          t.remaining_lot > 0
      )
      .forEach((t) => {
        list.push({
          key: `stock:${t.id}`,
          kind: 'stock',
          label: `${t.stock_symbol} · ${t.remaining_lot} lot açık`,
          trade: t,
        });
      });

    return list;
  }, [fromId, sourceTlCash, sourceAssets, trades]);

  const sameSelection = !!fromId && fromId === toId;
  const hasStaged = Object.values(staged).some((v) => v > 0);

  // Reset staged items when source changes
  const handleFromChange = (id: string) => {
    setFromId(id);
    setStaged({});
    if (id === toId) setToId('');
  };
  const handleToChange = (id: string) => setToId(id);

  const swapSides = () => {
    const a = fromId;
    const b = toId;
    setFromId(b);
    setToId(a);
    setStaged({});
  };

  const updateStagedAmount = (row: Row, raw: string) => {
    const amount = parseFloat(raw);
    if (isNaN(amount) || amount <= 0) {
      setStaged((s) => {
        const next = { ...s };
        delete next[row.key];
        return next;
      });
      return;
    }
    // Clamp to available
    let capped = amount;
    if (row.kind === 'tl_cash') capped = Math.min(amount, row.available);
    if (row.kind === 'asset_fungible') capped = Math.min(amount, row.availableQty);
    if (row.kind === 'stock') {
      capped = Math.min(Math.floor(amount), row.trade.remaining_lot);
    }
    if (capped <= 0) {
      setStaged((s) => {
        const next = { ...s };
        delete next[row.key];
        return next;
      });
      return;
    }
    setStaged((s) => ({ ...s, [row.key]: capped }));
  };

  const setMax = (row: Row) => {
    if (row.kind === 'tl_cash') setStaged((s) => ({ ...s, [row.key]: row.available }));
    else if (row.kind === 'asset_fungible') setStaged((s) => ({ ...s, [row.key]: row.availableQty }));
    else if (row.kind === 'stock') setStaged((s) => ({ ...s, [row.key]: row.trade.remaining_lot }));
  };

  const toggleWhole = (row: Row) => {
    if (row.kind !== 'asset_full') return;
    setStaged((s) => {
      const next = { ...s };
      if (next[row.key]) delete next[row.key];
      else next[row.key] = 1;
      return next;
    });
  };

  // ── Build the transfer payload ──────────────────────────────────────────
  const transferItems = useMemo<TransferItem[]>(() => {
    const items: TransferItem[] = [];

    for (const row of rows) {
      const amount = staged[row.key];
      if (!amount || amount <= 0) continue;

      if (row.kind === 'tl_cash') {
        items.push({ type: 'tl_cash', amount });
      } else if (row.kind === 'asset_full') {
        items.push({ type: 'asset_full', asset_id: row.asset.id });
      } else if (row.kind === 'stock') {
        items.push({ type: 'stock', trade_id: row.trade.id, lots: amount });
      } else if (row.kind === 'asset_fungible') {
        // Draw from source rows (oldest first) until the requested quantity
        // is satisfied. Each draw turns into one `asset_partial` item; USD
        // equivalent is proportional within the row.
        let remaining = amount;
        for (const src of row.sourceRows) {
          if (remaining <= 0) break;
          if (src.quantity <= 0) continue;
          const drawQty = Math.min(remaining, src.quantity);
          const ratio = drawQty / src.quantity;
          const drawUsd = src.amount_usd * ratio;
          items.push({
            type: 'asset_partial',
            asset_id: src.id,
            amount_usd: drawUsd,
            quantity: drawQty,
          });
          remaining -= drawQty;
        }
      }
    }

    return items;
  }, [rows, staged]);

  const stagedSummary = useMemo(() => {
    const parts: string[] = [];
    for (const row of rows) {
      const amount = staged[row.key];
      if (!amount || amount <= 0) continue;
      if (row.kind === 'tl_cash') parts.push(formatTL(amount));
      else if (row.kind === 'asset_fungible') parts.push(formatAmountShort(amount, row.unit));
      else if (row.kind === 'asset_full') parts.push(row.label);
      else if (row.kind === 'stock') parts.push(`${amount} lot ${row.trade.stock_symbol}`);
    }
    return parts;
  }, [rows, staged]);

  const canTransfer = !!fromId && !!toId && !sameSelection && hasStaged && !transfer.isPending;

  const handleConfirm = async () => {
    setConfirmOpen(false);
    try {
      await transfer.mutateAsync({
        fromPortfolioId: fromId,
        toPortfolioId: toId,
        items: transferItems,
      });
      setStaged({});
    } catch {
      // toast fires inside the hook
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Portfolio selectors + swap */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2 md:gap-3 items-end">
        <div>
          <div className="text-caption text-muted-foreground mb-1">Aktarılacak (kaynak)</div>
          <Select value={fromId} onValueChange={handleFromChange}>
            <SelectTrigger><SelectValue placeholder="Portföy seçin" /></SelectTrigger>
            <SelectContent>
              {portfolios.map((p) => (
                <SelectItem key={p.id} value={p.id} disabled={p.id === toId}>
                  {p.name}{p.status === 'closed' ? ' (kapalı)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex md:justify-center md:pb-0.5">
          <Button
            variant="outline"
            size="icon"
            onClick={swapSides}
            disabled={!fromId && !toId}
            aria-label="Kaynak ve hedefi değiştir"
            className="mx-auto"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </Button>
        </div>
        <div>
          <div className="text-caption text-muted-foreground mb-1">Aktarılan (hedef)</div>
          <Select value={toId} onValueChange={handleToChange}>
            <SelectTrigger><SelectValue placeholder="Portföy seçin" /></SelectTrigger>
            <SelectContent>
              {portfolios.map((p) => (
                <SelectItem key={p.id} value={p.id} disabled={p.id === fromId}>
                  {p.name}{p.status === 'closed' ? ' (kapalı)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* State banners */}
      {!fromId && (
        <p className="text-label text-muted-foreground text-center py-3">
          Kaynak portföyü seçerek başlayın.
        </p>
      )}
      {sameSelection && (
        <div className="flex items-center gap-2 text-caption text-warning bg-warning/10 rounded-md px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Aynı portföye aktarım yapılamaz.
        </div>
      )}

      {/* Source holdings list */}
      {fromId && (
        <section className="rounded-xl border border-border-subtle bg-surface-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle">
            <h3 className="text-title text-foreground">Aktarılacak</h3>
            <p className="text-caption text-muted-foreground mt-0.5">
              {sourcePortfolio?.name} portföyündeki varlıklar ve hisseler
            </p>
          </div>
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-center text-label text-muted-foreground">
              Bu portföyde aktarılabilir varlık bulunamadı.
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {rows.map((row) => (
                <RowItem
                  key={row.key}
                  row={row}
                  staged={staged[row.key]}
                  onChangeAmount={(v) => updateStagedAmount(row, v)}
                  onMax={() => setMax(row)}
                  onToggleWhole={() => toggleWhole(row)}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Stage summary + action */}
      {hasStaged && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span className="text-label font-semibold text-foreground">
              {transferItems.length} kalem seçildi
            </span>
          </div>
          <p className="text-caption text-muted-foreground">
            {stagedSummary.join(' · ')}
          </p>
          {targetPortfolio && (
            <div className="mt-2 flex items-center gap-1 text-caption text-muted-foreground">
              <span className="font-medium text-foreground">{sourcePortfolio?.name}</span>
              <ArrowRight className="w-3 h-3" />
              <span className="font-medium text-foreground">{targetPortfolio.name}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={!canTransfer}
          className="min-w-[120px]"
        >
          {transfer.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Aktarılıyor…
            </>
          ) : (
            'Aktar'
          )}
        </Button>
      </div>

      {/* Confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aktarımı onayla</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 pt-1">
                <div className="text-body text-foreground">
                  <span className="font-semibold">{sourcePortfolio?.name}</span>
                  {' → '}
                  <span className="font-semibold">{targetPortfolio?.name}</span>
                </div>
                <ul className="text-label text-muted-foreground list-disc ml-4 space-y-0.5">
                  {stagedSummary.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
                <p className="text-caption text-muted-foreground pt-1">
                  Hisse aktarımlarında pozisyon tutarı kadar TL nakit de otomatik olarak
                  taşınır — bakiye denkliği korunur. Parçalı kapatma geçmişleri kaynak
                  portföyde kalır.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Aktar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Row subcomponent ──────────────────────────────────────────────────────

interface RowItemProps {
  row: Row;
  staged: number | undefined;
  onChangeAmount: (raw: string) => void;
  onMax: () => void;
  onToggleWhole: () => void;
}

function RowItem({ row, staged, onChangeAmount, onMax, onToggleWhole }: RowItemProps) {
  const isSelected = !!staged && staged > 0;

  // ── TL cash row ────────────────────────────────────────────
  if (row.kind === 'tl_cash') {
    return (
      <li className={cn(
        'px-4 py-3 flex items-center gap-3 transition-colors',
        isSelected && 'bg-primary/5'
      )}>
        <div className="w-8 h-8 rounded-md bg-surface-2 flex items-center justify-center text-primary shrink-0">
          <Wallet className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-body text-foreground">{row.label}</div>
          <div className="text-caption text-muted-foreground num">
            Bakiye: {formatTL(row.available)}
          </div>
        </div>
        <PartialInput
          value={staged ?? ''}
          onChange={onChangeAmount}
          onMax={onMax}
          placeholder="₺"
          step="0.01"
        />
      </li>
    );
  }

  // ── Fungible asset row ─────────────────────────────────────
  if (row.kind === 'asset_fungible') {
    return (
      <li className={cn(
        'px-4 py-3 flex items-center gap-3 transition-colors',
        isSelected && 'bg-primary/5'
      )}>
        <div className="w-8 h-8 rounded-md bg-surface-2 flex items-center justify-center text-primary shrink-0">
          {assetTypeIcon(row.asset_type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-body text-foreground">{row.label}</div>
          <div className="text-caption text-muted-foreground num">
            Mevcut: {formatAmountShort(row.availableQty, row.unit)}
            {' · '}
            ≈ ${row.availableUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <PartialInput
          value={staged ?? ''}
          onChange={onChangeAmount}
          onMax={onMax}
          placeholder={unitSymbol(row.unit)}
          step="any"
        />
      </li>
    );
  }

  // ── Real estate (whole only) ───────────────────────────────
  if (row.kind === 'asset_full') {
    return (
      <li
        className={cn(
          'px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors',
          isSelected ? 'bg-primary/10' : 'hover:bg-surface-2'
        )}
        onClick={onToggleWhole}
      >
        <div className="w-8 h-8 rounded-md bg-surface-2 flex items-center justify-center text-primary shrink-0">
          {assetTypeIcon(row.asset.asset_type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-body text-foreground truncate">{row.label}</div>
          <div className="text-caption text-muted-foreground num">
            ≈ ${row.asset.amount_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className={cn(
          'w-5 h-5 rounded border shrink-0 flex items-center justify-center',
          isSelected
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-border'
        )}>
          {isSelected && <CheckCircle2 className="w-3 h-3" />}
        </div>
      </li>
    );
  }

  // ── Stock row ──────────────────────────────────────────────
  const trade = row.trade;
  const sign = trade.trade_type === 'buy' ? 1 : -1;
  return (
    <li className={cn(
      'px-4 py-3 flex items-center gap-3 transition-colors',
      isSelected && 'bg-primary/5'
    )}>
      <StockLogo symbol={trade.stock_symbol} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-body text-foreground">{trade.stock_symbol}</span>
          <span
            className={cn(
              'text-caption px-1 py-0.5 rounded',
              trade.trade_type === 'buy'
                ? 'bg-profit-soft text-profit'
                : 'bg-loss-soft text-loss'
            )}
          >
            {trade.trade_type === 'buy' ? 'AL' : 'SAT'}
          </span>
          {sign > 0 ? (
            <TrendingUp className="w-3.5 h-3.5 text-profit" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-loss" />
          )}
        </div>
        <div className="text-caption text-muted-foreground num">
          {trade.remaining_lot} lot · Giriş{' '}
          {formatPrice(trade.entry_price, trade.stock_symbol)}
        </div>
      </div>
      <PartialInput
        value={staged ?? ''}
        onChange={onChangeAmount}
        onMax={onMax}
        placeholder="lot"
        step="1"
        integer
      />
    </li>
  );
}

// ─── Small partial-amount input ────────────────────────────────────────────

interface PartialInputProps {
  value: number | '';
  onChange: (raw: string) => void;
  onMax: () => void;
  placeholder: string;
  step: string;
  integer?: boolean;
}

function PartialInput({ value, onChange, onMax, placeholder, step, integer }: PartialInputProps) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="relative w-[92px]">
        <NumberInput
          value={value}
          onChange={(e) => {
            if (integer) {
              const v = e.target.value.replace(/[^0-9]/g, '');
              onChange(v);
            } else {
              onChange(e.target.value);
            }
          }}
          placeholder={placeholder}
          step={step}
          min="0"
          className="h-9 text-right pr-1 font-mono text-sm"
        />
      </div>
      <button
        type="button"
        onClick={onMax}
        className="text-caption text-primary hover:underline shrink-0"
      >
        Tümü
      </button>
    </div>
  );
}
