import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Clock,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { usePanelBlogPosts, useBlogMutations } from '@/hooks/useBlogPosts';
import { formatBlogDate } from '@/lib/blogUtils';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { BlogStatusFilter } from '@/types/blog';

const FILTERS: { value: BlogStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'published', label: 'Yayında' },
  { value: 'draft', label: 'Taslak' },
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

  const count = posts?.length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Blog"
        description={
          <>
            {count > 0 ? `${count} yazı` : 'Henüz yazı yok'} ·{' '}
            <Link
              to="/blog"
              className="inline-flex items-center gap-1 text-foreground hover:text-primary"
            >
              Yayın sayfasını gör
              <ExternalLink className="w-3 h-3" />
            </Link>
          </>
        }
        actions={
          <Button onClick={() => navigate('/panel/blog/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Yeni Yazı
          </Button>
        }
      />

      <SegmentedControl
        value={filter}
        onChange={(v) => setFilter(v as BlogStatusFilter)}
        options={FILTERS}
        size="sm"
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !posts || posts.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-surface-2 px-6 py-16 text-center">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-body text-foreground mb-1">
            {filter === 'all'
              ? 'Henüz blog yazısı yok'
              : filter === 'published'
                ? 'Yayınlanmış yazı yok'
                : 'Taslak yok'}
          </p>
          <p className="text-label text-muted-foreground mb-5">
            İlk yazınızı oluşturup yayınlayın.
          </p>
          <Button
            onClick={() => navigate('/panel/blog/new')}
            variant="outline"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            İlk yazıyı oluştur
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface-2 overflow-hidden">
          {posts.map((post) => {
            const isPublished = post.status === 'published';
            return (
              <li
                key={post.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-3 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link
                      to={`/panel/blog/edit/${post.id}`}
                      className="text-body text-foreground font-medium hover:text-primary truncate"
                    >
                      {post.title || 'Başlıksız'}
                    </Link>
                    <span
                      className={cn(
                        'shrink-0 px-2 py-0.5 text-caption font-medium rounded-full',
                        isPublished
                          ? 'bg-profit/15 text-profit'
                          : 'bg-warning/15 text-warning'
                      )}
                    >
                      {isPublished ? 'Yayında' : 'Taslak'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-caption text-muted-foreground mt-1">
                    <span>{formatBlogDate(post.updated_at)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {post.reading_time_minutes} dk
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleTogglePublish(post.id, post.status)}
                    title={isPublished ? 'Taslağa Al' : 'Yayınla'}
                    aria-label={isPublished ? 'Taslağa Al' : 'Yayınla'}
                  >
                    {isPublished ? (
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
                    className="h-8 w-8 text-muted-foreground hover:text-loss"
                    onClick={() => handleDelete(post.id, post.title)}
                    title="Sil"
                    aria-label="Sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
