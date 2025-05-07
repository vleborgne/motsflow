import { NextResponse } from 'next/server';
import { partDetailAgent, reviewerAgent } from '@/lib/agents';
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
    const { partTitle, partSummary } = body;
    console.log(`[${requestId}] Request body:`, JSON.stringify({ partTitle, partSummary }));
    if (!partTitle || !partSummary) {
      console.error(`[${requestId}] Missing required fields`);
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    // Load plan and config in backend
    const plan = getBookPlan();
    const configPath = path.join(process.cwd(), 'data', 'book-config.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    console.log(`[${requestId}] Loaded plan and config from backend.`);

    const prompt = [
      `Titre de la partie : ${partTitle}\nRésumé : ${partSummary}\n\nPlan général :\n${typeof plan === 'string' ? plan : JSON.stringify(plan, null, 2)}\n\nConfiguration :\n${typeof config === 'string' ? config : JSON.stringify(config, null, 2)}\n\nGénère le plan détaillé de cette partie selon les instructions.`
    ];
    console.log(`[${requestId}] Generating part detail with partDetailAgent...`);
    const detail = await partDetailAgent.submitQuery(prompt);
    console.log(`[${requestId}] Part detail generated.`);

    // Review the generated detail
    const reviewPrompt = [
      `Voici le plan détaillé généré pour la partie "${partTitle}" :\n${detail}\n\nMerci de vérifier la cohérence, les répétitions et le style de ce plan détaillé. Retourne uniquement une liste de suggestions ou corrections à appliquer, sous forme de liste structurée (JSON), sans réécrire le plan.`
    ];
    console.log(`[${requestId}] Reviewing part detail with reviewerAgent...`);
    const review = await reviewerAgent.submitQuery(reviewPrompt);
    console.log(`[${requestId}] Review completed. Review:`, review);

    // If there are suggestions/corrections, ask partDetailAgent to correct
    let correctedDetail = detail;
    let reviewObj: any = review;
    if (typeof review === 'string') {
      try { reviewObj = JSON.parse(review); } catch {}
    }
    if (Array.isArray(reviewObj) ? reviewObj.length > 0 : Object.keys(reviewObj).length > 0) {
      console.log(`[${requestId}] Corrections needed, sending to partDetailAgent...`);
      const correctionPrompt = [
        `Voici le plan détaillé généré pour la partie "${partTitle}" :\n${detail}\n\nVoici la liste des suggestions ou corrections à appliquer :\n${JSON.stringify(reviewObj, null, 2)}\n\nMerci de corriger le plan détaillé en appliquant ces suggestions, sans ajouter de texte explicatif, et en respectant le format Markdown demandé.`
      ];
      correctedDetail = await partDetailAgent.submitQuery(correctionPrompt);
      console.log(`[${requestId}] Corrections applied.`);
    } else {
      console.log(`[${requestId}] No corrections needed.`);
    }

    // Save the result in data/parts/part_${partNumber}.md
    const partNumber = extractPartNumber(partTitle);
    const dirPath = path.join(process.cwd(), 'data', 'parts');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`[${requestId}] Created directory: ${dirPath}`);
    }
    const filePath = path.join(dirPath, `part_${partNumber}.md`);
    fs.writeFileSync(filePath, correctedDetail, 'utf-8');
    console.log(`[${requestId}] Saved part detail to ${filePath}`);

    return NextResponse.json({ detail: correctedDetail, review });
  } catch (error) {
    console.error(`[${requestId}] Error in part-detail:`, error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate part detail' }, { status: 500 });
  }
} 