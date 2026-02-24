import { ReactNode } from 'react';
import { Header } from './Header';
import { TickerTape } from './TickerTape';
import { MarketDataStatus } from './MarketDataStatus';
import { usePortfolioCash } from '@/hooks/usePortfolioCash';
import { useAuth } from '@/hooks/useAuth';
import { Wallet } from 'lucide-react';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isAuthenticated } = useAuth();
  const { availableCash, isCashLoading } = usePortfolioCash();

  return (
    <div className="min-h-screen liquid-bg">
      <Header />
      <div className="pt-16">
        <TickerTape />
        <div className="container mx-auto px-4 pt-2 flex items-center justify-between">
          {isAuthenticated && (
            <div className="flex items-center gap-1.5 text-sm">
              <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Bakiye:</span>
              <span className={`font-mono font-semibold ${availableCash >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                {isCashLoading ? '...' : `₺${availableCash.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              </span>
            </div>
          )}
          <MarketDataStatus />
        </div>
        <main className="container mx-auto px-4 py-4">
          {children}
        </main>
      </div>
    </div>
  );
}
