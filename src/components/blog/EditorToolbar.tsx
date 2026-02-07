import { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code2,
  AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Image as ImageIcon, Youtube,
  Undo, Redo, Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface EditorToolbarProps {
  editor: Editor;
  onImageUpload: (file: File) => Promise<string>;
}

function ToolbarButton({
  onClick,
  isActive = false,
  title,
  children,
  disabled = false,
}: {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'h-8 w-8',
        isActive && 'bg-primary/20 text-primary'
      )}
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-label={title}
    >
      {children}
    </Button>
  );
}

export function EditorToolbar({ editor, onImageUpload }: EditorToolbarProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [colorValue, setColorValue] = useState('#111111');

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await onImageUpload(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      console.error('Image upload failed:', err);
    }
    // Reset input
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const addLink = () => {
    const url = window.prompt('Link URL:');
    if (!url) return;
    editor.chain().focus().setLink({ href: url }).run();
  };

  const addYoutube = () => {
    const url = window.prompt('YouTube video URL:');
    if (!url) return;
    // Validate YouTube URL
    if (!url.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/)) {
      alert('Geçersiz YouTube URL\'si');
      return;
    }
    editor.commands.setYoutubeVideo({ src: url });
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setColorValue(color);
    editor.chain().focus().setColor(color).run();
  };

  return (
    <div className="border-b border-border bg-muted/30 p-1 flex flex-wrap gap-0.5 items-center">
      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="Başlık 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Başlık 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="Başlık 3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Kalın"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="İtalik"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Altı Çizili"
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Üstü Çizili"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Lists & Block */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Madde Listesi"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numaralı Liste"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Alıntı"
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title="Kod Bloğu"
      >
        <Code2 className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title="Sola Hizala"
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title="Ortala"
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title="Sağa Hizala"
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Link & Media */}
      <ToolbarButton
        onClick={addLink}
        isActive={editor.isActive('link')}
        title="Link Ekle"
      >
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => imageInputRef.current?.click()}
        title="Görsel Ekle"
      >
        <ImageIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={addYoutube}
        title="YouTube Video Ekle"
      >
        <Youtube className="h-4 w-4" />
      </ToolbarButton>

      {/* Hidden file input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleImageSelect}
      />

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Color picker */}
      <div className="relative">
        <ToolbarButton onClick={() => {}} title="Yazı Rengi">
          <Palette className="h-4 w-4" style={{ color: colorValue }} />
        </ToolbarButton>
        <input
          type="color"
          value={colorValue}
          onChange={handleColorChange}
          className="absolute inset-0 opacity-0 cursor-pointer w-8 h-8"
          title="Yazı Rengi"
        />
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Undo / Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Geri Al"
      >
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="İleri Al"
      >
        <Redo className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}
