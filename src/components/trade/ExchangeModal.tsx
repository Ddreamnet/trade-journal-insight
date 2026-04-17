import { useState, useEffect } from 'react';
import {
  X, ArrowRightLeft, DollarSign, ChevronRight,
  ChevronLeft, Loader2, Info, Building2, Coins, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserAssets, UserAsset } from '@/hooks/useUserAssets';
import { useMarketSeries } from '@/contexts/MarketSeriesContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ExchangeModalProps {
  onClose: () => void;
  portfolioId: string;
  portfolioName: string;
}

const ASSET_LABELS: Record<string, string> = {
  usd: 'USD',
  eur: 'EUR',
  konut: 'Konut',
  isyeri: 'İşyeri',
  arsa: 'Arsa',
  bitcoin: 'Bitcoin',
  ethereum: 'Ethereum',
  altin: 'Altın',
  gumus: 'Gümüş',
};

const ASSET_ICONS: Record<string, React.ReactNode> = {
  usd: <DollarSign className="w-4 h-4" />,
  eur: <DollarSign className="w-4 h-4" />,
  konut: <Building2 className="w-4 h-4" />,
  isyeri: <Building2 className="w-4 h-4" />,
  arsa: <Building2 className="w-4 h-4" />,
  bitcoin: <Coins className="w-4 h-4" />,
  ethereum: <Coins className="w-4 h-4" />,
  altin: <Coins className="w-4 h-4" />,
  gumus: <Coins className="w-4 h-4" />,
};

export function ExchangeModal({ onClose, portfolioId, portfolioName }: ExchangeModalProps) {
  const { assets, reduceAsset } = useUserAssets(portfolioId);
  const { getSeriesData, fetchSeries, isLoading: isSeriesLoading } = useMarketSeries();
  const { user } = useAuth();

  const [selectedAsset, setSelectedAsset] = useState<UserAsset | null>(null);
  const [sellAmountUsd, setSellAmountUsd] = useState('');
  const [usdTryRate, setUsdTryRate] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch USDTRY
  useEffect(() => {
    fetchSeries('usd');
  }, [fetchSeries]);

  useEffect(() => {
    const usdData = getSeriesData('usd');
    if (usdData?.points?.length) {
      setUsdTryRate(usdData.points[usdData.points.length - 1].value);
    }
  }, [getSeriesData]);

  const parsedSellUsd = parseFloat(sellAmountUsd);
  const isValidSell = !isNaN(parsedSellUsd) && parsedSellUsd > 0 &&
    selectedAsset != null && parsedSellUsd <= selectedAsset.amount_usd + 0.001;

  const estimatedTl = usdTryRate && !isNaN(parsedSellUsd)
    ? parsedSellUsd * usdTryRate
    : null;

  const isRealEstate = selectedAsset?.category === 'real_estate';

  const handleSell = async () => {
    if (!isValidSell || !selectedAsset || isSubmitting || !user) return;
    setIsSubmitting(true);
    try {
      const sellUsd = isRealEstate ? selectedAsset.amount_usd : parsedSellUsd;
      const rate = usdTryRate || 1;
      const tlAmount = sellUsd * rate;

      // Calculate proportion to reduce quantity
      const proportion = sellUsd / selectedAsset.amount_usd;
      const reduceQty = selectedAsset.quantity * proportion;

      // Reduce / delete asset
      await reduceAsset.mutateAsync({
        assetId: selectedAsset.id,
        reduceByUsd: sellUsd,
        reduceByQuantity: reduceQty,
      });

      // Add TL to portfolio_cash_flows as deposit
      const { error } = await supabase
        .from('portfolio_cash_flows')
        .insert({
          user_id: user.id,
          portfolio_id: portfolioId,
          flow_type: 'deposit',
          amount: tlAmount,
          note: `Exchange: ${selectedAsset.title || ASSET_LABELS[selectedAsset.asset_type]} → TL ($${sellUsd.toFixed(2)} × ${rate.toFixed(2)})`,
        });
      if (error) throw error;

      toast({
        title: 'Satış tamamlandı',
        description: `₺${tlAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} bakiyenize eklendi.`,
      });
      setSelectedAsset(null);
      setSellAmountUsd('');
    } catch (e) {
      toast({
        title: 'Hata',
        description: e instanceof Error ? e.message : 'Bir hata oluştu',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md max-h-[90vh] bg-background-secondary border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col animate-fade-in">
        {/* Header */}
        <div className="border-b border-border p-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <ArrowRightLeft className="w-5 h-5 text-primary shrink-0" />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground leading-tight truncate">Çevirici</h2>
                <div className="text-xs text-muted-foreground truncate">{portfolioName}</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Varlıklarınızı TL'ye çevirerek kullanılabilir bakiyenize ekleyin.
          </p>
          {isSeriesLoading('usd') ? (
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> USD/TRY kuru çekiliyor...
            </div>
          ) : usdTryRate ? (
            <div className="mt-2 text-xs text-muted-foreground">
              Güncel kur: <span className="text-foreground font-mono font-semibold">1 USD = ₺{usdTryRate.toFixed(2)}</span>
            </div>
          ) : (
            <div className="mt-2 text-xs text-loss">Kur verisi alınamadı.</div>
          )}
        </div>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-2">
            {assets.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Satılabilir varlık bulunamadı.</p>
                <p className="text-xs mt-1">Önce "Portföy Ekle" ile varlık kaydedin.</p>
              </div>
            )}

            {!selectedAsset && assets.map(asset => (
              <button
                key={asset.id}
                onClick={() => {
                  setSelectedAsset(asset);
                  if (asset.category === 'real_estate') {
                    setSellAmountUsd(asset.amount_usd.toFixed(2));
                  } else {
                    setSellAmountUsd('');
                  }
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary hover:border-primary/40 transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {ASSET_ICONS[asset.asset_type]}
                  </div>
                  <div>
                    <div className="font-medium text-foreground text-sm">
                      {asset.title
                        ? `${ASSET_LABELS[asset.asset_type]} – ${asset.title}`
                        : ASSET_LABELS[asset.asset_type]}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ${asset.amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      {asset.quantity_unit !== 'unit' && asset.quantity_unit !== 'usd' && asset.quantity_unit !== 'eur' && (
                        <span className="ml-1">· {asset.quantity} {asset.quantity_unit}</span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}

            {/* Sell panel */}
            {selectedAsset && (
              <div className="space-y-4">
                <button
                  onClick={() => { setSelectedAsset(null); setSellAmountUsd(''); }}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Tüm varlıklar
                </button>

                {/* Selected asset info */}
                <div className="p-3.5 rounded-xl border border-border bg-secondary/40">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      {ASSET_ICONS[selectedAsset.asset_type]}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground text-sm">
                        {selectedAsset.title
                          ? `${ASSET_LABELS[selectedAsset.asset_type]} – ${selectedAsset.title}`
                          : ASSET_LABELS[selectedAsset.asset_type]}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Toplam: ${selectedAsset.amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </div>
                    </div>
                  </div>
                </div>

                {/* Real estate: full sale only */}
                {isRealEstate ? (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg p-2.5">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>Gayrimenkul tam olarak satılır. Kısmi satış desteklenmez.</span>
                  </div>
                ) : (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                      Satılacak Tutar (USD)
                    </label>
                    <NumberInput
                      step="any"
                      min="0"
                      max={selectedAsset.amount_usd}
                      placeholder={`Maks: $${selectedAsset.amount_usd.toFixed(2)}`}
                      value={sellAmountUsd}
                      onChange={e => setSellAmountUsd(e.target.value)}
                      className="font-mono"
                    />
                    {!isNaN(parsedSellUsd) && parsedSellUsd > selectedAsset.amount_usd && (
                      <p className="text-xs text-loss mt-1">Mevcut bakiyeden fazla giremezsiniz.</p>
                    )}
                  </div>
                )}

                {/* TL preview */}
                {estimatedTl != null && (isRealEstate ? true : isValidSell) && (
                  <div className="p-3 rounded-lg bg-profit/10 border border-profit/20 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Elde edilecek TL</div>
                    <div className="font-mono text-xl font-bold text-profit">
                      ₺{(isRealEstate ? selectedAsset.amount_usd * (usdTryRate || 1) : estimatedTl).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Kullanılabilir bakiyenize eklenecek
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleSell}
                  disabled={isRealEstate ? (!usdTryRate || isSubmitting) : (!isValidSell || isSubmitting)}
                >
                  {isSubmitting
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />İşleniyor...</>
                    : 'TL\'ye Çevir ve Bakiyeye Ekle'}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
