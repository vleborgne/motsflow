export interface Character {
  id: string;
  name: string;
  description: string;
}

export interface Chapter {
  chapter_number: number;
  title: string;
  narrative_goal: string;
  story: string;
  summary: string;
  characters: string[];
  narrative_element: string;
}

export interface BookPlan {
  title: string;
  genre: string;
  parts: Array<{
    title: string;
    chapters: Chapter[];
  }>;
  characters: Character[];
}

/**
 * Valide qu'un objet correspond au format BookPlan.
 */
export function validateBookPlan(obj: any): obj is BookPlan {
  if (typeof obj !== 'object' || obj === null) return false;
  if (typeof obj.title !== 'string') return false;
  if (typeof obj.genre !== 'string') return false;
  if (!Array.isArray(obj.parts)) return false;
  if (!Array.isArray(obj.characters)) return false;

  // Validate characters
  for (const char of obj.characters) {
    if (typeof char !== 'object' || char === null) return false;
    if (typeof char.id !== 'string') return false;
    if (typeof char.name !== 'string') return false;
    if (typeof char.description !== 'string') return false;
  }

  // Validate parts and chapters
  for (const part of obj.parts) {
    if (typeof part !== 'object' || part === null) return false;
    if (typeof part.title !== 'string') return false;
    if (!Array.isArray(part.chapters)) return false;
    for (const chapter of part.chapters) {
      if (typeof chapter !== 'object' || chapter === null) return false;
      if (typeof chapter.chapter_number !== 'number') return false;
      if (typeof chapter.title !== 'string') return false;
      if (typeof chapter.narrative_goal !== 'string') return false;
      if (typeof chapter.story !== 'string') return false;
      if (typeof chapter.summary !== 'string') return false;
      if (!Array.isArray(chapter.characters)) return false;
      if (typeof chapter.narrative_element !== 'string') return false;
    }
  }

  return true;
}

/**
 * Valide qu'un tableau correspond au format attendu pour les subparts.
 */
export function validateSubparts(arr: any): arr is Array<{id: string, description: string}> {
  if (!Array.isArray(arr)) return false;
  for (const sub of arr) {
    if (typeof sub !== 'object' || sub === null) return false;
    if (typeof sub.id !== 'string') return false;
    if (typeof sub.description !== 'string') return false;
  }
  return true;
} 