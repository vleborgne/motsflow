import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { sceneWriterAgent, mdToJsonAgent } from '@/lib/agents';
import { generateLongText } from '@/lib/aiProvider';

const BOOK_PLAN_PATH = path.join(process.cwd(), 'data', 'book-plan.md');
const BOOK_CONFIG_PATH = path.join(process.cwd(), 'data', 'book-config.json');
const PARTS_DIR = path.join(process.cwd(), 'data', 'parts');
const REDACT_DIR = path.join(process.cwd(), 'data', 'redact');

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  try {
    const body = await request.json();
    const { partNumber, chapterNumberToRedact } = body;
    if (!partNumber || !chapterNumberToRedact) {
      return NextResponse.json({ success: false, error: 'Missing partNumber or chapterNumberToRedact' }, { status: 400 });
    }

    // 1. Load general book plan
    if (!fs.existsSync(BOOK_PLAN_PATH)) {
      return NextResponse.json({ success: false, error: 'Book plan not found' }, { status: 404 });
    }
    const bookPlan = fs.readFileSync(BOOK_PLAN_PATH, 'utf-8');

    // 2. Load book config
    if (!fs.existsSync(BOOK_CONFIG_PATH)) {
      return NextResponse.json({ success: false, error: 'Book config not found' }, { status: 404 });
    }
    const bookConfig = fs.readFileSync(BOOK_CONFIG_PATH, 'utf-8');

    // 3. Load chapter detail file
    const chapterFilePath = path.join(PARTS_DIR, `part_${partNumber}_chapter_${chapterNumberToRedact.split('.')[1]}.md`);
    if (!fs.existsSync(chapterFilePath)) {
      return NextResponse.json({ success: false, error: `Chapter detail for part ${partNumber} chapter ${chapterNumberToRedact} not found` }, { status: 404 });
    }
    const chapterDetail = fs.readFileSync(chapterFilePath, 'utf-8');

    // 4. Parse scenes from chapter detail using regex
    let scenes = [];
    const sceneRegex = /^###\s+([IVXLCDM0-9\.]+)\s*:\s*(.+)\n([\s\S]*?)(?=^###|$)/gm;
    let match;
    while ((match = sceneRegex.exec(chapterDetail)) !== null) {
      scenes.push({ number: match[1], title: match[2], content: match[3].trim() });
    }

    // If regex parsing fails, fallback to mdToJsonAgent
    if (scenes.length === 0) {
      const mdJsonText = await mdToJsonAgent.submitQuery([chapterDetail], { maxTokens: 4096 });
      let chapterJson;
      try {
        chapterJson = typeof mdJsonText === 'string' ? JSON.parse(mdJsonText) : mdJsonText;
      } catch (e) {
        return NextResponse.json({ success: false, error: 'Failed to parse chapter detail as JSON' }, { status: 500 });
      }
      if (chapterJson && Array.isArray(chapterJson.scenes)) {
        scenes = chapterJson.scenes;
      } else {
        return NextResponse.json({ success: false, error: 'No scenes found in chapter detail' }, { status: 500 });
      }
    }

    if (!fs.existsSync(REDACT_DIR)) {
      fs.mkdirSync(REDACT_DIR, { recursive: true });
    }

    let previousScenesText = '';
    let fullChapterText = '';
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneWritePrompt = [
        `Contexte général du livre (plan global) :\n${bookPlan}\n\nConfiguration du livre :\n${bookConfig}\n\nDétail du chapitre (structure et résumé des scènes) :\n${chapterDetail}\n\nScènes précédentes de ce chapitre déjà rédigées :\n${previousScenesText || 'Aucune'}\n\nINSTRUCTIONS IMPORTANTES : Tu dois rédiger UNIQUEMENT la scène suivante, sans inventer de nouveaux personnages, sans ajouter d'éléments qui ne figurent pas dans le plan, la configuration ou le détail du chapitre. Reste strictement dans l'univers, la continuité et la logique du livre.\n\nInformations sur la scène à rédiger :\nNuméro de scène : ${scene.number}\nTitre de scène : ${scene.title}\nRésumé de la scène (si disponible) : ${scene.content}\n\nRédige UNIQUEMENT le texte de cette scène (entre 1000 et 1500 caractères). N'inclus pas d'autres scènes, ni de texte explicatif, ni de résumé global. Rédige la scène comme elle apparaîtrait dans le livre, en respectant le style, la cohérence et la progression de l'histoire.`
      ];
      let currentSceneText = await sceneWriterAgent.submitQuery(sceneWritePrompt) as string;
      // Save each scene in a separate file
      const sceneFileName = `scene_${partNumber}_${chapterNumberToRedact.replace(/\./g, '_')}_${scene.number.replace(/\./g, '_')}.txt`;
      const sceneFilePath = path.join(REDACT_DIR, sceneFileName);
      fs.writeFileSync(sceneFilePath, currentSceneText, 'utf-8');
      // Append to chapter text
      fullChapterText += `### ${scene.number} ${scene.title}\n\n${currentSceneText}\n\n`;
      previousScenesText += `### ${scene.number} ${scene.title}\n\n${currentSceneText}\n\n`;
    }

    return NextResponse.json({ success: true, text: fullChapterText });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error in chapter redaction' }, { status: 500 });
  }
} 