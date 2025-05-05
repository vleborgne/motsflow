import React, { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Alert from '@mui/material/Alert';
import type { Locale } from '@/lib/i18n';
import type { BookPlan } from './book-plan/types';

interface ChapterScenesDialogProps {
  open: boolean;
  onClose: () => void;
  currentChapter: { chapter_number: number; title: string } | null;
  editPrompt: string;
  setEditPrompt: (v: string) => void;
  editLoading: boolean;
  editSuccess: string | null;
  editError: string | null;
  handleEditScenes: (scenesSetter: (scenes: any[]) => void) => void;
  plan: BookPlan | null;
  t: (key: string, locale?: Locale) => string;
  locale: Locale;
}

const ChapterScenesDialog: React.FC<ChapterScenesDialogProps> = ({
  open,
  onClose,
  currentChapter,
  editPrompt,
  setEditPrompt,
  editLoading,
  editSuccess,
  editError,
  handleEditScenes,
  plan,
  t,
  locale,
}) => {
  const [scenes, setScenes] = useState<any[]>([]);
  const [scenesLoading, setScenesLoading] = useState(false);
  const [scenesError, setScenesError] = useState<string | null>(null);
  const [regenerateAllLoading, setRegenerateAllLoading] = useState(false);
  const [regenerateAllSuccess, setRegenerateAllSuccess] = useState<string | null>(null);
  const [regenerateAllError, setRegenerateAllError] = useState<string | null>(null);

  useEffect(() => {
    console.log('*********', currentChapter?.chapter_number);
    if (!open || !currentChapter || !currentChapter.chapter_number) return;
    if (typeof currentChapter.chapter_number !== 'number' && !String(currentChapter.chapter_number).trim()) return;
    setScenes([]);
    setScenesLoading(true);
    setScenesError(null);
    const url = `/${locale}/api/get-scenes?chapterNumber=${currentChapter.chapter_number}`;
    console.log('FETCH URL:', url);
    fetch(url)
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok && Array.isArray(data.scenes)) {
          setScenes(data.scenes);
        } else {
          setScenes([]);
          setScenesError(data.error || 'Error loading scenes.');
        }
      })
      .catch(() => {
        setScenes([]);
        setScenesError('Error loading scenes.');
      })
      .finally(() => setScenesLoading(false));
  }, [open, currentChapter, locale]);

  const handleRegenerateAllScenes = async () => {
    if (!plan) return;
    setRegenerateAllLoading(true);
    setRegenerateAllSuccess(null);
    setRegenerateAllError(null);
    try {
      const allChapters = plan.parts.flatMap(part => part.chapters);
      for (const chapter of allChapters) {
        const res = await fetch(`/api/generate-scenes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chapterNumber: chapter.chapter_number, lang: locale })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Erreur sur le chapitre ${chapter.chapter_number}`);
        if (currentChapter && chapter.chapter_number === currentChapter.chapter_number) {
          setScenes(data.scenes || []);
        }
      }
      setRegenerateAllSuccess(t('bookPlanDisplay.regenerateAllScenesSuccess', locale));
    } catch (err: any) {
      setRegenerateAllError(err.message || t('bookPlanDisplay.regenerateAllScenesError', locale));
    } finally {
      setRegenerateAllLoading(false);
    }
  };

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <AppBar sx={{ position: 'relative' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
          <h4 style={{ marginLeft: 16 }}>
            {currentChapter
              ? t('bookPlanDisplay.chapterScenesTitle', locale).replace('{num}', currentChapter.chapter_number.toString())
              : t('bookPlanDisplay.scenes', locale)}
          </h4>
        </Toolbar>
      </AppBar>
      <div style={{ padding: 24 }}>
        <textarea
          value={editPrompt}
          onChange={e => setEditPrompt(e.target.value)}
          placeholder={t('bookPlanDisplay.editScenesPlaceholder', locale)}
          rows={2}
          style={{ width: '100%', marginBottom: 8 }}
          disabled={editLoading}
        />
        <Button
          variant="outlined"
          color="primary"
          sx={{ mb: 2, ml: 1 }}
          onClick={() => handleEditScenes(setScenes)}
          disabled={editLoading || !editPrompt.trim()}
        >
          {editLoading ? t('bookPlanDisplay.editingScenes', locale) : t('bookPlanDisplay.editScenes', locale)}
        </Button>
        {editSuccess && <Alert severity="success" sx={{ m: 2 }}>{editSuccess}</Alert>}
        {editError && <Alert severity="error" sx={{ m: 2 }}>{editError}</Alert>}
        <Button
          variant="contained"
          color="secondary"
          sx={{ mb: 2 }}
          disabled={regenerateAllLoading}
          onClick={handleRegenerateAllScenes}
        >
          {regenerateAllLoading ? t('bookPlanDisplay.regeneratingAllScenes', locale) : t('bookPlanDisplay.regenerateAllScenes', locale)}
        </Button>
        {regenerateAllSuccess && <Alert severity="success" sx={{ m: 2 }}>{regenerateAllSuccess}</Alert>}
        {regenerateAllError && <Alert severity="error" sx={{ m: 2 }}>{regenerateAllError}</Alert>}
        <List
          subheader={
            <ListSubheader component="div" id="nested-list-subheader">
              {t('bookPlanDisplay.scenesList', locale)}
            </ListSubheader>
          }
        >
          {scenes.map((scene, idx) => (
            <ListItem key={idx} alignItems="flex-start">
              <ListItemText
                primary={`${t('bookPlanDisplay.scene', locale)} ${idx + 1}`}
                secondary={scene}
              />
            </ListItem>
          ))}
        </List>
        {scenesLoading && <div style={{ marginTop: 16 }}>{t('bookPlanDisplay.loading', locale)}</div>}
        {scenesError && <Alert severity="error" sx={{ m: 2 }}>{scenesError}</Alert>}
      </div>
    </Dialog>
  );
};

export default ChapterScenesDialog; 