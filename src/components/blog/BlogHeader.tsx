import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import logo from '@/assets/logo.png';

interface BlogHeaderProps {
  showBack?: boolean;
}

export const BlogHeader = forwardRef<HTMLElement, BlogHeaderProps>(
  function BlogHeader({ showBack = false }, ref) {
    return (
      <header
        ref={ref}
        className="sticky top-0 z-40 bg-[#0B0D11] border-b border-white/5"
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3 min-w-0">
              <Link to="/blog" className="flex items-center gap-2.5 min-w-0">
                <img src={logo} alt="Trade Günlüğü" className="h-8 w-auto shrink-0" />
                <span className="text-base font-semibold text-white tracking-tight hidden sm:inline">
                  Trade Günlüğü
                </span>
                <span className="text-sm font-medium text-blue-400 shrink-0">Blog</span>
              </Link>
            </div>

            {showBack && (
              <Link
                to="/blog"
                className="inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Tüm yazılar</span>
                <span className="sm:hidden">Geri</span>
              </Link>
            )}

            {!showBack && (
              <Link
                to="/login"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Giriş
              </Link>
            )}
          </div>
        </div>
      </header>
    );
  }
);
