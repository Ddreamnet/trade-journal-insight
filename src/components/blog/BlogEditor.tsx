import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useCallback } from 'react';
import { EditorToolbar } from './EditorToolbar';
import type { Json } from '@/integrations/supabase/types';

interface BlogEditorProps {
  content: Json | null;
  onChange: (content: Json) => void;
  onImageUpload: (file: File) => Promise<string>;
}

export function BlogEditor({ content, onChange, onImageUpload }: BlogEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Image.configure({
        HTMLAttributes: { class: 'blog-content-image' },
      }),
      Youtube.configure({
        width: 640,
        height: 360,
        HTMLAttributes: { class: 'blog-youtube-embed' },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Color,
      TextStyle,
      Placeholder.configure({
        placeholder: 'Yazınıza başlayın...',
      }),
    ],
    content: content as Record<string, unknown> || { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: {
      attributes: {
        class: 'blog-editor-content prose prose-sm sm:prose max-w-none focus:outline-none min-h-[300px] px-4 py-3',
        style: 'color: #111;',
      },
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer?.files?.length) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            handleImageDrop(file);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getJSON() as unknown as Json);
    },
  });

  const handleImageDrop = useCallback(async (file: File) => {
    if (!editor) return;
    try {
      const url = await onImageUpload(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      console.error('Image upload failed:', err);
    }
  }, [editor, onImageUpload]);

  // Update editor content when external content changes (e.g., loading saved post)
  useEffect(() => {
    if (editor && content && !editor.isFocused) {
      const currentJson = JSON.stringify(editor.getJSON());
      const newJson = JSON.stringify(content);
      if (currentJson !== newJson) {
        editor.commands.setContent(content as Record<string, unknown>);
      }
    }
  }, [editor, content]);

  if (!editor) return null;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-white">
      <EditorToolbar editor={editor} onImageUpload={onImageUpload} />
      <EditorContent editor={editor} />
    </div>
  );
}
