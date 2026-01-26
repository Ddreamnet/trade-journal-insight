import { ReactNode } from 'react';
import { Header } from './Header';
import { TickerTape } from './TickerTape';
import { MarketDataStatus } from './MarketDataStatus';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen liquid-bg">
      <Header />
      <div className="pt-16">
        <TickerTape />
        <div className="container mx-auto px-4 pt-2 flex justify-end">
          <MarketDataStatus />
        </div>
        <main className="container mx-auto px-4 py-4">
          {children}
        </main>
      </div>
    </div>
  );
}
