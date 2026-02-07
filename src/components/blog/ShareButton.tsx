import { useState, useCallback } from 'react';
import { Share2, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';

interface ShareButtonProps {
  title: string;
  slug: string;
  variant?: 'icon' | 'full';
  className?: string;
}

const BASE_URL = 'https://tradegunlugu.com';

export function ShareButton({ title, slug, variant = 'icon', className }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const url = `${BASE_URL}/blog/${slug}`;

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User cancelled or error — fall through to popover
      }
    }
    setIsOpen(true);
  }, [title, url]);

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    toast({ title: 'Link kopyalandı', duration: 2000 });
    setIsOpen(false);
  };

  const shareLinks = [
    {
      name: 'X / Twitter',
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    },
    {
      name: 'WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    },
    {
      name: 'Telegram',
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    },
    {
      name: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    },
  ];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={variant === 'icon' ? 'icon' : 'sm'}
          className={className}
          onClick={handleNativeShare}
          aria-label="Paylaş"
        >
          <Share2 className="h-4 w-4" />
          {variant === 'full' && <span className="ml-2">Paylaş</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="end">
        <button
          onClick={copyLink}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
        >
          <Copy className="h-4 w-4" />
          Linki Kopyala
        </button>
        {shareLinks.map((link) => (
          <a
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <ExternalLink className="h-4 w-4" />
            {link.name}
          </a>
        ))}
      </PopoverContent>
    </Popover>
  );
}
