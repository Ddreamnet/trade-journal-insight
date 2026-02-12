import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import logo from '@/assets/logo.png';

interface BlogHeaderProps {
  showBack?: boolean;
}

export function BlogHeader({ showBack = false }: BlogHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            {showBack && (
              <Link
                to="/blog"
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Blog
              </Link>
            )}
            {!showBack && (
              <Link to="/blog" className="flex items-center gap-2">
                <img src={logo} alt="Trade Günlüğü" className="h-10 w-auto" />
                <span className="text-xl font-bold text-gray-900">Blog</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
