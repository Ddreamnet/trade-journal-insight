import { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Clock, ArrowLeft, Loader2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import { generateHTML } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link_ from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { BlogHeader } from '@/components/blog/BlogHeader';
import { ShareButton } from '@/components/blog/ShareButton';
import { useBlogPostBySlug } from '@/hooks/useBlogPosts';
import { formatBlogDate, setSEOMeta } from '@/lib/blogUtils';

// Extensions used for HTML generation
const extensions = [
  StarterKit,
  Link_.configure({ openOnClick: true }),
  Image,
  Youtube,
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Color,
  TextStyle,
];

function sanitizeHTML(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'src', 'width', 'height', 'style'],
    RETURN_TRUSTED_TYPE: false,
  }) as string;
  // Strip non-YouTube iframes
  return clean.replace(
    /<iframe[^>]*src="(?!https:\/\/(www\.)?youtube\.com)[^"]*"[^>]*><\/iframe>/gi,
    ''
  );
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = useBlogPostBySlug(slug || '');

  // SEO
  useEffect(() => {
    if (post) {
      setSEOMeta({
        title: `${post.title} | Trade Günlüğü Blog`,
        description: post.excerpt || undefined,
        ogImage: post.cover_image_url || undefined,
        ogUrl: `https://tradegunlugu.com/blog/${post.slug}`,
      });
    }
  }, [post]);

  // Generate HTML from Tiptap JSON
  const contentHtml = useMemo(() => {
    if (!post?.content) return '';
    try {
      const html = generateHTML(post.content as Record<string, unknown>, extensions);
      return sanitizeHTML(html);
    } catch {
      return '<p>İçerik yüklenemedi.</p>';
    }
  }, [post?.content]);

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F5F6F7' }}>
        <BlogHeader showBack />
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F5F6F7' }}>
        <BlogHeader showBack />
        <div className="text-center py-20">
          <span className="text-5xl mb-4 block">🔍</span>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Yazı Bulunamadı</h1>
          <p className="text-gray-500 mb-6">Aradığınız blog yazısı mevcut değil veya kaldırılmış.</p>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Blog'a Dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F6F7' }}>
      <BlogHeader showBack />

      <article className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Cover image */}
          {post.cover_image_url && (
            <div className="rounded-xl overflow-hidden mb-8">
              <img
                src={post.cover_image_url}
                alt={post.title}
                className="w-full aspect-video object-cover"
              />
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 leading-tight">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-4 mb-8 text-sm text-gray-500">
            <span>{formatBlogDate(post.published_at || post.created_at)}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {post.reading_time_minutes} dk okuma
            </span>
            <ShareButton title={post.title} slug={post.slug} variant="full" className="text-gray-500 hover:text-gray-700" />
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-sm rounded-full bg-blue-50 text-blue-600 font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Content */}
          <div
            className="blog-post-content prose prose-lg max-w-none"
            style={{ color: '#111' }}
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />

          {/* Bottom share */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <Link
                to="/blog"
                className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Tüm Yazılar
              </Link>
              <ShareButton title={post.title} slug={post.slug} variant="full" className="text-gray-500 hover:text-gray-700" />
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
