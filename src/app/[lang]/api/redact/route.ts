import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { agentWorkflow } from '@/lib/agentWorkflow';
import callOpenAI from '@/lib/aiProvider';

export async function POST(request: Request) {
  try {
    console.log('[redact] Incoming request');
    const body = await request.json();
    const { chapterNumber, lang } = body;
    console.log(`[redact] chapterNumber: ${chapterNumber}, lang: ${lang}`);
    if (!chapterNumber) {
      console.log('[redact] Missing chapterNumber');
      return NextResponse.json({ error: 'Missing chapterNumber' }, { status: 400 });
    }
    // Load the book plan and config
    const planPath = path.join(process.cwd(), 'data', 'book-plan.md');
    const configPath = path.join(process.cwd(), 'data', 'book-config.json');
    console.log(`[redact] Loading plan from: ${planPath}`);
    console.log(`[redact] Loading config from: ${configPath}`);
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    // Find the chapter
    let chapter = null;
    for (const part of plan.parts) {
      chapter = part.chapters.find((c: any) => c.chapter_number === chapterNumber);
      if (chapter) break;
    }
    if (!chapter) {
      console.log('[redact] Chapter not found');
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }
    // Load scenes for the chapter
    const scenePath = path.join(process.cwd(), 'data', 'scene', `chapter_${chapterNumber}.json`);
    console.log(`[redact] Loading scenes from: ${scenePath}`);
    if (!fs.existsSync(scenePath)) {
      console.log('[redact] Scenes not found for this chapter');
      return NextResponse.json({ error: 'Scenes not found for this chapter' }, { status: 404 });
    }
    const scenes = JSON.parse(fs.readFileSync(scenePath, 'utf-8'));
    if (!Array.isArray(scenes) || scenes.length === 0) {
      console.log('[redact] No scenes to redact');
      return NextResponse.json({ error: 'No scenes to redact' }, { status: 400 });
    }
    // Redact each scene
    let redactions: string[] = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const writingStyle = config.writingStyle ? `Le style d'écriture doit être cohérent avec la consigne suivante : « ${config.writingStyle} ».` : '';
      console.log(`[redact] Redacting scene ${i + 1}/${scenes.length}`);
      const redactRes = await callOpenAI(
        `Tu es un écrivain professionnel. Rédige UNIQUEMENT la scène ci-dessous en français, de façon littéraire, en t'inspirant du plan général du livre, de la configuration, et du descriptif complet du chapitre. ${writingStyle}\nNE FAIS AUCUNE RÉFÉRENCE AUX AUTRES SCÈNES, NE FAIS PAS DE LIEN AVEC D'AUTRES SCÈNES, NE RÉSUME PAS LE CHAPITRE, NE FAIS PAS DE CONCLUSION.\nLa scène doit faire entre 2000 et 3000 caractères. Pas moins ni plus.\nTa rédaction doit concerner uniquement la scène à rédiger, pas d'autre texte qui seront rédigés dans d'autres prompts.\n\nPlan du livre :\n${JSON.stringify(plan, null, 2)}\n\nConfiguration :\n${JSON.stringify(config, null, 2)}\n\nDescriptif du chapitre :\n${JSON.stringify(chapter, null, 2)}\n\nSCÈNE À RÉDIGER (rédige uniquement ce qui suit) :\n${scene}`,
        "",
        {
          responseFormat: { type: 'text' },
          agentId: process.env.MISTRAL_AGENT_ID_REDACTEUR
        }
      );
      console.log(`[redact] Scene ${i + 1} redacted, length: ${redactRes?.length}`);
      redactions.push(`--- Scène ${i + 1} ---\n${redactRes}\n`);
    }
    // AI review step: remove repetitions and unify style
    const fullText = redactions.join('\n\n');
    console.log('[redact] fullText before review', fullText);
    console.log('[redact] Calling AI for review of all scenes');
    const reviewedText = await callOpenAI(
      `Tu es un relecteur professionnel. Relis le texte suivant (plusieurs scènes d'un chapitre d'un roman en français) et créé un prompt pour le redacteur pour qu'il puisse corriger`,
      fullText,
      {
        responseFormat: { type: 'text' },
        agentId: process.env.MISTRAL_AGENT_ID_RELECTEUR
      }
    );
    console.log('[redact] Review completed, length:', reviewedText?.length);
    // Save all redactions in a single .txt file
    const redactionDir = path.join(process.cwd(), 'data', 'redaction');
    if (!fs.existsSync(redactionDir)) fs.mkdirSync(redactionDir);
    const redactionPath = path.join(redactionDir, `chapter_${chapterNumber}.txt`);
    fs.writeFileSync(redactionPath, reviewedText, 'utf-8');
    console.log(`[redact] Redaction saved to: ${redactionPath}`);
    return NextResponse.json({ success: true, file: `data/redaction/chapter_${chapterNumber}.txt` });
  } catch (error) {
    console.error('[redact] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 