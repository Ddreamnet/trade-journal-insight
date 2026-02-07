import type { Json } from '@/integrations/supabase/types';

export interface BlogPost {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  content: Json | null;
  status: 'draft' | 'published';
  published_at: string | null;
  reading_time_minutes: number;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPostInsert {
  user_id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  content?: Json | null;
  status?: string;
  published_at?: string | null;
  reading_time_minutes?: number;
  tags?: string[] | null;
}

export interface BlogPostUpdate {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  content?: Json | null;
  status?: string;
  published_at?: string | null;
  reading_time_minutes?: number;
  tags?: string[] | null;
}

export type BlogStatusFilter = 'all' | 'draft' | 'published';
