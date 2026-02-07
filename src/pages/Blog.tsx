import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { BlogHeader } from '@/components/blog/BlogHeader';
import { BlogCard } from '@/components/blog/BlogCard';
import { usePublicBlogPosts } from '@/hooks/useBlogPosts';
import { setSEOMeta } from '@/lib/blogUtils';
import { cn } from '@/lib/utils';

export default function Blog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const { data, isLoading } = usePublicBlogPosts(page);

  useEffect(() => {
    setSEOMeta({
      title: 'Blog | Trade Günlüğü',
      description: 'Trade Günlüğü blog yazıları — borsa, teknik analiz ve yatırım stratejileri.',
    });
  }, []);

  const handlePageChange = (newPage: number) => {
    setSearchParams({ page: newPage.toString() });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F6F7' }}>
      <BlogHeader />

      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          /* Skeleton loading */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl overflow-hidden animate-pulse border border-gray-100">
                <div className="aspect-video bg-gray-200" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : !data || data.posts.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20">
            <span className="text-5xl mb-4 block">📝</span>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Henüz blog yazısı yok
            </h2>
            <p className="text-gray-500">
              Yakında burada yeni yazılar olacak.
            </p>
          </div>
        ) : (
          <>
            {/* Post grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.posts.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-10">
                {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={cn(
                      'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
                      p === page
                        ? 'bg-gray-900 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
