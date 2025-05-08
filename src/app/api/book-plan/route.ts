import { NextResponse } from 'next/server';
import { getBookPlan, saveBookPlan } from '@/lib/fileStorage';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { planWriterAgent } from '@/lib/agents';

export async function GET(request: Request) {
  try {
    // Check for ?format=md in the query string
    const url = new URL(request.url);
    const format = url.searchParams.get('format');
    const partNumber = url.searchParams.get('partNumber');
    if (partNumber) {
      // Return the markdown file for the requested part
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

// Helper to build the planWriter prompt for both POST and PUT
function buildPlanWriterPrompt({ currentPlan, currentConfig, prompt, description, writingStyle, bookType }: { currentPlan?: any, currentConfig: any, prompt?: string, description?: string, writingStyle?: string, bookType?: string }) {
  const structureInstructions = `Règles de structure :\n- Le plan doit uniquement comporter la liste des parties du livre, chacune accompagnée d'un résumé détaillé (au moins 10 lignes) de ce qui s'y passe, des enjeux, des personnages impliqués et de l'évolution de l'intrigue dans cette partie et d'une liste de chapitres.\n- N'inclus pas les scènes, ils seront écrits plus tard.\n- Les parties doivent être des titres de niveau 1 (#) et numérotées (I, II, III, etc.) et les chapitres doivent être numérotés (I.1, I.2, II.1, III, etc.).\n- Les chapitres doivent suivre une structure narrative : situation initiale, élément perturbateur, résolution, situation de suspens pour la prochaine partie.\n- Il doit y avoir au moins 6 chapitres par partie.`;
  if (currentPlan && Object.keys(currentPlan).length > 0) {
    return `Voici le plan général actuel du livre :\n${typeof currentPlan === 'string' ? currentPlan : JSON.stringify(currentPlan, null, 2)}\n\nVoici la configuration actuelle :\n${JSON.stringify(currentConfig, null, 2)}\n\nDemande de l'utilisateur :\n${prompt || ''}\n\n${structureInstructions}\n\nTa tâche :\n1. Garde la structure générale du plan (parties)\n2. Modifie uniquement les éléments demandés par l'utilisateur\n3. Assure la cohérence narrative entre les différentes parties\n4. Préserve les personnages existants et leurs arcs narratifs\n5. Respecte le style d'écriture et le type de livre\n6. Préserve les numéros de parties existants.`;
  } else {
    return `Aucun plan initial n'existe. Génère un plan général de livre à partir des informations suivantes :\nDescription : ${description}\nStyle d'écriture : ${writingStyle}\nType de livre : ${bookType}\nConfiguration :\n${JSON.stringify(currentConfig, null, 2)}\n\nDemande de l'utilisateur :\n${prompt || ''}\n\n${structureInstructions}\n\nTa tâche :\n1. Crée la structure complète du plan général (parties)\n2. Assure la cohérence narrative\n3. Propose des personnages et leurs arcs narratifs\n4. Respecte le style d'écriture et le type de livre.`;
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
    console.log(`[${requestId}] Loaded current plan:`, JSON.stringify(currentPlan, null, 2));
    console.log(`[${requestId}] Loaded current config:`, JSON.stringify(currentConfig, null, 2));

    // Only require description, writingStyle, bookType if no plan exists
    if (!hasInitialPlan && (!description || !writingStyle || !bookType)) {
      console.error(`[${requestId}] Missing required fields:`, { description, writingStyle, bookType });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Use the helper to build the prompt
    const planWriterPrompt = buildPlanWriterPrompt({
      currentPlan,
      currentConfig,
      prompt,
      description,
      writingStyle,
      bookType
    });
    console.log(`[${requestId}] planWriterPrompt:`, planWriterPrompt);
    const generalPlan = await planWriterAgent.submitQuery([planWriterPrompt]) as string;
    console.log(`[${requestId}] generalPlan generated`);

    // Save the general plan
    console.log(`[${requestId}] Saving general plan...`);
    saveBookPlan(generalPlan);
    console.log(`[${requestId}] General plan saved successfully to data/book-plan.md`);

    return NextResponse.json({
      generalPlan
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
      // Use the helper to build the prompt
      const configPath = path.join(process.cwd(), 'data', 'book-config.json');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const currentConfig = JSON.parse(configContent);
      const planWriterPrompt = buildPlanWriterPrompt({
        currentPlan,
        currentConfig,
        prompt: updates.modificationPrompt
      });
      console.log(`[${requestId}] planWriterPrompt:`, planWriterPrompt);
      const modifiedPlan = await planWriterAgent.submitQuery([planWriterPrompt]) as string;
      console.log(`[${requestId}] Modified plan:`, modifiedPlan);
      // Save and return
      const filePath = path.join(process.cwd(), 'data', 'book-plan.md');
      await fsPromises.writeFile(filePath, modifiedPlan, 'utf-8');
      console.log(`[${requestId}] Modified plan saved to book-plan.md`);
      return NextResponse.json({ plan: modifiedPlan });
    }
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
