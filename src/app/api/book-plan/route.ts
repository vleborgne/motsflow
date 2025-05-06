import { NextResponse } from 'next/server';
import { getBookPlan, saveBookPlan } from '@/lib/fileStorage';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { planWriterAgent, reviewerAgent } from '@/lib/agents';

export async function GET(request: Request) {
  try {
    // Check for ?format=md in the query string
    const url = new URL(request.url);
    const format = url.searchParams.get('format');
    if (format === 'md') {
      // Return the raw markdown file
      const filePath = path.join(process.cwd(), 'data', 'book-plan.md');
      const content = await fsPromises.readFile(filePath, 'utf-8');
      return new NextResponse(content, {
        status: 200,
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      });
    }
    // Default: return JSON
    const plan = getBookPlan();
    return NextResponse.json(plan);
  } catch {
    return NextResponse.json(
      { error: 'Failed to get book plan' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Starting plan generation request`);

  try {
    const body = await request.json();
    console.log(`[${requestId}] Request body:`, JSON.stringify(body, null, 2));
    const { description, writingStyle, bookType, prompt } = body;
    
    // Load the current plan and configuration
    const currentPlan = getBookPlan();
    const hasInitialPlan = currentPlan && Object.keys(currentPlan).length > 0;
    const configPath = path.join(process.cwd(), 'data', 'book-config.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const currentConfig = JSON.parse(configContent);

    // Only require description, writingStyle, bookType if no plan exists
    if (!hasInitialPlan && (!description || !writingStyle || !bookType)) {
      console.error(`[${requestId}] Missing required fields:`, { description, writingStyle, bookType });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Structure instructions for the plan
    const structureInstructions = `Règles de structure :
- Chaque chapitre doit comporter un résumé ET une liste des scènes.
- Les parties doivent être des titres de niveau 1 (#).
- Les chapitres doivent être des titres de niveau 2 (##).
- Les résumés et les listes de scènes doivent être des titres de niveau 3 (###).
- La liste des scènes doit être sous forme de liste à puces sous le titre 'Scènes'.`;

    // 1. Génération du plan initial par le planWriterAgent
    const planWriterPrompt = hasInitialPlan
      ? `Voici le plan actuel du livre :\n${JSON.stringify(currentPlan, null, 2)}\n\nVoici la configuration actuelle :\n${JSON.stringify(currentConfig, null, 2)}\n\nDemande de l'utilisateur :\n${prompt}\n\n${structureInstructions}\n\nTa tâche :\n1. Garde la structure générale du plan (parties, chapitres)\n2. Modifie uniquement les éléments demandés par l'utilisateur\n3. Assure la cohérence narrative entre les différentes parties\n4. Préserve les personnages existants et leurs arcs narratifs\n5. Respecte le style d'écriture et le type de livre\n6. Préserve les numéros de chapitres existants.`
      : `Aucun plan initial n'existe. Génère un plan de livre complet à partir des informations suivantes :\nDescription : ${description}\nStyle d'écriture : ${writingStyle}\nType de livre : ${bookType}\nConfiguration :\n${JSON.stringify(currentConfig, null, 2)}\n\nDemande de l'utilisateur :\n${prompt}\n\n${structureInstructions}\n\nTa tâche :\n1. Crée la structure complète du plan (parties, chapitres)\n2. Assure la cohérence narrative\n3. Propose des personnages et leurs arcs narratifs\n4. Respecte le style d'écriture et le type de livre.`;

    const initialPlan = await planWriterAgent.submitQuery([planWriterPrompt]);

    // 2. Relecture du plan par le reviewerAgent
    const reviewPrompt = [
      `Voici le plan du livre à relire :\n${initialPlan}\n\nPour chaque personnage et chaque lieu, vérifie qu'une description complète et détaillée est présente. Il est impératif que tous les personnages et tous les lieux soient bien décrits. Vérifie la cohérence du plan et détecte les répétitions. Génère une liste de suggestions ou corrections à appliquer, sous forme de liste structurée, sans réécrire le plan. TU NE DOIS FOURNIR QUE LA LISTE DES SUGGESTIONS ET CORRECTIONS ET PAS D'AUTRE TEXTE. TU NE DOIS PAS FOURNIR DE TEXTE EXPLICATIF.`
    ];
    const suggestions = await reviewerAgent.submitQuery(reviewPrompt);

    // 3. Réécriture du plan par le planWriterAgent en prenant en compte les suggestions
    const rewritePrompt = [
      `Voici le plan initial :\n${initialPlan}\n\nVoici la liste des suggestions/corrections à appliquer :\n${typeof suggestions === 'string' ? suggestions : JSON.stringify(suggestions, null, 2)}\n\nMerci de réécrire le plan en appliquant uniquement ces suggestions, sans rien changer d'autre.`
    ];
    const improvedPlan = await planWriterAgent.submitQuery(rewritePrompt);

    // Save the improved plan
    console.log(`[${requestId}] Saving improved plan...`);
    saveBookPlan(improvedPlan);
    console.log(`[${requestId}] Improved plan saved successfully to data/book-plan.md`);

    return NextResponse.json({
      initialPlan,
      suggestions,
      improvedPlan
    });
  } catch (error) {
    console.error(`[${requestId}] Error in plan generation:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate plan' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Starting plan update request`);

  try {
    const updates = await request.json();
    console.log(`[${requestId}] Update request body:`, JSON.stringify(updates, null, 2));

    // 1. User-driven plan modification
    if (updates && typeof updates.modificationPrompt === 'string') {
      console.log(`[${requestId}] Received modificationPrompt:`, updates.modificationPrompt);
      const currentPlan = getBookPlan();
      console.log(`[${requestId}] Current plan:`, typeof currentPlan === 'string' ? currentPlan : JSON.stringify(currentPlan, null, 2));
      if (!currentPlan) {
        console.error(`[${requestId}] No plan exists to update`);
        return NextResponse.json(
          { error: 'No plan exists to update' },
          { status: 404 }
        );
      }
      // Compose the prompt for the agent
      const agentPrompt = [
        `Voici le plan actuel :\n${typeof currentPlan === 'string' ? currentPlan : JSON.stringify(currentPlan, null, 2)}\n\nVoici la demande de modification de l'utilisateur :\n${updates.modificationPrompt}\n\nMerci de modifier le plan pour qu'il corresponde à la demande, sans changer la structure générale ni le style.`
      ];
      console.log(`[${requestId}] Agent prompt:`, agentPrompt[0]);
      const modifiedPlan = await planWriterAgent.submitQuery(agentPrompt);
      console.log(`[${requestId}] Modified plan:`, modifiedPlan);
      // Save and return
      const filePath = path.join(process.cwd(), 'data', 'book-plan.md');
      await fsPromises.writeFile(filePath, modifiedPlan, 'utf-8');
      console.log(`[${requestId}] Modified plan saved to book-plan.md`);
      return NextResponse.json({ plan: modifiedPlan });
    }

    // No more structure checks, always handle as Markdown
    console.warn(`[${requestId}] Invalid request: missing modificationPrompt`);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error(`[${requestId}] Error updating plan:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update plan' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'book-plan.md');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to delete plan',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
