import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import callOpenAI from '@/lib/aiProvider';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chapterNumber, lang } = body;
    if (!chapterNumber) {
      return NextResponse.json({ error: 'Missing chapterNumber' }, { status: 400 });
    }
    // Load the plan and config
    const planPath = path.join(process.cwd(), 'data', 'book-plan.json');
    const configPath = path.join(process.cwd(), 'data', 'book-config.json');
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    // Find the chapter
    let chapter = null;
    for (const part of plan.parts) {
      chapter = part.chapters.find((c: any) => c.chapter_number === chapterNumber);
      if (chapter) break;
    }
    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }
    // Build the prompt
    const systemPrompt = `You are an expert assistant in narrative breakdown. You must break down a novel chapter into several coherent scenes, taking the time to unfold the story. Also add transition scenes whose goal is to better describe the characters or places, even if they do not directly advance the plot. Your response must be a JSON array of strings, each string being a scene or key moment of the chapter. Do not add any text or comment outside the array.`;
    const userPrompt = `Voici le plan du livre :\n${JSON.stringify(plan, null, 2)}\n\nVoici la configuration :\n${JSON.stringify(config, null, 2)}\n\nVoici le texte du chapitre à découper :\n${chapter.story}`;
    // Appel OpenAI
    const response = await callOpenAI(systemPrompt, userPrompt, { responseFormat: { type: 'json_object' } });
    let scenes = response;
    if (!Array.isArray(scenes) && response && typeof response === 'object' && Array.isArray(response.scenes)) {
      scenes = response.scenes;
    }
    if (!Array.isArray(scenes)) {
      return NextResponse.json({ error: 'OpenAI did not return an array' }, { status: 500 });
    }
    // Save the result
    const sceneDir = path.join(process.cwd(), 'data', 'scene');
    if (!fs.existsSync(sceneDir)) fs.mkdirSync(sceneDir);
    const scenePath = path.join(sceneDir, `chapter_${chapterNumber}.json`);
    fs.writeFileSync(scenePath, JSON.stringify(scenes, null, 2), 'utf-8');
    return NextResponse.json({ scenes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 