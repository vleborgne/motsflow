import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { sceneWriterAgent, chapterReviewAgent, mdToJsonAgent, completeChapterReviewerAgent } from '@/lib/agents';

const BOOK_PLAN_PATH = path.join(process.cwd(), 'data', 'book-plan.md');
const PARTS_DIR = path.join(process.cwd(), 'data', 'parts');
const REDACT_DIR = path.join(process.cwd(), 'data', 'redact');

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Received chapter redaction POST request (scene-by-scene)`);
  try {
    const body = await request.json();
    const { partNumber, chapterNumberToRedact } = body; // e.g., partNumber: "I", chapterNumberToRedact: "I.1"
    console.log(`[${requestId}] Request body:`, { partNumber, chapterNumberToRedact });

    if (!partNumber || !chapterNumberToRedact) {
      console.error(`[${requestId}] Missing partNumber or chapterNumberToRedact`);
      return NextResponse.json({ success: false, error: 'Missing partNumber or chapterNumberToRedact' }, { status: 400 });
    }

    // 1. Load general book plan
    if (!fs.existsSync(BOOK_PLAN_PATH)) {
      console.error(`[${requestId}] Book plan not found at`, BOOK_PLAN_PATH);
      return NextResponse.json({ success: false, error: 'Book plan not found' }, { status: 404 });
    }
    const bookPlan = fs.readFileSync(BOOK_PLAN_PATH, 'utf-8');
    console.log(`[${requestId}] Loaded book plan, length: ${bookPlan.length}`);

    // 2. Load part detail
    const partDetailPath = path.join(PARTS_DIR, `part_${partNumber}.md`);
    if (!fs.existsSync(partDetailPath)) {
      console.error(`[${requestId}] Part detail not found at`, partDetailPath);
      return NextResponse.json({ success: false, error: `Part detail for part ${partNumber} not found` }, { status: 404 });
    }
    const partDetail = fs.readFileSync(partDetailPath, 'utf-8');
    console.log(`[${requestId}] Loaded part detail for part ${partNumber}, length: ${partDetail.length}`);

    // 3. Parse part detail markdown to JSON using mdToJsonAgent
    console.log(`[${requestId}] Calling mdToJsonAgent to parse part detail...`);
    const mdJson = await mdToJsonAgent.submitQuery([partDetail]);
    let partJson;
    try {
      partJson = typeof mdJson === 'string' ? JSON.parse(mdJson) : mdJson;
    } catch (e) {
      console.error(`[${requestId}] Failed to parse mdToJsonAgent result`, mdJson);
      return NextResponse.json({ success: false, error: 'Failed to parse part detail as JSON' }, { status: 500 });
    }
    if (!partJson || !partJson.part || !Array.isArray(partJson.part.chapters)) {
      console.error(`[${requestId}] Invalid JSON structure from mdToJsonAgent`, partJson);
      return NextResponse.json({ success: false, error: 'Invalid JSON structure from part detail' }, { status: 500 });
    }

    // 4. Find the chapter to redact
    const chapter = partJson.part.chapters.find((ch: any, idx: number) => {
      // Try to match chapter number (e.g. "I.1") in the first scene number or in infos
      if (Array.isArray(ch.scenes) && ch.scenes.length > 0) {
        if (ch.scenes[0].number && ch.scenes[0].number.startsWith(chapterNumberToRedact)) return true;
      }
      // Fallback: check if chapterNumberToRedact is in any info string
      if (Array.isArray(ch.infos) && ch.infos.some((info: any) => info.includes(chapterNumberToRedact))) return true;
      return false;
    });
    if (!chapter) {
      console.error(`[${requestId}] Chapter ${chapterNumberToRedact} not found in JSON part detail`);
      return NextResponse.json({ success: false, error: `Chapter ${chapterNumberToRedact} not found in part ${partNumber}` }, { status: 404 });
    }
    const chapterTitle = chapter.infos && chapter.infos.length > 0 ? chapter.infos[0] : chapterNumberToRedact;
    const scenesToRedact = Array.isArray(chapter.scenes) ? chapter.scenes : [];
    if (scenesToRedact.length === 0) {
      console.error(`[${requestId}] No scenes found for chapter ${chapterNumberToRedact} in part ${partNumber}`);
      return NextResponse.json({ success: false, error: `No scenes found for chapter ${chapterNumberToRedact}` }, { status: 404 });
    }
    console.log(`[${requestId}] Chapter ${chapterNumberToRedact}: "${chapterTitle}". Found ${scenesToRedact.length} scenes.`);

    let fullChapterText = `## ${chapterNumberToRedact} ${chapterTitle}\n\n`;
    let previousScenesText = '';

    // 5. Iterate through scenes and redact them one by one
    for (let i = 0; i < scenesToRedact.length; i++) {
      const scene = scenesToRedact[i];
      console.log(`[${requestId}] Processing Scene ${i + 1}/${scenesToRedact.length}: ${scene.number} - ${scene.title}`);

      // a. Write initial scene
      const sceneWritePrompt = [
        `Contexte général du livre (plan global) :\n${bookPlan}\n\nContexte de la partie en cours (détail de la partie) :\n${partDetail}\n\nScènes précédentes de ce chapitre déjà rédigées :\n${previousScenesText || 'Aucune'}\n\nInformations sur le chapitre actuel :\nNuméro : ${chapterNumberToRedact}\nTitre : ${chapterTitle}\n\nTu dois maintenant rédiger la scène suivante de ce chapitre :\nNuméro de scène : ${scene.number}\nTitre de scène : ${scene.title}\n\nRédige UNIQUEMENT le texte de cette scène (entre 1000 et 1500 caractères). Respecte le style et la cohérence de l'histoire. Assure-toi que la scène a un début accrocheur, un développement logique, et une fin marquante.`
      ];
      console.log(`[${requestId}] Calling sceneWriterAgent for scene ${scene.number}...`);
      let currentSceneText = await sceneWriterAgent.submitQuery(sceneWritePrompt);
      console.log(`[${requestId}] sceneWriterAgent response for ${scene.number} (first 200 chars): ${currentSceneText.slice(0, 200)}...`);

      // b. Review the newly written scene
      const sceneReviewPrompt = [
        `Contexte général du livre (plan global) :\n${bookPlan}\n\nContexte de la partie en cours (détail de la partie) :\n${partDetail}\n\nScènes précédentes de ce chapitre déjà rédigées :\n${previousScenesText || 'Aucune'}\n\nVoici la NOUVELLE scène qui vient d'être rédigée pour le chapitre ${chapterNumberToRedact} (intitulé "${chapterTitle}"), scène ${scene.number} ("${scene.title}") :\n${currentSceneText}\n\nTA TÂCHE SPÉCIFIQUE : Analyse UNIQUEMENT cette NOUVELLE scène. Vérifie sa cohérence interne, sa cohérence avec les scènes précédentes de ce chapitre, le plan de la partie et le plan général. Détecte les répétitions au sein de cette nouvelle scène ou par rapport aux précédentes. Vérifie si elle respecte les contraintes de style et de narration (début accrocheur, développement logique, fin marquante). Signale tout spoiler d'événements futurs hors de ce chapitre. NE RÉÉVALUE PAS les scènes précédentes. Retourne tes remarques sous forme de liste JSON. Si aucun problème n'est détecté pour CETTE NOUVELLE SCÈNE, retourne une liste JSON vide ([]).`
      ];
      console.log(`[${requestId}] Calling chapterReviewAgent for scene ${scene.number}...`);
      const reviewResult = await chapterReviewAgent.submitQuery(sceneReviewPrompt);
      console.log(`[${requestId}] chapterReviewAgent response for ${scene.number}:`, JSON.stringify(reviewResult, null, 2));

      // c. Correct scene if needed

      console.log(`[${requestId}] Corrections needed for scene ${scene.number}. Sending to sceneWriterAgent for rewrite...`);
      const sceneCorrectionPrompt = [
        `Contexte général du livre (plan global) :\n${bookPlan}\n\nContexte de la partie en cours (détail de la partie) :\n${partDetail}\n\nScènes précédentes de ce chapitre déjà rédigées :\n${previousScenesText || 'Aucune'}\n\nTexte original de la scène ${scene.number} ("${scene.title}") à corriger :\n${currentSceneText}\n\nVoici la liste des problèmes à corriger pour CETTE SCÈNE UNIQUEMENT :\n${JSON.stringify(reviewResult, null, 2)}\n\nMerci de réécrire cette scène en corrigeant uniquement ces points, en respectant une longueur de 1000 à 1500 caractères et les consignes de style. Rédige UNIQUEMENT le texte de la scène corrigée.`
      ];
      currentSceneText = await sceneWriterAgent.submitQuery(sceneCorrectionPrompt);
      console.log(`[${requestId}] sceneWriterAgent rewrite response for ${scene.number} (first 200 chars): ${currentSceneText.slice(0, 200)}...`);

      // d. Append scene to full chapter text and update previous scenes context
      fullChapterText += `### ${scene.number} ${scene.title}\n\n${currentSceneText}\n\n`;
      previousScenesText += `### ${scene.number} ${scene.title}\n\n${currentSceneText}\n\n`;
    }

    // 6. Review the full chapter with the completeChapterReviewerAgent
    console.log(`[${requestId}] Calling completeChapterReviewerAgent to review the full chapter...`);
    const reviewedChapterText = await completeChapterReviewerAgent.submitQuery([fullChapterText]);
    console.log(`[${requestId}] completeChapterReviewerAgent response (first 200 chars): ${typeof reviewedChapterText === 'string' ? reviewedChapterText.slice(0, 200) : ''}...`);

    // 7. Save the reviewed chapter text
    if (!fs.existsSync(REDACT_DIR)) {
      fs.mkdirSync(REDACT_DIR, { recursive: true });
      console.log(`[${requestId}] Created redact directory: ${REDACT_DIR}`);
    }
    const formattedChapterFilename = `chapter_${chapterNumberToRedact.replace(/\./g, '_')}.txt`;
    const filePath = path.join(REDACT_DIR, formattedChapterFilename);
    fs.writeFileSync(filePath, typeof reviewedChapterText === 'string' ? reviewedChapterText : fullChapterText, 'utf-8');
    console.log(`[${requestId}] Saved full chapter ${chapterNumberToRedact} to ${filePath}, length: ${(typeof reviewedChapterText === 'string' ? reviewedChapterText.length : fullChapterText.length)}`);

    // 8. Return the result
    const response = {
      success: true
    };
    console.log(`[${requestId}] Chapter redaction completed. Returning response (text truncated).`);
    return NextResponse.json(response);

  } catch (error) {
    console.error(`[${requestId}] Error in scene-by-scene chapter redaction:`, error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error in chapter redaction' }, { status: 500 });
  }
} 