import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from '@/hooks/useAuth';
import { MarketDataProvider } from '@/contexts/MarketDataContext';
import { MarketSeriesProvider } from '@/contexts/MarketSeriesContext';
import { PortfolioProvider } from '@/contexts/PortfolioContext';
import Index from './pages/Index';
import Login from './pages/Login';
import Reports from './pages/Reports';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import PanelBlog from './pages/PanelBlog';
import PanelBlogEditor from './pages/PanelBlogEditor';
import Islemlerim from './pages/Islemlerim';
import Grafik from './pages/Grafik';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-foreground">Yükleniyor...</div>
    </div>
  );
}

function RouteGuard({ children, mode }: { children: React.ReactNode; mode: 'protected' | 'public' }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <AuthLoadingScreen />;

  if (mode === 'protected' && !isAuthenticated) return <Navigate to="/login" replace />;
  if (mode === 'public' && isAuthenticated) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<RouteGuard mode="public"><Login /></RouteGuard>} />
      <Route path="/" element={<RouteGuard mode="protected"><Index /></RouteGuard>} />
      <Route path="/islemlerim" element={<RouteGuard mode="protected"><Islemlerim /></RouteGuard>} />
      <Route path="/grafik" element={<RouteGuard mode="protected"><Grafik /></RouteGuard>} />
      <Route path="/raporlarim" element={<RouteGuard mode="protected"><Reports /></RouteGuard>} />
      {/* Public Blog Routes */}
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      {/* Protected Panel Blog Routes */}
      <Route path="/panel/blog" element={<RouteGuard mode="protected"><PanelBlog /></RouteGuard>} />
      <Route path="/panel/blog/new" element={<RouteGuard mode="protected"><PanelBlogEditor /></RouteGuard>} />
      <Route path="/panel/blog/edit/:id" element={<RouteGuard mode="protected"><PanelBlogEditor /></RouteGuard>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <PortfolioProvider>
            <MarketDataProvider>
              <MarketSeriesProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <AppRoutes />
                </BrowserRouter>
              </MarketSeriesProvider>
            </MarketDataProvider>
          </PortfolioProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
