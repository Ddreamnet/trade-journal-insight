import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { BlogPost, BlogPostInsert, BlogPostUpdate, BlogStatusFilter } from '@/types/blog';
import type { Json } from '@/integrations/supabase/types';

const POSTS_PER_PAGE = 9;

/**
 * Hook for public blog listing (published posts only)
 */
export function usePublicBlogPosts(page = 1) {
  return useQuery({
    queryKey: ['blog-posts-public', page],
    queryFn: async () => {
      const from = (page - 1) * POSTS_PER_PAGE;
      const to = from + POSTS_PER_PAGE - 1;

      const { data, error, count } = await supabase
        .from('blog_posts')
        .select('*', { count: 'exact' })
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        posts: (data || []) as BlogPost[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / POSTS_PER_PAGE),
        currentPage: page,
      };
    },
  });
}

/**
 * Hook for fetching single post by slug (public)
 */
export function useBlogPostBySlug(slug: string) {
  return useQuery({
    queryKey: ['blog-post', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();

      if (error) throw error;
      return data as BlogPost | null;
    },
    enabled: !!slug,
  });
}

/**
 * Hook for panel blog management (author's posts)
 */
export function usePanelBlogPosts(filter: BlogStatusFilter = 'all') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['blog-posts-panel', user?.id, filter],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('blog_posts')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as BlogPost[];
    },
    enabled: !!user,
  });
}

/**
 * Hook for fetching single post by ID (author view, includes drafts)
 */
export function useBlogPostById(id: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['blog-post-edit', id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as BlogPost | null;
    },
    enabled: !!id && !!user,
  });
}

/**
 * Hook for blog CRUD mutations
 */
export function useBlogMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['blog-posts-panel'] });
    queryClient.invalidateQueries({ queryKey: ['blog-posts-public'] });
  }, [queryClient]);

  const createPost = useMutation({
    mutationFn: async (post: Omit<BlogPostInsert, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('blog_posts')
        .insert({ ...post, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data as BlogPost;
    },
    onSuccess: invalidate,
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, ...updates }: BlogPostUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('blog_posts')
        .update(updates as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BlogPost;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['blog-post-edit', data.id], data);
      invalidate();
    },
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'published' ? 'draft' : 'published';
      const updates: Record<string, unknown> = {
        status: newStatus,
      };

      if (newStatus === 'published') {
        updates.published_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('blog_posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BlogPost;
    },
    onSuccess: invalidate,
  });

  const uploadImage = useCallback(async (file: File): Promise<string> => {
    if (!user) throw new Error('Not authenticated');

    const { validateImageFile, generateImagePath } = await import('@/lib/blogUtils');
    const validationError = validateImageFile(file);
    if (validationError) throw new Error(validationError);

    const path = generateImagePath(user.id, file);

    const { error } = await supabase.storage
      .from('blog-images')
      .upload(path, file, { contentType: file.type });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('blog-images')
      .getPublicUrl(path);

    return urlData.publicUrl;
  }, [user]);

  return {
    createPost,
    updatePost,
    deletePost,
    togglePublish,
    uploadImage,
  };
}
