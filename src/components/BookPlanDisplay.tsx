'use client';

import { useEffect, useState, useRef } from 'react';
import { t } from '@/lib/i18n';
import BookPlanHeader from './book-plan/BookPlanHeader';
import BookPlanCharacters from './book-plan/BookPlanCharacters';
import { BookPlan } from './book-plan/types';
import Popover from '@mui/material/Popover';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Dialog from '@mui/material/Dialog';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import ChapterScenesDialog from './ChapterScenesDialog';

interface BookPlanDisplayProps {
  locale: 'en' | 'fr';
}

export default function BookPlanDisplay({ locale }: BookPlanDisplayProps) {
  const [plan, setPlan] = useState<BookPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modifyingPlan, setModifyingPlan] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [popoverAnchor, setPopoverAnchor] = useState<null | HTMLElement>(null);
  const [currentChapter, setCurrentChapter] = useState<{chapter_number: number, title: string} | null>(null);
  const [scenesDialogOpen, setScenesDialogOpen] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchPlan = async () => {
    try {
      const response = await fetch(`/${locale}/api/book-plan`);
      if (response.ok) {
        const data = await response.json();
        setPlan(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch plan');
      }
    } catch (error) {
      console.error('Error fetching plan:', error);
      setError('Failed to fetch plan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, [locale, reloadTrigger]);

  const handleUpdate = async (updates: Partial<BookPlan>) => {
    if (!plan) return;

    try {
      // Merge updates with the existing plan
      const updatedPlan = {
        ...plan,
        ...updates,
      };

      const response = await fetch(`/${locale}/api/book-plan`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedPlan),
      });

      if (response.ok) {
        setPlan(updatedPlan);
      } else {
        const errorData = await response.json();
        console.error('Update error:', errorData);
        setError(errorData.error || 'Failed to update plan');
      }
    } catch (error) {
      console.error('Error updating plan:', error);
      setError('Failed to update plan');
    }
  };

  const handleModifyPlan = async (prompt: string) => {
    if (!plan) return;
    
    setModifyingPlan(true);
    try {
      const response = await fetch(`/${locale}/api/book-plan/modify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          lang: locale
        }),
      });

      if (response.ok) {
        setReloadTrigger(prev => prev + 1);
        
        const planResponse = await fetch(`/${locale}/api/book-plan`);
        if (planResponse.ok) {
          const data = await planResponse.json();
          setPlan(data);
        } else {
          const errorData = await planResponse.json();
          setError(errorData.error || 'Failed to reload plan');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to modify plan');
      }
    } catch (error) {
      console.error('Error modifying plan:', error);
      setError('Failed to modify plan');
    } finally {
      setModifyingPlan(false);
    }
  };

  const handleOpenScenes = (_event: React.MouseEvent<HTMLElement>, chapter: {chapter_number: number, title: string}) => {
    setCurrentChapter(chapter);
    setScenesDialogOpen(true);
    setEditPrompt('');
    setEditSuccess(null);
    setEditError(null);
  };

  const handleCloseScenes = () => {
    setScenesDialogOpen(false);
    setCurrentChapter(null);
  };

  if (loading) {
    return <div className="text-center py-4">{t('bookPlanDisplay.loading', locale)}</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-red-500">{error}</div>;
  }

  if (!plan) {
    return <div className="text-center py-4">{t('bookPlanDisplay.noPlan', locale)}</div>;
  }

  return (
    <div className="space-y-8">
      <BookPlanHeader
        title={plan.title}
        genre={plan.genre}
        locale={locale}
        onTitleUpdate={(title) => handleUpdate({ title })}
        onGenreUpdate={(genre) => handleUpdate({ genre })}
        onModifyPlan={handleModifyPlan}
      />

      {modifyingPlan && (
        <div className="text-center text-gray-600">
          {t('bookPlanDisplay.modifyingPlan', locale)}
        </div>
      )}

      <div className="space-y-6">
        {plan.parts.map((part, partIdx) => (
          <div key={partIdx} className="border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">{part.title}</h2>
            <div className="space-y-2">
              {part.chapters.map((chapter, chapIdx) => (
                <div key={chapIdx} className="border-l-4 border-blue-500 pl-4 mb-2">
                  <h3 className="text-lg font-medium">
                    {t('bookPlanDisplay.chapter', locale)} {chapter.chapter_number}: {chapter.title}
                  </h3>
                  <p className="text-gray-600">{t('bookPlanDisplay.narrativeElement', locale)}: {chapter.narrative_element}</p>
                  <p className="text-gray-600">{t('bookPlanDisplay.summary', locale)}: {chapter.summary}</p>
                  <p className="text-gray-600">{chapter.narrative_goal}</p>
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ mt: 1 }}
                    onClick={(e) => handleOpenScenes(e, {chapter_number: chapter.chapter_number, title: chapter.title})}
                  >
                    {t('bookPlanDisplay.viewScenes', locale)}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <BookPlanCharacters
        characters={plan.characters}
        locale={locale}
        onCharacterUpdate={(characterId, updates) => {
          const updatedCharacters = plan.characters.map(char => 
            char.id === characterId ? { ...char, ...updates } : char
          );
          handleUpdate({ characters: updatedCharacters });
        }}
      />

      <ChapterScenesDialog
        open={scenesDialogOpen}
        onClose={handleCloseScenes}
        currentChapter={currentChapter}
        editPrompt={editPrompt}
        setEditPrompt={setEditPrompt}
        editLoading={editLoading}
        editSuccess={editSuccess}
        editError={editError}
        handleEditScenes={(scenesSetter) => {
          if (!currentChapter) return;
          setEditLoading(true);
          setEditSuccess(null);
          setEditError(null);
          fetch(`/api/generate-scenes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapterNumber: currentChapter.chapter_number, lang: locale, prompt: editPrompt })
          })
            .then(res => res.json().then(data => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
              if (!ok) throw new Error(data.error || t('bookPlanDisplay.editScenesError', locale));
              scenesSetter(data.scenes || []);
              setEditSuccess(t('bookPlanDisplay.editScenesSuccess', locale));
            })
            .catch(err => {
              setEditError(err.message || t('bookPlanDisplay.editScenesError', locale));
            })
            .finally(() => setEditLoading(false));
        }}
        plan={plan}
        t={t}
        locale={locale as import('@/lib/i18n').Locale}
      />
    </div>
  );
} 