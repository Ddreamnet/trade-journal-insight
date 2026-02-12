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
      <header ref={ref} className="bg-black border-b border-gray-800 sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link to="/blog" className="flex items-center gap-2">
                <img src={logo} alt="Trade Günlüğü" className="h-10 w-auto" />
                <span className="text-xl font-bold text-blue-500">Blog</span>
              </Link>
              {showBack && (
                <span className="text-gray-600">|</span>
              )}
              {showBack && (
                <Link
                  to="/blog"
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Geri
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>
    );
  }
);
