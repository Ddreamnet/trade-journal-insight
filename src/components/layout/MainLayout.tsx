import { ReactNode } from 'react';
import { Header } from './Header';
import { TickerTape } from './TickerTape';
import { usePortfolioCash } from '@/hooks/usePortfolioCash';
import { useAuth } from '@/hooks/useAuth';
import { useMarketData } from '@/contexts/MarketDataContext';
import { usePortfolioContext } from '@/contexts/PortfolioContext';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';

interface MainLayoutProps {
  children: ReactNode;
  minimal?: boolean;
}

export function MainLayout({ children, minimal = false }: MainLayoutProps) {
  const { isAuthenticated } = useAuth();
  const { activeSelection, activePortfolio } = usePortfolioContext();
  // Seçim spesifik bir portföyse o portföyün bakiyesi, "Tümü" / null ise toplam
  const cashFilter =
    typeof activeSelection === 'string' && activeSelection !== 'all'
      ? activeSelection
      : null;
  const { availableCash, isCashLoading } = usePortfolioCash(cashFilter);
  const { xu100 } = useMarketData();

  return (
    <div className="min-h-screen liquid-bg">
      <Header />
      <div className="pt-16">
        {!minimal && (
          <>
            <TickerTape />
            <div className="container mx-auto px-4 pt-2 flex items-center justify-between">
              {xu100 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-muted-foreground font-medium">XU100</span>
                  <span className="font-mono font-semibold text-foreground">
                    {xu100.last.toLocaleString('tr-TR')}
                  </span>
                  <span className={`flex items-center gap-0.5 font-mono text-xs ${xu100.chgPct >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                    {xu100.chgPct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {xu100.chgPct >= 0 ? '+' : ''}{xu100.chgPct.toFixed(2)}%
                  </span>
                </div>
              )}
              {isAuthenticated && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {activePortfolio ? `${activePortfolio.name} bakiye:` : 'Toplam bakiye:'}
                  </span>
                  <span className={`font-mono font-semibold ${availableCash >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                    {isCashLoading ? '...' : `₺${availableCash.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
        <main className="container mx-auto px-4 py-4">
          {children}
        </main>
      </div>
    </div>
  );
}
