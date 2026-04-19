import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
      description:
        'Trade Günlüğü blog yazıları — borsa, teknik analiz ve yatırım stratejileri.',
    });
  }, []);

  const handlePageChange = (newPage: number) => {
    setSearchParams({ page: newPage.toString() });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F6F7' }}>
      <BlogHeader />

      {/* Intro */}
      <section className="container mx-auto px-4 pt-10 pb-6 md:pt-14 md:pb-8">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.14em] text-gray-500 font-medium mb-3">
            Trade Günlüğü · Blog
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
            Borsa, teknik analiz ve yatırım üzerine yazılar
          </h1>
          <p className="mt-3 text-base text-gray-600 max-w-xl">
            Piyasa notları, strateji denemeleri ve Trade Günlüğü'nden
            çıkarılmış dersler.
          </p>
        </div>
      </section>

      <main className="container mx-auto px-4 pb-16">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl overflow-hidden animate-pulse border border-gray-100"
              >
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
          <div className="rounded-2xl bg-white border border-gray-100 px-6 py-20 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center text-2xl">
              ✍︎
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">
              Henüz blog yazısı yok
            </h2>
            <p className="text-sm text-gray-500">
              Yakında burada yeni yazılar olacak.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {data.posts.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>

            {data.totalPages > 1 && (
              <nav
                aria-label="Sayfalama"
                className="flex justify-center items-center gap-1.5 mt-12"
              >
                <button
                  onClick={() => handlePageChange(Math.max(1, page - 1))}
                  disabled={page === 1}
                  aria-label="Önceki sayfa"
                  className={cn(
                    'inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors',
                    page === 1
                      ? 'border-gray-200 bg-white text-gray-300 cursor-not-allowed'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: data.totalPages }, (_, i) => i + 1).map(
                  (p) => (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p)}
                      aria-current={p === page ? 'page' : undefined}
                      className={cn(
                        'w-9 h-9 rounded-lg text-sm font-medium transition-colors border',
                        p === page
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
                      )}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() =>
                    handlePageChange(Math.min(data.totalPages, page + 1))
                  }
                  disabled={page === data.totalPages}
                  aria-label="Sonraki sayfa"
                  className={cn(
                    'inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors',
                    page === data.totalPages
                      ? 'border-gray-200 bg-white text-gray-300 cursor-not-allowed'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  );
}
