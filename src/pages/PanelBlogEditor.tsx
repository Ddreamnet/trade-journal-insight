import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Send, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MainLayout } from '@/components/layout/MainLayout';
import { BlogEditor } from '@/components/blog/BlogEditor';
import { ImageUploader } from '@/components/blog/ImageUploader';
import { ReadingTimeWarning } from '@/components/blog/ReadingTimeWarning';
import { useBlogPostById, useBlogMutations } from '@/hooks/useBlogPosts';
import { generateSlug, calculateReadingTime, generateExcerpt } from '@/lib/blogUtils';
import { toast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export default function PanelBlogEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const { data: existingPost, isLoading: isLoadingPost } = useBlogPostById(id || '');
  const { createPost, updatePost, uploadImage } = useBlogMutations();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [tags, setTags] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [content, setContent] = useState<Json | null>(null);
  const [readingTime, setReadingTime] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [postId, setPostId] = useState<string | null>(id || null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);

  // Load existing post data
  useEffect(() => {
    if (existingPost && !hasLoadedRef.current) {
      setTitle(existingPost.title);
      setSlug(existingPost.slug);
      setSlugManual(true);
      setTags(existingPost.tags?.join(', ') || '');
      setCoverImageUrl(existingPost.cover_image_url);
      setContent(existingPost.content);
      setReadingTime(existingPost.reading_time_minutes);
      setPostId(existingPost.id);
      hasLoadedRef.current = true;
    }
  }, [existingPost]);

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManual && title) {
      setSlug(generateSlug(title));
    }
  }, [title, slugManual]);

  // Calculate reading time when content changes
  useEffect(() => {
    if (content) {
      setReadingTime(calculateReadingTime(content));
    }
  }, [content]);

  // Autosave every 30s for drafts
  useEffect(() => {
    if (!postId || !title) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      handleSave(true);
    }, 30000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, tags, coverImageUrl, postId]);

  const handleSave = useCallback(async (isAutoSave = false) => {
    if (!title || isSaving) return;

    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setIsSaving(true);
    try {
      const postData = {
        title,
        slug: slug || generateSlug(title),
        excerpt: generateExcerpt(content),
        cover_image_url: coverImageUrl,
        content,
        tags: parsedTags,
        reading_time_minutes: readingTime,
      };

      if (postId) {
        await updatePost.mutateAsync({ id: postId, ...postData });
      } else {
        const result = await createPost.mutateAsync({ ...postData, status: 'draft' });
        setPostId(result.id);
        // Update URL without full reload
        window.history.replaceState(null, '', `/panel/blog/edit/${result.id}`);
      }

      setLastSaved(new Date());
      if (!isAutoSave) {
        toast({ title: 'Kaydedildi' });
      }
    } catch (err) {
      if (!isAutoSave) {
        toast({ title: 'Kaydetme başarısız', variant: 'destructive' });
      }
    } finally {
      setIsSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, slug, content, coverImageUrl, tags, readingTime, postId, isSaving]);

  const handlePublish = async () => {
    if (!title) {
      toast({ title: 'Başlık gerekli', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const parsedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const postData = {
        title,
        slug: slug || generateSlug(title),
        excerpt: generateExcerpt(content),
        cover_image_url: coverImageUrl,
        content,
        tags: parsedTags,
        reading_time_minutes: readingTime,
        status: 'published',
        published_at: new Date().toISOString(),
      };

      if (postId) {
        await updatePost.mutateAsync({ id: postId, ...postData });
      } else {
        await createPost.mutateAsync(postData);
      }

      toast({ title: 'Yazı yayınlandı!' });
      navigate('/panel/blog');
    } catch {
      toast({ title: 'Yayınlama başarısız', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCoverUpload = async (file: File) => {
    const url = await uploadImage(file);
    setCoverImageUrl(url);
    return url;
  };

  const handleContentImageUpload = async (file: File) => {
    return await uploadImage(file);
  };

  if (isEditing && isLoadingPost) {
    return (
      <MainLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        {/* Action bar */}
        <div className="flex items-center justify-between gap-3 mb-5 pb-4 border-b border-border-subtle">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/panel/blog')}
            className="gap-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Tüm yazılar
          </Button>

          <div className="flex items-center gap-2 sm:gap-3">
            {lastSaved && (
              <span className="hidden sm:inline text-caption text-muted-foreground">
                Kaydedildi · {lastSaved.toLocaleTimeString('tr-TR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave(false)}
              disabled={isSaving || !title}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline">Kaydet</span>
            </Button>
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={isSaving || !title}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Yayınla
            </Button>
          </div>
        </div>

        <div className="space-y-5">
          {/* Reading time warning */}
          <ReadingTimeWarning readingTime={readingTime} />

          {/* Cover Image */}
          <ImageUploader
            imageUrl={coverImageUrl}
            onUpload={handleCoverUpload}
            onRemove={() => setCoverImageUrl(null)}
          />

          {/* Title */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Yazı başlığı…"
            className="text-2xl sm:text-3xl font-bold h-14 border-none bg-transparent px-0 focus-visible:ring-0 placeholder:text-muted-foreground/40"
          />

          {/* Metadata card */}
          <div className="rounded-xl border border-border-subtle bg-surface-2 p-4 space-y-3">
            <div>
              <label className="text-caption text-muted-foreground mb-1 block">
                URL
              </label>
              <div className="flex items-center gap-2">
                <span className="text-label text-muted-foreground font-mono shrink-0">
                  /blog/
                </span>
                <Input
                  value={slug}
                  onChange={(e) => {
                    setSlugManual(true);
                    setSlug(e.target.value);
                  }}
                  placeholder="otomatik-slug"
                  className="text-label font-mono h-9"
                />
              </div>
            </div>

            <div>
              <label className="text-caption text-muted-foreground mb-1 block">
                Etiketler <span className="text-muted-foreground/60">(virgülle ayırın)</span>
              </label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="teknik analiz, borsa, strateji"
                className="text-label h-9"
              />
            </div>
          </div>

          {/* Editor */}
          <BlogEditor
            content={content}
            onChange={setContent}
            onImageUpload={handleContentImageUpload}
          />

          {/* Reading time info */}
          <div className="text-caption text-muted-foreground text-right">
            Tahmini okuma süresi: {readingTime} dakika
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
