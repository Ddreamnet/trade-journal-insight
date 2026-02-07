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
    <article className="group relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 border border-gray-100">
      {/* Cover Image */}
      <Link to={`/blog/${post.slug}`}>
        <div className="aspect-video overflow-hidden bg-gray-100">
          {post.cover_image_url ? (
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <span className="text-4xl">📝</span>
            </div>
          )}
        </div>
      </Link>

      {/* Share button */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ShareButton
          title={post.title}
          slug={post.slug}
          className="bg-white/90 hover:bg-white shadow-sm text-gray-700 hover:text-gray-900 h-8 w-8"
        />
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <Link to={`/blog/${post.slug}`}>
          <h2 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
            {post.title}
          </h2>
        </Link>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {post.excerpt}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{formatBlogDate(post.published_at || post.created_at)}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {post.reading_time_minutes} dk
          </span>
        </div>
      </div>
    </article>
  );
}
