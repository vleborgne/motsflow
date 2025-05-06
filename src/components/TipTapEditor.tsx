import React, { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import { t } from '@/lib/i18n';

interface TipTapEditorProps {
  value: string;
  onChange: (html: string) => void;
  locale: 'en' | 'fr';
}

const MenuBar = ({ editor, locale }: { editor: any; locale: 'en' | 'fr' }) => {
  if (!editor) return null;
  return (
    <div className="flex flex-wrap gap-1 mb-2 border-b pb-2">
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'font-bold text-blue-600' : ''} type="button"><b>B</b></button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'italic text-blue-600' : ''} type="button"><i>I</i></button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'underline text-blue-600' : ''} type="button">U</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'text-blue-600' : ''} type="button">H1</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'text-blue-600' : ''} type="button">H2</button>
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'text-blue-600' : ''} type="button">• List</button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'text-blue-600' : ''} type="button">1. List</button>
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'text-blue-600' : ''} type="button">“”</button>
      <button onClick={() => editor.chain().focus().setHorizontalRule().run()} type="button">―</button>
      <button onClick={() => editor.chain().focus().undo().run()} type="button">⎌</button>
      <button onClick={() => editor.chain().focus().redo().run()} type="button">⎋</button>
      <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'text-blue-600' : ''} type="button">{t('align.left', locale)}</button>
      <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'text-blue-600' : ''} type="button">{t('align.center', locale)}</button>
      <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={editor.isActive({ textAlign: 'right' }) ? 'text-blue-600' : ''} type="button">{t('align.right', locale)}</button>
    </div>
  );
};

const TipTapEditor: React.FC<TipTapEditorProps> = ({ value, onChange, locale }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'min-h-[300px] p-3 border rounded bg-white',
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false);
    }
  }, [value]);

  return (
    <div>
      <MenuBar editor={editor} locale={locale} />
      <EditorContent editor={editor} />
    </div>
  );
};

export default TipTapEditor; 