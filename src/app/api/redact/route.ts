import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { chapterWriterAgent, chapterReviewAgent } from '@/lib/agents';

const BOOK_PLAN_PATH = path.join(process.cwd(), 'data', 'book-plan.md');
const REDACT_DIR = path.join(process.cwd(), 'data', 'redact');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chapterNumber, chapterTitle } = body;
    console.log('[API /api/redact] Received request:', { chapterNumber, chapterTitle });
    if (!chapterNumber || !chapterTitle) {
      console.error('[API /api/redact] Missing chapterNumber or chapterTitle');
      return NextResponse.json({ success: false, error: 'Missing chapterNumber or chapterTitle' }, { status: 400 });
    }

    // 1. Load book-plan.md
    if (!fs.existsSync(BOOK_PLAN_PATH)) {
      console.error('[API /api/redact] Book plan not found at', BOOK_PLAN_PATH);
      return NextResponse.json({ success: false, error: 'Book plan not found' }, { status: 404 });
    }
    const bookPlan = fs.readFileSync(BOOK_PLAN_PATH, 'utf-8');
    console.log('[API /api/redact] Loaded book plan, length:', bookPlan.length);

    // 2. Call chapterWriterAgent to write the chapter
    const userPrompt = `Voici le plan du livre :\n${bookPlan}\n\nRédige uniquement le chapitre suivant :\nNuméro : ${chapterNumber}\nTitre : ${chapterTitle}`;
    console.log('[API /api/redact] Calling chapterWriterAgent with prompt:', userPrompt.slice(0, 500), '...');
    let chapterText = await chapterWriterAgent.submitQuery([userPrompt]);
    console.log('[API /api/redact] chapterWriterAgent response (first 500 chars):', typeof chapterText === 'string' ? chapterText.slice(0, 500) : chapterText);

    // 3. Call chapterReviewAgent to check for spoilers
    const reviewPrompt = `Voici le texte rédigé du chapitre ${chapterNumber} :\n${chapterText}\n\nNuméro : ${chapterNumber}\nTitre : ${chapterTitle}`;
    console.log('[API /api/redact] Calling chapterReviewAgent with prompt:', reviewPrompt.slice(0, 500), '...');
    const reviewResult = await chapterReviewAgent.submitQuery([reviewPrompt]);
    console.log('[API /api/redact] chapterReviewAgent response:', reviewResult);

    // 4. If issues, ask chapterWriterAgent to rewrite
    let finalText = chapterText;
    if (reviewResult) {
      const correctionPrompt = `Voici le plan du livre :\n${bookPlan}\n\nVoici le texte rédigé du chapitre ${chapterNumber} :\n${chapterText}\n\nVoici la liste des problèmes à corriger (ne pas raconter la suite, ne pas faire de spoilers) :\n${JSON.stringify(reviewResult, null, 2)}\nMerci de réécrire ce chapitre en corrigeant uniquement ces points.`;
      console.log('[API /api/redact] Issues found, calling chapterWriterAgent for rewrite with prompt:', correctionPrompt.slice(0, 500), '...');
      finalText = await chapterWriterAgent.submitQuery([correctionPrompt]);
      console.log('[API /api/redact] chapterWriterAgent rewrite response (first 500 chars):', typeof finalText === 'string' ? finalText.slice(0, 500) : finalText);
    } else {
      console.log('[API /api/redact] No issues found by chapterReviewAgent.');
    }

    // 5. Save the final result
    if (!fs.existsSync(REDACT_DIR)) {
      fs.mkdirSync(REDACT_DIR, { recursive: true });
      console.log('[API /api/redact] Created redact directory:', REDACT_DIR);
    }
    const filePath = path.join(REDACT_DIR, `chapter_${chapterNumber}.txt`);
    fs.writeFileSync(filePath, finalText, 'utf-8');
    console.log('[API /api/redact] Saved final chapter to', filePath, 'length:', finalText.length);

    // 6. Return the result
    const response = {
      success: true,
      chapterNumber,
      chapterTitle,
      text: finalText,
      review: reviewResult
    };
    console.log('[API /api/redact] Returning response:', { ...response, text: typeof finalText === 'string' ? finalText.slice(0, 200) + '...' : finalText });
    return NextResponse.json(response);
  } catch (error) {
    console.error('[API /api/redact] Error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 