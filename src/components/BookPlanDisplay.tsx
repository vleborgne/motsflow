'use client';

import { useEffect, useState, useCallback } from 'react';
import { t } from '@/lib/i18n';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import ChatSidebar from './ChatSidebar';
import dynamic from 'next/dynamic';
import 'easymde/dist/easymde.min.css';
import React, { MutableRefObject } from 'react';

interface BookPlanDisplayProps {
  locale: 'en' | 'fr';
}

// Dynamically import SimpleMDEEditor to avoid SSR issues
const SimpleMDEEditor = dynamic(() => import('react-simplemde-editor'), { ssr: false });

let markdownEditorInstance = 0;
const MarkdownEditor = React.memo(function MarkdownEditor({ initialValue, onSave, locale }: { initialValue: string; onSave: (val: string) => void; locale: 'en' | 'fr' }) {
  const editorRef = React.useRef<MutableRefObject<any> | null>(null);

  const instance = React.useRef(++markdownEditorInstance);
  console.log('[MarkdownEditor] render', {
    time: new Date().toISOString(),
    instance: instance.current,
    initialValue,
  });

  React.useEffect(() => {
    setTimeout(() => {
      if (editorRef.current) {
        (editorRef.current as any).value(initialValue);
      }
    }, 1000);
  }, [initialValue]);

  const handleCancel = () => {
    if (editorRef.current) {
      (editorRef.current as any).value(initialValue);
    }
  };

  return (
    <div>
      <SimpleMDEEditor
        getMdeInstance={instance => {
          (editorRef.current as any) = instance;
        }}
        options={{
          spellChecker: false,
          placeholder: t('bookPlanDisplay.edit', locale),
          status: false,
          autofocus: true,
          autosave: undefined,
        }}
        defaultValue={initialValue}
      />
      <div className="mt-4 flex gap-2">
        <button
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          onClick={() => {
            const value = (editorRef.current as any)?.value();
            onSave(value);
          }}
        >
          {t('bookPlanDisplay.save', locale)}
        </button>
        <button
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          onClick={handleCancel}
        >
          {t('bookPlanDisplay.cancel', locale)}
        </button>
      </div>
    </div>
  );
});

export default function BookPlanDisplay({ locale }: BookPlanDisplayProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatPrompt, setChatPrompt] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    setIsClient(true);
  }, []);

  console.log('[BookPlanDisplay] render', {
    time: new Date().toISOString(),
    locale,
    content,
  });

  const reloadPlan = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/book-plan?format=md`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to fetch book plan');
        }
        return res.text();
      })
      .then(setContent)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [locale]);

  useEffect(() => {
    reloadPlan();
  }, [locale, reloadPlan]);

  const handleSave = React.useCallback(async (val: string) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/book-plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawMarkdown: val }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setContent(val);
      setSaveStatus('success');
    } catch (e) {
      setSaveStatus('error');
    }
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center py-8">
        <CircularProgress />
        <div className="mt-4">{t('bookPlanDisplay.loading', locale)}</div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-4 text-red-500">{t('bookPlanDisplay.error', locale)}: {error}</div>;
  }

  if (!isClient || content === null) {
    return null;
  }

  if (!content.trim()) {
    return <div className="text-center py-4">{t('bookPlanDisplay.noPlan', locale)}</div>;
  }

  return (
    <Box
      className="flex flex-col md:flex-row my-8 bg-white rounded shadow overflow-auto"
      sx={{ minHeight: 400 }}
      style={{ position: 'relative' }}
    >
      <div
        className="prose prose-lg flex-1 p-6"
        style={{ minWidth: 0 }}
      >
        <MarkdownEditor
          key={content}
          initialValue={content}
          onSave={handleSave}
          locale={locale}
        />
        {saveStatus === 'saving' && <div className="text-blue-600 mt-2">Sauvegarde en cours...</div>}
        {saveStatus === 'success' && <div className="text-green-600 mt-2">Plan sauvegardé !</div>}
        {saveStatus === 'error' && <div className="text-red-600 mt-2">Erreur lors de la sauvegarde.</div>}
      </div>
      <Box
        className="border-l border-gray-200 p-4 bg-gray-50"
        sx={{ width: { xs: '100%', md: 320 }, minHeight: 400 }}
      >
        <ChatSidebar locale={locale} prompt={chatPrompt} setPrompt={setChatPrompt} onPlanUpdated={reloadPlan} />
      </Box>
    </Box>
  );
} 