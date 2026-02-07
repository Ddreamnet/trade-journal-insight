
-- Create blog_posts table
CREATE TABLE public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  cover_image_url TEXT,
  content JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  reading_time_minutes INTEGER NOT NULL DEFAULT 1,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- SELECT: Published posts are public (anyone can read)
CREATE POLICY "Published posts are publicly readable"
ON public.blog_posts
FOR SELECT
USING (status = 'published');

-- SELECT: Authors can see all their own posts (including drafts)
CREATE POLICY "Authors can view all own posts"
ON public.blog_posts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- INSERT: Authenticated users can create posts
CREATE POLICY "Users can create own posts"
ON public.blog_posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Authors can update own posts
CREATE POLICY "Users can update own posts"
ON public.blog_posts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Authors can delete own posts
CREATE POLICY "Users can delete own posts"
ON public.blog_posts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION public.update_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_blog_posts_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_blog_posts_updated_at();

-- Create blog-images storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true);

-- Storage policies: Anyone can read
CREATE POLICY "Blog images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'blog-images');

-- Storage policies: Authenticated users can upload
CREATE POLICY "Authenticated users can upload blog images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'blog-images');

-- Storage policies: Users can update their own uploads
CREATE POLICY "Users can update own blog images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'blog-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies: Users can delete their own uploads
CREATE POLICY "Users can delete own blog images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'blog-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Index for faster slug lookups
CREATE INDEX idx_blog_posts_slug ON public.blog_posts (slug);

-- Index for status filtering
CREATE INDEX idx_blog_posts_status ON public.blog_posts (status, published_at DESC);

-- Index for user_id
CREATE INDEX idx_blog_posts_user_id ON public.blog_posts (user_id);
