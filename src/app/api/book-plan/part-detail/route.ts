import { NextResponse } from 'next/server';
import { partDetailAgent, reviewerAgent, chapterListAgent, chapterDetailAgent, mdToJsonAgent } from '@/lib/agents';
import { getBookPlan } from '@/lib/fileStorage';
import fs from 'fs';
import path from 'path';

function extractPartNumber(partTitle: string): string {
  // Extracts the Roman numeral or number before the first dot (e.g., 'I' from 'I. Setup')
  const match = partTitle.match(/^([IVXLCDM0-9]+)\s*\./i);
  return match ? match[1] : partTitle.replace(/\W+/g, '_');
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const partNumber = url.searchParams.get('partNumber');
  if (!partNumber) {
    return new NextResponse('Missing partNumber', { status: 400 });
  }
  const filePath = path.join(process.cwd(), 'data', 'parts', `part_${partNumber}.md`);
  if (!fs.existsSync(filePath)) {
    return new NextResponse('Not found', { status: 404 });
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return new NextResponse(content, {
    status: 200,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Received part-detail POST request`);
  try {
    const body = await request.json();
    const { partNumber } = body;
    console.log(`[${requestId}] Received partNumber:`, partNumber);
    if (!partNumber) {
      console.error(`[${requestId}] Missing partNumber in request body`);
      return NextResponse.json({ error: 'Missing partNumber' }, { status: 400 });
    }
    // 1. Extract the part's Markdown from book-plan.md
    const bookPlanPath = path.join(process.cwd(), 'data', 'book-plan.md');
    console.log(`[${requestId}] Reading book plan from:`, bookPlanPath);
    const bookPlanContent = fs.readFileSync(bookPlanPath, 'utf-8');
    // Find the section for the requested part
    const partRegex = new RegExp(`^#\\s*${partNumber}\\b[^\\n]*\\n([\\s\\S]*?)(?=^#\\s*[IVXLCDM0-9]+\\b|\\Z)`, 'm');    const match = bookPlanContent.match(partRegex);
    console.log(`[${requestId}] Regex match result:`, match ? 'FOUND' : 'NOT FOUND');
    if (!match) {
      console.error(`[${requestId}] Part ${partNumber} not found in book-plan.md`);
      return NextResponse.json({ error: `Part ${partNumber} not found in book-plan.md` }, { status: 404 });
    }
    const partMarkdown = `# ${partNumber}${match[0].split('\n')[0].slice(2)}\n${match[1]}`;
    console.log(`[${requestId}] Extracted partMarkdown (first 200 chars):`, partMarkdown.slice(0, 200));
    // 2. Use chapterListAgent to get the chapter list as JSON
    const chapterListPrompt = [
      `Titre de la partie : ${partNumber}\n\nPlan général :\n${partMarkdown}`
    ];
    const chapterListResult = await chapterListAgent.submitQuery(chapterListPrompt) as { chapters: { title: string, description: string }[] };
    console.log(`[${requestId}] chapterListAgent result:`, JSON.stringify(chapterListResult).slice(0, 200));
    if (!chapterListResult || !Array.isArray(chapterListResult.chapters)) {
      console.error(`[${requestId}] Failed to extract chapters from part`);
      return NextResponse.json({ error: 'Failed to extract chapters from part' }, { status: 500 });
    }
    // 3. For each chapter, generate a list of scenes in Markdown and save to a file
    const dirPath = path.join(process.cwd(), 'data', 'parts');
    console.log(`[${requestId}] Parts directory:`, dirPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`[${requestId}] Created directory: ${dirPath}`);
    }
    const chaptersWithSceneFiles: { title: string; description: string; scenesFile: string }[] = [];
    for (let i = 0; i < chapterListResult.chapters.length; i++) {
      const chapter = chapterListResult.chapters[i];
      const chapterTitle: string = chapter.title;
      const chapterDesc: string = chapter.description;
      const chapterDetailPrompt = [
        `Titre du chapitre : ${chapterTitle}\nDescription : ${chapterDesc}\n\nChapitres de la partie :\n${chapterListResult.chapters.map((c, idx) => `- ${c.title}: ${c.description}`).join('\n')}`
      ];
      console.log(`[${requestId}] Generating scenes for chapter ${i + 1}:`, chapterTitle);
      const chapterDetailMd = await chapterDetailAgent.submitQuery(chapterDetailPrompt);
      const chapterFile = `part_${partNumber}_chapter_${i + 1}.md`;
      const chapterFilePath = path.join(dirPath, chapterFile);
      fs.writeFileSync(chapterFilePath, String(chapterDetailMd), 'utf-8');
      console.log(`[${requestId}] Saved scenes Markdown to:`, chapterFilePath);
      chaptersWithSceneFiles.push({
        title: chapterTitle,
        description: chapterDesc,
        scenesFile: chapterFile
      });
    }
    console.log(`[${requestId}] Successfully generated chapters and scenes.`);
    return NextResponse.json({ chapters: chaptersWithSceneFiles });
  } catch (error) {
    console.error(`[${requestId}] Error in part-detail:`, error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate part detail' }, { status: 500 });
  }
}
