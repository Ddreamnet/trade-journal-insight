import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Eye, EyeOff, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePanelBlogPosts, useBlogMutations } from '@/hooks/useBlogPosts';
import { formatBlogDate } from '@/lib/blogUtils';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { BlogStatusFilter } from '@/types/blog';

const FILTERS: { id: BlogStatusFilter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'published', label: 'Yayında' },
  { id: 'draft', label: 'Taslak' },
];

export function BlogManageList() {
  const [filter, setFilter] = useState<BlogStatusFilter>('all');
  const { data: posts, isLoading } = usePanelBlogPosts(filter);
  const { deletePost, togglePublish } = useBlogMutations();
  const navigate = useNavigate();

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" yazısını silmek istediğinize emin misiniz?`)) return;
    try {
      await deletePost.mutateAsync(id);
      toast({ title: 'Yazı silindi' });
    } catch {
      toast({ title: 'Silme başarısız', variant: 'destructive' });
    }
  };

  const handleTogglePublish = async (id: string, currentStatus: string) => {
    try {
      const result = await togglePublish.mutateAsync({ id, currentStatus });
      toast({
        title: result.status === 'published' ? 'Yazı yayınlandı' : 'Yazı taslağa alındı',
      });
    } catch {
      toast({ title: 'İşlem başarısız', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Blog Yazıları</h1>
        <Button onClick={() => navigate('/panel/blog/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          Yeni Yazı
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-1 p-1 bg-secondary rounded-lg w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'px-3 py-2 rounded-md text-sm font-medium transition-all',
              filter === f.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !posts || posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Henüz blog yazısı yok</p>
          <Button onClick={() => navigate('/panel/blog/new')} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            İlk yazını oluştur
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div
              key={post.id}
              className="flex items-center justify-between p-4 rounded-lg bg-card border border-border hover:border-muted-foreground/30 transition-colors"
            >
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-2 mb-1">
                  <Link
                    to={`/panel/blog/edit/${post.id}`}
                    className="font-medium text-foreground hover:text-primary truncate"
                  >
                    {post.title || 'Başlıksız'}
                  </Link>
                  <span
                    className={cn(
                      'px-2 py-0.5 text-xs font-medium rounded-full shrink-0',
                      post.status === 'published'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    )}
                  >
                    {post.status === 'published' ? 'Yayında' : 'Taslak'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatBlogDate(post.updated_at)}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {post.reading_time_minutes} dk
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleTogglePublish(post.id, post.status)}
                  title={post.status === 'published' ? 'Taslağa Al' : 'Yayınla'}
                  aria-label={post.status === 'published' ? 'Taslağa Al' : 'Yayınla'}
                >
                  {post.status === 'published' ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigate(`/panel/blog/edit/${post.id}`)}
                  title="Düzenle"
                  aria-label="Düzenle"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(post.id, post.title)}
                  title="Sil"
                  aria-label="Sil"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
