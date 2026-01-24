import { ReactNode } from 'react';
import { Header } from './Header';
import { TickerTape } from './TickerTape';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-16">
        <TickerTape />
        <main className="container mx-auto px-4 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
