import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { agentWorkflow } from '@/lib/agentWorkflow';
import { redacteurSystemPrompt, transformateurSystemPrompt } from '@/lib/scenePrompts';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chapterNumber, lang } = body;
    if (!chapterNumber) {
      return NextResponse.json({ scenes: [] }, { status: 400 });
    }
    // Load the book plan and config
    const planPath = path.join(process.cwd(), 'data', 'book-plan.md');
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
      return NextResponse.json({ scenes: [] }, { status: 404 });
    }
    // Use the two-agent workflow utility
    const scenesRaw = await agentWorkflow<string>({
      redacteur: {
        systemPrompt: redacteurSystemPrompt,
        userPrompt: `Voici le plan du livre :\n${JSON.stringify(plan, null, 2)}\n\nVoici la configuration :\n${JSON.stringify(config, null, 2)}\n\nVoici le texte du chapitre à découper :\n${chapter.story}`,
        responseFormat: 'text'
      },
      transformateur: {
        systemPrompt: transformateurSystemPrompt,
        userPromptTemplate: (raw) => `Réponse à transformer :\n${raw}`,
        responseFormat: 'json_object'
      }
    });

    let scenes;
    if (typeof scenesRaw === 'string') {
      try {
        scenes = JSON.parse(scenesRaw);
      } catch (e) {
        return NextResponse.json({ scenes: [] }, { status: 500 });
      }
    } else {
      scenes = scenesRaw;
    }

    if (!Array.isArray(scenes)) {
      return NextResponse.json({ scenes: [] }, { status: 500 });
    }
    // Save the result
    const sceneDir = path.join(process.cwd(), 'data', 'scene');
    if (!fs.existsSync(sceneDir)) fs.mkdirSync(sceneDir);
    const scenePath = path.join(sceneDir, `chapter_${chapterNumber}.json`);
    fs.writeFileSync(scenePath, JSON.stringify(scenes, null, 2), 'utf-8');
    return NextResponse.json({ scenes });
  } catch (error) {
    return NextResponse.json({ scenes: [] }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { chapterNumber, lang, prompt } = body;
    if (!chapterNumber) {
      return NextResponse.json({ scenes: [] }, { status: 400 });
    }
    // Load the book plan and config
    const planPath = path.join(process.cwd(), 'data', 'book-plan.md');
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
      return NextResponse.json({ scenes: [] }, { status: 404 });
    }
    // Load current scenes if they exist
    const sceneDir = path.join(process.cwd(), 'data', 'scene');
    const scenePath = path.join(sceneDir, `chapter_${chapterNumber}.json`);
    let currentScenes = null;
    if (fs.existsSync(scenePath)) {
      try {
        currentScenes = JSON.parse(fs.readFileSync(scenePath, 'utf-8'));
      } catch (e) {
        currentScenes = null;
      }
    }
    // Use the two-agent workflow utility
    const scenesRaw = await agentWorkflow<string>({
      redacteur: {
        systemPrompt: redacteurSystemPrompt,
        userPrompt: `Voici le plan du livre (contexte) :\n${JSON.stringify(plan, null, 2)}\n\nConfiguration :\n${JSON.stringify(config, null, 2)}\n\nTexte du chapitre :\n${chapter.story}\n\nScènes actuelles :\n${currentScenes ? JSON.stringify(currentScenes, null, 2) : 'Aucune.'}\n\nObjectif : Modifie UNIQUEMENT la liste des scènes ci-dessus en suivant la consigne utilisateur suivante : ${prompt || 'Aucune.'}`,
        responseFormat: 'text'
      },
      transformateur: {
        systemPrompt: transformateurSystemPrompt,
        userPromptTemplate: (raw) => `Réponse à transformer :\n${raw}`,
        responseFormat: 'json_object'
      }
    });

    let scenes;
    if (typeof scenesRaw === 'string') {
      try {
        scenes = JSON.parse(scenesRaw);
      } catch (e) {
        return NextResponse.json({ scenes: [] }, { status: 500 });
      }
    } else {
      scenes = scenesRaw;
    }

    if (!Array.isArray(scenes)) {
      return NextResponse.json({ scenes: [] }, { status: 500 });
    }
    // Save the result
    if (!fs.existsSync(sceneDir)) fs.mkdirSync(sceneDir);
    fs.writeFileSync(scenePath, JSON.stringify(scenes, null, 2), 'utf-8');
    return NextResponse.json({ scenes });
  } catch (error) {
    return NextResponse.json({ scenes: [] }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { chapterNumber, lang, scenes } = body;
    if (!chapterNumber || !Array.isArray(scenes)) {
      return NextResponse.json({ error: 'Missing chapterNumber or scenes' }, { status: 400 });
    }
    const sceneDir = path.join(process.cwd(), 'data', 'scene');
    const scenePath = path.join(sceneDir, `chapter_${chapterNumber}.json`);
    if (!fs.existsSync(sceneDir)) fs.mkdirSync(sceneDir);
    fs.writeFileSync(scenePath, JSON.stringify(scenes, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const chapterNumber = url.searchParams.get('chapterNumber');
    if (!chapterNumber) {
      return NextResponse.json({ error: 'Missing chapterNumber' }, { status: 400 });
    }
    const scenePath = path.join(process.cwd(), 'data', 'scene', `chapter_${chapterNumber}.json`);
    if (!fs.existsSync(scenePath)) {
      return NextResponse.json({ error: 'Scenes not found' }, { status: 404 });
    }
    const scenes = JSON.parse(fs.readFileSync(scenePath, 'utf-8'));
    return NextResponse.json({ scenes });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 