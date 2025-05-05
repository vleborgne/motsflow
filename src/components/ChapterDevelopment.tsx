import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, TextField, Button, List, ListItem, ListItemText, ListItemSecondaryAction, IconButton, Paper, Popover, ListSubheader } from '@mui/material';
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided } from 'react-beautiful-dnd';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';

interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  content: string;
  order: number;
  narrative_goal?: string;
  characters?: string[];
  narrative_element?: string;
}

const ChapterDevelopment: React.FC = () => {
  const { t } = useTranslation();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [newChapter, setNewChapter] = useState({ title: '', content: '' });
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [scenes, setScenes] = useState<any[]>([]);
  const [scenesLoading, setScenesLoading] = useState(false);
  const [scenesError, setScenesError] = useState<string | null>(null);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);

  useEffect(() => {
    // Load chapters from the book plan
    const loadChapters = async () => {
      try {
        const response = await fetch('/api/book-plan');
        const data = await response.json();
        if (data.parts) {
          const allChapters = data.parts.flatMap((part: any) => 
            part.chapters.map((chapter: any) => ({
              id: `chapter_${chapter.chapter_number}`,
              chapter_number: chapter.chapter_number,
              title: chapter.title,
              content: chapter.story,
              order: chapter.chapter_number,
              narrative_goal: chapter.narrative_goal,
              characters: chapter.characters,
              narrative_element: chapter.narrative_element
            }))
          );
          setChapters(allChapters);
        }
      } catch (error) {
        console.error('Error loading chapters:', error);
      }
    };

    loadChapters();
  }, []);

  const handleAddChapter = () => {
    if (newChapter.title.trim() && newChapter.content.trim()) {
      const chapter: Chapter = {
        id: `chapter_${Date.now()}`,
        chapter_number: chapters.length + 1,
        title: newChapter.title,
        content: newChapter.content,
        order: chapters.length + 1,
      };
      setChapters([...chapters, chapter]);
      setNewChapter({ title: '', content: '' });
    }
  };

  const handleDeleteChapter = (id: string) => {
    setChapters(chapters.filter(chapter => chapter.id !== id));
  };

  const handleEditChapter = (chapter: Chapter) => {
    setEditingChapter(chapter);
    setNewChapter({ title: chapter.title, content: chapter.content });
  };

  const handleUpdateChapter = () => {
    if (editingChapter && newChapter.title.trim() && newChapter.content.trim()) {
      setChapters(chapters.map(chapter =>
        chapter.id === editingChapter.id
          ? { ...chapter, title: newChapter.title, content: newChapter.content }
          : chapter
      ));
      setEditingChapter(null);
      setNewChapter({ title: '', content: '' });
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(chapters);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setChapters(items.map((item, index) => ({ ...item, order: index + 1 })));
  };

  const handleOpenScenes = async (event: React.MouseEvent<HTMLElement>, chapter: Chapter) => {
    setAnchorEl(event.currentTarget);
    setCurrentChapter(chapter);
    setScenesLoading(true);
    setScenesError(null);
    try {
      const response = await fetch(`/data/subparts/chapter_${chapter.chapter_number}.json`);
      if (!response.ok) throw new Error('No scenes found for this chapter.');
      const data = await response.json();
      setScenes(data.scenes || []);
    } catch (err: any) {
      setScenes([]);
      setScenesError(err.message);
    } finally {
      setScenesLoading(false);
    }
  };

  const handleCloseScenes = () => {
    setAnchorEl(null);
    setScenes([]);
    setCurrentChapter(null);
    setScenesError(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t('chapterDevelopment.title')}
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          label={t('chapterDevelopment.chapterTitle')}
          value={newChapter.title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewChapter({ ...newChapter, title: e.target.value })}
          margin="normal"
        />
        <TextField
          fullWidth
          label={t('chapterDevelopment.chapterContent')}
          value={newChapter.content}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewChapter({ ...newChapter, content: e.target.value })}
          margin="normal"
          multiline
          rows={4}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={editingChapter ? handleUpdateChapter : handleAddChapter}
          sx={{ mt: 2 }}
        >
          {editingChapter ? t('chapterDevelopment.updateChapter') : t('chapterDevelopment.addChapter')}
        </Button>
        {editingChapter && (
          <Button
            variant="outlined"
            onClick={() => {
              setEditingChapter(null);
              setNewChapter({ title: '', content: '' });
            }}
            sx={{ mt: 2, ml: 2 }}
          >
            {t('chapterDevelopment.cancel')}
          </Button>
        )}
      </Paper>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="chapters">
          {(provided: DroppableProvided) => (
            <List {...provided.droppableProps} ref={provided.innerRef}>
              {chapters.map((chapter, index) => (
                <Draggable key={chapter.id} draggableId={chapter.id} index={index}>
                  {(provided: DraggableProvided) => (
                    <ListItem
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      component={Paper}
                      sx={{ mb: 1 }}
                    >
                      <ListItemText
                        primary={`${chapter.chapter_number}. ${chapter.title}`}
                        secondary={
                          <div>
                            <div>{chapter.content}</div>
                            {chapter.narrative_goal && (
                              <div className="mt-2 text-sm text-gray-500">
                                <strong>Objectif narratif:</strong> {chapter.narrative_goal}
                              </div>
                            )}
                            {chapter.narrative_element && (
                              <div className="text-sm text-gray-500">
                                <strong>Élément narratif:</strong> {chapter.narrative_element}
                              </div>
                            )}
                          </div>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          aria-label="edit"
                          onClick={() => handleEditChapter(chapter)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleDeleteChapter(chapter.id)}
                        >
                          <DeleteIcon />
                        </IconButton>
                        <Button
                          variant="outlined"
                          size="small"
                          sx={{ ml: 1 }}
                          onClick={(e) => handleOpenScenes(e, chapter)}
                        >
                          Voir les scènes
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </List>
          )}
        </Droppable>
      </DragDropContext>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleCloseScenes}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, minWidth: 300 }}>
          <Typography variant="h6" gutterBottom>
            {currentChapter ? `Scènes du chapitre ${currentChapter.chapter_number}` : 'Scènes'}
          </Typography>
          {scenesLoading && <Typography>Chargement...</Typography>}
          {scenesError && <Typography color="error">{scenesError}</Typography>}
          {!scenesLoading && !scenesError && scenes.length === 0 && (
            <Typography>Aucune scène trouvée.</Typography>
          )}
          <List
            subheader={
              <ListSubheader component="div" id="nested-list-subheader">
                Liste des scènes
              </ListSubheader>
            }
          >
            {scenes.map((scene, idx) => (
              <ListItem key={idx} alignItems="flex-start">
                <ListItemText
                  primary={scene.title || `Scène ${idx + 1}`}
                  secondary={scene.description || ''}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Popover>
    </Box>
  );
};

export default ChapterDevelopment; 