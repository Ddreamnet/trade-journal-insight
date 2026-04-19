import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { ShareButton } from './ShareButton';
import { formatBlogDate } from '@/lib/blogUtils';
import type { BlogPost } from '@/types/blog';

interface BlogCardProps {
  post: BlogPost;
}

export function BlogCard({ post }: BlogCardProps) {
  return (
    <article className="group relative bg-white rounded-xl overflow-hidden border border-gray-200/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] hover:border-gray-200 transition-all duration-300 hover:-translate-y-0.5">
      {/* Cover */}
      <Link
        to={`/blog/${post.slug}`}
        aria-label={post.title}
        className="block"
      >
        {post.cover_image_url ? (
          <div className="aspect-video overflow-hidden bg-gray-100">
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="aspect-video overflow-hidden bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center text-3xl text-gray-300">
            ✦
          </div>
        )}
      </Link>

      {/* Share */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ShareButton
          title={post.title}
          slug={post.slug}
          className="bg-white/95 hover:bg-white shadow-sm text-gray-700 hover:text-gray-900 h-8 w-8"
        />
      </div>

      {/* Body */}
      <div className="p-5">
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <Link to={`/blog/${post.slug}`}>
          <h2 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 leading-snug group-hover:text-blue-700 transition-colors">
            {post.title}
          </h2>
        </Link>

        {post.excerpt && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">
            {post.excerpt}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{formatBlogDate(post.published_at || post.created_at)}</span>
          <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {post.reading_time_minutes} dk
          </span>
        </div>
      </div>
    </article>
  );
}
