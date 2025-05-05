import { NextResponse } from 'next/server';
import { getBookPlan, saveBookPlan } from '@/lib/fileStorage';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import callOpenAI from '@/lib/aiProvider';

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
  } catch (error) {
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
    const { description, writingStyle, bookType, lang, prompt } = body;
    
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

    // Adapt the redacteur prompt based on the presence of an initial plan
    const structureInstructions = `Règles de structure :
- Chaque chapitre doit comporter un résumé ET une liste des scènes.
- Les parties doivent être des titres de niveau 1 (#).
- Les chapitres doivent être des titres de niveau 2 (##).
- Les résumés et les listes de scènes doivent être des titres de niveau 3 (###).
- La liste des scènes doit être sous forme de liste à puces sous le titre 'Scènes'.`;

    const redacteurPrompt = hasInitialPlan
      ? `Voici le plan actuel du livre :\n${JSON.stringify(currentPlan, null, 2)}\n\nVoici la configuration actuelle :\n${JSON.stringify(currentConfig, null, 2)}\n\nDemande de l'utilisateur :\n${prompt}\n\n${structureInstructions}\n\nTa tâche :\n1. Garde la structure générale du plan (parties, chapitres)\n2. Modifie uniquement les éléments demandés par l'utilisateur\n3. Assure la cohérence narrative entre les différentes parties\n4. Préserve les personnages existants et leurs arcs narratifs\n5. Respecte le style d'écriture et le type de livre\n6. Préserve les numéros de chapitres existants.`
      : `Aucun plan initial n'existe. Génère un plan de livre complet à partir des informations suivantes :\nDescription : ${description}\nStyle d'écriture : ${writingStyle}\nType de livre : ${bookType}\nConfiguration :\n${JSON.stringify(currentConfig, null, 2)}\n\nDemande de l'utilisateur :\n${prompt}\n\n${structureInstructions}\n\nTa tâche :\n1. Crée la structure complète du plan (parties, chapitres)\n2. Assure la cohérence narrative\n3. Propose des personnages et leurs arcs narratifs\n4. Respecte le style d'écriture et le type de livre.`;

    // Direct two-step AI call (redacteur, then transformateur)
    const redacteurSystemPrompt = `Tu es un assistant spécialisé dans la création et la modification de plans de livres. Génère ou modifie le plan ci-dessous selon la demande de l'utilisateur, en respectant le style d'écriture et le type de livre. N'ajoute aucun texte explicatif, ne modifie pas la structure générale du plan, et conserve la cohérence narrative.`;
    const plan = await callOpenAI(
      redacteurSystemPrompt,
      redacteurPrompt,
      { responseFormat: { type: 'text' }, agentId: process.env.MISTRAL_AGENT_ID_REDACTEUR }
    );

    // Save the plan directly without validation
    console.log(`[${requestId}] Saving generated plan...`);
    saveBookPlan(plan);
    console.log(`[${requestId}] Plan saved successfully to data/book-plan.md`);

    return NextResponse.json({ plan });
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
    
    const currentPlan = getBookPlan();
    if (!currentPlan) {
      console.error(`[${requestId}] No plan exists to update`);
      return NextResponse.json(
        { error: 'No plan exists to update' },
        { status: 404 }
      );
    }

    // Check that required fields are present in the updates
    const requiredFields = ['title', 'genre', 'characters', 'parts'];
    const missingFields = requiredFields.filter(field => !updates[field]);
    
    if (missingFields.length > 0) {
      console.error(`[${requestId}] Missing required fields:`, missingFields);
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          missingFields
        },
        { status: 400 }
      );
    }

    // Check the structure of parts and chapters
    if (!Array.isArray(updates.parts)) {
      console.error(`[${requestId}] Parts must be an array`);
      return NextResponse.json(
        { error: 'Parts must be an array' },
        { status: 400 }
      );
    }

    for (const part of updates.parts) {
      if (!part.title || !Array.isArray(part.chapters)) {
        console.error(`[${requestId}] Invalid part structure:`, part);
        return NextResponse.json(
          { error: 'Invalid part structure' },
          { status: 400 }
        );
      }

      for (const chapter of part.chapters) {
        const requiredChapterFields = ['title', 'narrative_goal', 'summary', 'characters', 'narrative_elements'];
        const missingChapterFields = requiredChapterFields.filter(field => !chapter[field]);
        
        if (missingChapterFields.length > 0) {
          console.error(`[${requestId}] Missing required chapter fields:`, missingChapterFields);
          return NextResponse.json(
            { 
              error: 'Missing required chapter fields',
              missingFields: missingChapterFields
            },
            { status: 400 }
          );
        }
      }
    }
    
    const updatedPlan = {
      ...currentPlan,
      ...updates,
    };
    
    console.log(`[${requestId}] Saving updated plan...`);
    saveBookPlan(updatedPlan);
    console.log(`[${requestId}] Plan updated successfully to data/book-plan.md`);
    
    return NextResponse.json(updatedPlan);
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
