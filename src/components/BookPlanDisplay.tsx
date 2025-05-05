'use client';

import { useEffect, useState } from 'react';
import { t } from '@/lib/i18n';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import ReactMarkdown from 'react-markdown';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ChatSidebar from './ChatSidebar';

interface BookPlanDisplayProps {
  locale: 'en' | 'fr';
}

export default function BookPlanDisplay({ locale }: BookPlanDisplayProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | { mouseX: number; mouseY: number }>(null);
  const [selectedText, setSelectedText] = useState('');
  const [chatPrompt, setChatPrompt] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/${locale}/api/book-plan?format=md`)
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

  // Helper to get selected text
  const getSelectedText = () => {
    if (typeof window !== 'undefined') {
      return window.getSelection()?.toString() || '';
    }
    return '';
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    const selText = getSelectedText();
    setSelectedText(selText);
    setMenuAnchor({ mouseX: event.clientX - 2, mouseY: event.clientY - 4 });
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
  };

  const handleAddToChat = () => {
    if (selectedText) {
      setChatPrompt(prev => prev + (prev && !prev.endsWith('\n') ? '\n' : '') +
        'Voici un extrait du plan existant :\n```\n' + selectedText + '\n```\nMa demande :\n\n');
    }
    handleCloseMenu();
  };

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

  if (!content) {
    return <div className="text-center py-4">{t('bookPlanDisplay.noPlan', locale)}</div>;
  }

  return (
    <Box
      className="flex flex-col md:flex-row max-w-4xl mx-auto my-8 bg-white rounded shadow overflow-auto"
      sx={{ minHeight: 400 }}
      style={{ position: 'relative' }}
    >
      <div
        className="prose prose-lg flex-1 p-6"
        onContextMenu={handleContextMenu}
        style={{ minWidth: 0 }}
      >
        <ReactMarkdown>{content}</ReactMarkdown>
        <Menu
          open={!!menuAnchor}
          onClose={handleCloseMenu}
          anchorReference="anchorPosition"
          anchorPosition={menuAnchor ? { top: menuAnchor.mouseY, left: menuAnchor.mouseX } : undefined}
          PaperProps={{ style: { minWidth: 120 } }}
        >
          <MenuItem onClick={handleAddToChat} disabled={!selectedText}>{'Ajouter au chat'}</MenuItem>
        </Menu>
      </div>
      <Box
        className="border-l border-gray-200 p-4 bg-gray-50"
        sx={{ width: { xs: '100%', md: 320 }, minHeight: 400 }}
      >
        <ChatSidebar locale={locale} prompt={chatPrompt} setPrompt={setChatPrompt} />
      </Box>
    </Box>
  );
} 