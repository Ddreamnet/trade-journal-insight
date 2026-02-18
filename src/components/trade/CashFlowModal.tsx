import { useState, useEffect } from 'react';
import {
  X, Plus, Minus, Wallet, ChevronLeft, Building2,
  Coins, DollarSign, Info, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { usePortfolioCash } from '@/hooks/usePortfolioCash';
import { useUserAssets, AssetType, AssetCategory, QuantityUnit } from '@/hooks/useUserAssets';
import { useMarketSeries } from '@/contexts/MarketSeriesContext';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

interface CashFlowModalProps {
  onClose: () => void;
}

type Step = 'category' | 'type' | 'amount';
type Category = 'cash' | 'real_estate' | 'commodity';
type CashType = 'tl' | 'usd' | 'eur';
type RealEstateType = 'konut' | 'isyeri' | 'arsa';
type CommodityType = 'bitcoin' | 'ethereum' | 'altin' | 'gumus';

const CATEGORY_OPTIONS: { id: Category; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'cash', label: 'Nakit', icon: <Wallet className="w-5 h-5" />, desc: 'TL, USD veya EUR' },
  { id: 'real_estate', label: 'Gayrimenkul', icon: <Building2 className="w-5 h-5" />, desc: 'Konut, işyeri, arsa' },
  { id: 'commodity', label: 'Emtia', icon: <Coins className="w-5 h-5" />, desc: 'Bitcoin, altın, gümüş...' },
];

const CASH_TYPES: { id: CashType; label: string; symbol: string }[] = [
  { id: 'tl', label: 'TL', symbol: '₺' },
  { id: 'usd', label: 'USD', symbol: '$' },
  { id: 'eur', label: 'EUR', symbol: '€' },
];

const REAL_ESTATE_TYPES: { id: RealEstateType; label: string }[] = [
  { id: 'konut', label: 'Konut' },
  { id: 'isyeri', label: 'İşyeri' },
  { id: 'arsa', label: 'Arsa' },
];

const COMMODITY_TYPES: { id: CommodityType; label: string; unit: QuantityUnit; unitLabel: string; apiSupported: boolean }[] = [
  { id: 'bitcoin', label: 'Bitcoin', unit: 'btc', unitLabel: 'BTC', apiSupported: false },
  { id: 'ethereum', label: 'Ethereum', unit: 'eth', unitLabel: 'ETH', apiSupported: false },
  { id: 'altin', label: 'Altın', unit: 'gram', unitLabel: 'gram', apiSupported: true },
  { id: 'gumus', label: 'Gümüş', unit: 'gram', unitLabel: 'gram', apiSupported: false },
];

const ASSET_LABEL: Record<string, string> = {
  usd: 'USD', eur: 'EUR', konut: 'Konut', isyeri: 'İşyeri', arsa: 'Arsa',
  bitcoin: 'Bitcoin', ethereum: 'Ethereum', altin: 'Altın', gumus: 'Gümüş',
};

export function CashFlowModal({ onClose }: CashFlowModalProps) {
  const { cashFlows, availableCash, addDeposit, addWithdraw } = usePortfolioCash();
  const { assets, addAsset } = useUserAssets();
  const { getSeriesData, fetchSeries, isLoading: isSeriesLoading } = useMarketSeries();

  // Deposit flow state
  const [step, setStep] = useState<Step>('category');
  const [category, setCategory] = useState<Category | null>(null);
  const [cashType, setCashType] = useState<CashType | null>(null);
  const [realEstateType, setRealEstateType] = useState<RealEstateType | null>(null);
  const [commodityType, setCommodityType] = useState<CommodityType | null>(null);
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Gold price from API
  const [goldPriceUsd, setGoldPriceUsd] = useState<number | null>(null);

  // Fetch gold price when commodity step + altin selected
  useEffect(() => {
    if (category === 'commodity' && step === 'amount') {
      fetchSeries('gold');
      fetchSeries('usd');
    }
  }, [category, step, fetchSeries]);

  useEffect(() => {
    if (commodityType !== 'altin') return;
    const goldData = getSeriesData('gold');
    const usdData = getSeriesData('usd');
    if (goldData?.points?.length && usdData?.points?.length) {
      const goldTry = goldData.points[goldData.points.length - 1].value;
      const usdTry = usdData.points[usdData.points.length - 1].value;
      if (usdTry > 0) {
        const pricePerGram = goldTry / usdTry;
        setGoldPriceUsd(pricePerGram);
      }
    }
  }, [getSeriesData, commodityType]);

  // Auto-fill amount when gold price + quantity available
  useEffect(() => {
    if (commodityType === 'altin' && goldPriceUsd && quantity) {
      const qty = parseFloat(quantity);
      if (!isNaN(qty) && qty > 0) {
        setAmount((qty * goldPriceUsd).toFixed(2));
      }
    }
  }, [goldPriceUsd, quantity, commodityType]);

  const resetDepositFlow = () => {
    setStep('category');
    setCategory(null);
    setCashType(null);
    setRealEstateType(null);
    setCommodityType(null);
    setTitle('');
    setQuantity('');
    setAmount('');
    setNote('');
    setGoldPriceUsd(null);
  };

  const goBack = () => {
    if (step === 'amount') {
      setStep('type');
      setAmount('');
      setQuantity('');
      setTitle('');
    } else if (step === 'type') {
      setStep('category');
      setCashType(null);
      setRealEstateType(null);
      setCommodityType(null);
    }
  };

  const handleCategorySelect = (cat: Category) => {
    setCategory(cat);
    setStep('type');
  };

  const handleTypeSelect = (type: CashType | RealEstateType | CommodityType) => {
    if (category === 'cash') setCashType(type as CashType);
    else if (category === 'real_estate') setRealEstateType(type as RealEstateType);
    else if (category === 'commodity') setCommodityType(type as CommodityType);
    setStep('amount');
  };

  const parsedAmount = parseFloat(amount);
  const parsedQuantity = parseFloat(quantity);
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount > 0;
  const isValidQuantity = !isNaN(parsedQuantity) && parsedQuantity > 0;

  // For real estate, title is required
  const isFormValid = () => {
    if (!isValidAmount) return false;
    if (category === 'real_estate' && !title.trim()) return false;
    if (category === 'commodity') {
      const ct = COMMODITY_TYPES.find(c => c.id === commodityType);
      if (ct && ct.unit !== 'unit') return isValidQuantity;
    }
    return true;
  };

  const handleSave = async () => {
    if (!isFormValid() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (category === 'cash' && cashType === 'tl') {
        // TL → portfolio_cash_flows deposit
        await addDeposit.mutateAsync({ amount: parsedAmount, note: note.trim() || undefined });
      } else if (category === 'cash' && cashType === 'usd') {
        const qty = parsedAmount; // USD amount = quantity
        await addAsset.mutateAsync({
          category: 'cash',
          asset_type: 'usd',
          quantity: qty,
          quantity_unit: 'usd',
          amount_usd: parsedAmount,
          note: note.trim() || undefined,
        });
      } else if (category === 'cash' && cashType === 'eur') {
        await addAsset.mutateAsync({
          category: 'cash',
          asset_type: 'eur',
          quantity: parsedAmount,
          quantity_unit: 'eur',
          amount_usd: parsedAmount, // stored as USD-equiv value user entered
          note: note.trim() || undefined,
        });
      } else if (category === 'real_estate') {
        await addAsset.mutateAsync({
          category: 'real_estate',
          asset_type: realEstateType as AssetType,
          title: title.trim(),
          quantity: 1,
          quantity_unit: 'unit',
          amount_usd: parsedAmount,
          note: note.trim() || undefined,
        });
      } else if (category === 'commodity') {
        const ct = COMMODITY_TYPES.find(c => c.id === commodityType)!;
        await addAsset.mutateAsync({
          category: 'commodity',
          asset_type: commodityType as AssetType,
          quantity: ct.unit !== 'unit' ? parsedQuantity : 1,
          quantity_unit: ct.unit,
          amount_usd: parsedAmount,
          note: note.trim() || undefined,
        });
      }
      resetDepositFlow();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0 || isWithdrawing) return;
    setIsWithdrawing(true);
    try {
      await addWithdraw.mutateAsync({ amount: amt, note: withdrawNote.trim() || undefined });
      setWithdrawAmount('');
      setWithdrawNote('');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const getCommodityCurrentType = () => COMMODITY_TYPES.find(c => c.id === commodityType);

  // Merged history: TL cash flows + user assets
  const historyItems = [
    ...cashFlows.map(f => ({
      id: f.id,
      label: f.flow_type === 'deposit' ? 'TL Para Ekleme' : 'TL Para Çekme',
      subLabel: f.note,
      type: f.flow_type as 'deposit' | 'withdraw',
      displayAmount: `${f.flow_type === 'deposit' ? '+' : '-'}₺${f.amount.toLocaleString('tr-TR')}`,
      date: f.created_at,
      positive: f.flow_type === 'deposit',
    })),
    ...assets.map(a => ({
      id: a.id,
      label: a.title ? `${ASSET_LABEL[a.asset_type] || a.asset_type} – ${a.title}` : ASSET_LABEL[a.asset_type] || a.asset_type,
      subLabel: a.note,
      type: 'asset' as const,
      displayAmount: `+$${a.amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      date: a.created_at,
      positive: true,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md max-h-[92vh] bg-background-secondary border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col animate-fade-in">
        {/* Header */}
        <div className="border-b border-border p-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Portföy Yönetimi</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-secondary text-center">
            <div className="text-xs text-muted-foreground mb-1">Kullanılabilir TL Bakiye</div>
            <div className="font-mono text-xl font-bold text-foreground">
              ₺{availableCash.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4">
            <Tabs defaultValue="add">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="add" className="gap-1">
                  <Plus className="w-3 h-3" /> Varlık Ekle
                </TabsTrigger>
                <TabsTrigger value="withdraw" className="gap-1" onClick={resetDepositFlow}>
                  <Minus className="w-3 h-3" /> TL Çıkar
                </TabsTrigger>
              </TabsList>

              {/* === ADD TAB === */}
              <TabsContent value="add" className="mt-4">
                {/* Step indicator */}
                {step !== 'category' && (
                  <button
                    onClick={goBack}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Geri
                  </button>
                )}

                {/* STEP 1: Category */}
                {step === 'category' && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-1">Eklenecek varlık kategorisini seçin:</p>
                    {CATEGORY_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => handleCategorySelect(opt.id)}
                        className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-secondary/40 hover:bg-secondary hover:border-primary/40 transition-all text-left group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                          {opt.icon}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{opt.label}</div>
                          <div className="text-xs text-muted-foreground">{opt.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* STEP 2: Type selection */}
                {step === 'type' && category === 'cash' && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-3">Para birimi seçin:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {CASH_TYPES.map(t => (
                        <button
                          key={t.id}
                          onClick={() => handleTypeSelect(t.id)}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-secondary/40 hover:bg-secondary hover:border-primary/40 transition-all"
                        >
                          <span className="text-2xl font-bold text-primary">{t.symbol}</span>
                          <span className="text-sm font-medium text-foreground">{t.label}</span>
                          {t.id === 'tl' && (
                            <span className="text-[10px] text-profit bg-profit/10 rounded px-1.5 py-0.5">Bakiyeye ekler</span>
                          )}
                          {(t.id === 'usd' || t.id === 'eur') && (
                            <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">Sadece varlık</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 'type' && category === 'real_estate' && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-3">Gayrimenkul türü seçin:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {REAL_ESTATE_TYPES.map(t => (
                        <button
                          key={t.id}
                          onClick={() => handleTypeSelect(t.id)}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-secondary/40 hover:bg-secondary hover:border-primary/40 transition-all"
                        >
                          <Building2 className="w-6 h-6 text-primary" />
                          <span className="text-sm font-medium text-foreground">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 'type' && category === 'commodity' && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-3">Emtia türü seçin:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {COMMODITY_TYPES.map(t => (
                        <button
                          key={t.id}
                          onClick={() => handleTypeSelect(t.id)}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-secondary/40 hover:bg-secondary hover:border-primary/40 transition-all"
                        >
                          <Coins className="w-6 h-6 text-primary" />
                          <span className="text-sm font-medium text-foreground">{t.label}</span>
                          {t.apiSupported ? (
                            <span className="text-[10px] text-profit bg-profit/10 rounded px-1.5 py-0.5">Otomatik fiyat</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">Manuel giriş</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* STEP 3: Amount */}
                {step === 'amount' && (
                  <div className="space-y-4">
                    {/* Context badge */}
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {category === 'cash' && cashType && CASH_TYPES.find(t => t.id === cashType)?.label}
                        {category === 'real_estate' && realEstateType && REAL_ESTATE_TYPES.find(t => t.id === realEstateType)?.label}
                        {category === 'commodity' && commodityType && COMMODITY_TYPES.find(t => t.id === commodityType)?.label}
                      </Badge>
                      {category === 'cash' && cashType === 'tl' && (
                        <span className="text-xs text-profit">→ Kullanılabilir bakiyeye eklenecek</span>
                      )}
                      {category === 'cash' && cashType !== 'tl' && (
                        <span className="text-xs text-muted-foreground">→ Sadece varlıklarda görünecek</span>
                      )}
                      {(category === 'real_estate' || category === 'commodity') && (
                        <span className="text-xs text-muted-foreground">→ Sadece varlıklarda görünecek</span>
                      )}
                    </div>

                    {/* Real estate: title input */}
                    {category === 'real_estate' && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                          Başlık <span className="text-loss">*</span>
                        </label>
                        <Input
                          placeholder="Örn: Çatalca Arsa, Kadıköy Daire..."
                          value={title}
                          onChange={e => setTitle(e.target.value)}
                          maxLength={100}
                        />
                      </div>
                    )}

                    {/* Commodity quantity */}
                    {category === 'commodity' && (() => {
                      const ct = getCommodityCurrentType();
                      if (!ct || ct.unit === 'unit') return null;
                      return (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                            Miktar ({ct.unitLabel})
                          </label>
                          <NumberInput
                            step="any"
                            min="0"
                            placeholder={`Örn: ${ct.unit === 'gram' ? '100' : '0.5'}`}
                            value={quantity}
                            onChange={e => setQuantity(e.target.value)}
                            className="font-mono"
                          />
                        </div>
                      );
                    })()}

                    {/* Gold auto-price note */}
                    {category === 'commodity' && commodityType === 'altin' && (
                      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg p-2.5">
                        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>
                          {isSeriesLoading('gold') || isSeriesLoading('usd')
                            ? 'Güncel altın fiyatı çekiliyor...'
                            : goldPriceUsd
                            ? `Güncel altın fiyatı: ~$${goldPriceUsd.toFixed(2)}/gram (XAUTRY/USDTRY). İsterseniz USD tutarını düzenleyebilirsiniz.`
                            : 'Altın fiyatı çekilemedi, USD tutarını manuel girin.'}
                        </span>
                      </div>
                    )}

                    {/* Bitcoin/Ethereum/Silver note */}
                    {category === 'commodity' && (commodityType === 'bitcoin' || commodityType === 'ethereum' || commodityType === 'gumus') && (
                      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg p-2.5">
                        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>Otomatik fiyat bağlantısı yakında eklenecek. Şimdilik USD değerini manuel girin.</span>
                      </div>
                    )}

                    {/* Amount */}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                        {category === 'cash' && cashType === 'tl' ? 'Tutar (₺)' : 'Değer (USD)'}
                      </label>
                      <NumberInput
                        step="any"
                        min="0"
                        placeholder={category === 'cash' && cashType === 'tl' ? 'Örn: 50000' : 'Örn: 1000'}
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="font-mono"
                      />
                    </div>

                    {/* Note */}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Not (Opsiyonel)</label>
                      <Textarea
                        placeholder="Açıklama..."
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        className="resize-none h-16"
                        maxLength={200}
                      />
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleSave}
                      disabled={!isFormValid() || isSubmitting}
                    >
                      {isSubmitting ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Kaydediliyor...</>
                      ) : (
                        'Kaydet'
                      )}
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* === WITHDRAW TAB === */}
              <TabsContent value="withdraw" className="mt-4 space-y-3">
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg p-2.5 mb-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Sadece TL bakiyenizden para çekebilirsiniz. USD/EUR ve diğer varlıkları satmak için "Çevirici" butonunu kullanın.</span>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Tutar (₺)</label>
                  <NumberInput
                    step="1"
                    min="1"
                    placeholder="Örn: 5000"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Not (Opsiyonel)</label>
                  <Textarea
                    placeholder="Açıklama..."
                    value={withdrawNote}
                    onChange={e => setWithdrawNote(e.target.value)}
                    className="resize-none h-16"
                    maxLength={200}
                  />
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleWithdraw}
                  disabled={isNaN(parseFloat(withdrawAmount)) || parseFloat(withdrawAmount) <= 0 || isWithdrawing}
                >
                  {isWithdrawing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Çekiliyor...</> : 'Para Çıkar'}
                </Button>
              </TabsContent>
            </Tabs>

            {/* History */}
            {historyItems.length > 0 && (
              <div className="border-t border-border pt-4 mt-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Geçmiş Kayıtlar</h3>
                <div className="space-y-2">
                  {historyItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/50">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center',
                          item.positive ? 'bg-profit/20' : 'bg-loss/20'
                        )}>
                          {item.positive
                            ? <Plus className="w-3 h-3 text-profit" />
                            : <Minus className="w-3 h-3 text-loss" />}
                        </div>
                        <div>
                          <div className="text-sm text-foreground">{item.label}</div>
                          {item.subLabel && (
                            <div className="text-xs text-muted-foreground truncate max-w-[160px]">{item.subLabel}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={cn(
                          'font-mono text-sm font-medium',
                          item.positive ? 'text-profit' : 'text-loss'
                        )}>
                          {item.displayAmount}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(parseISO(item.date), 'd MMM HH:mm', { locale: tr })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
