import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MarketDataProvider } from '@/contexts/MarketDataContext';
import { MarketSeriesProvider } from '@/contexts/MarketSeriesContext';
import Index from './pages/Index';
import Login from './pages/Login';
import Reports from './pages/Reports';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import PanelBlog from './pages/PanelBlog';
import PanelBlogEditor from './pages/PanelBlogEditor';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Yükleniyor...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Yükleniyor...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Index />
          </ProtectedRoute>
        }
      />
      <Route
        path="/raporlarim"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />
      {/* Public Blog Routes */}
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      {/* Protected Panel Blog Routes */}
      <Route
        path="/panel/blog"
        element={
          <ProtectedRoute>
            <PanelBlog />
          </ProtectedRoute>
        }
      />
      <Route
        path="/panel/blog/new"
        element={
          <ProtectedRoute>
            <PanelBlogEditor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/panel/blog/edit/:id"
        element={
          <ProtectedRoute>
            <PanelBlogEditor />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MarketDataProvider>
          <MarketSeriesProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </MarketSeriesProvider>
        </MarketDataProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
