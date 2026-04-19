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
    ADD_ATTR: [
      'allow',
      'allowfullscreen',
      'frameborder',
      'src',
      'width',
      'height',
      'style',
    ],
    RETURN_TRUSTED_TYPE: false,
  }) as string;
  return clean.replace(
    /<iframe[^>]*src="(?!https:\/\/(www\.)?youtube\.com)[^"]*"[^>]*><\/iframe>/gi,
    ''
  );
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = useBlogPostBySlug(slug || '');

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
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-200 flex items-center justify-center text-2xl">
            ?
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Yazı bulunamadı
          </h1>
          <p className="text-gray-500 mb-6">
            Aradığınız blog yazısı mevcut değil veya kaldırılmış.
          </p>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Blog'a dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F6F7' }}>
      <BlogHeader showBack />

      <article className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl mx-auto">
          {/* Cover image */}
          {post.cover_image_url && (
            <div className="rounded-2xl overflow-hidden mb-8 shadow-sm">
              <img
                src={post.cover_image_url}
                alt={post.title}
                className="w-full aspect-video object-cover"
              />
            </div>
          )}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 leading-[1.15] tracking-tight mb-5">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-10 pb-6 border-b border-gray-200 text-sm text-gray-500">
            <span>
              {formatBlogDate(post.published_at || post.created_at)}
            </span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {post.reading_time_minutes} dk okuma
            </span>
            <span className="ml-auto">
              <ShareButton
                title={post.title}
                slug={post.slug}
                variant="full"
                className="text-gray-500 hover:text-gray-700"
              />
            </span>
          </div>

          {/* Content */}
          <div
            className="blog-post-content prose prose-lg max-w-none"
            style={{ color: '#111' }}
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />

          {/* Footer */}
          <div className="mt-14 pt-8 border-t border-gray-200 flex items-center justify-between">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              Tüm yazılar
            </Link>
            <ShareButton
              title={post.title}
              slug={post.slug}
              variant="full"
              className="text-gray-500 hover:text-gray-700"
            />
          </div>
        </div>
      </article>
    </div>
  );
}
