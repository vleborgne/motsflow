import { NextResponse } from 'next/server';
import { getBookPlan, saveBookPlan } from '@/lib/fileStorage';
import callOpenAI from '../../../../lib/aiProvider';
import path from 'path';
import fs from 'fs';
import { validateBookPlan } from '@/components/book-plan/types';

export async function GET() {
  try {
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
    
    if (!description || !writingStyle || !bookType) {
      console.error(`[${requestId}] Missing required fields:`, { description, writingStyle, bookType });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Retrieve the current plan and configuration
    const currentPlan = getBookPlan();
    const configPath = path.join(process.cwd(), 'data', 'book-config.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const currentConfig = JSON.parse(configContent);

    console.log(`[${requestId}] Calling OpenAI with parameters:`, {
      writingStyle,
      bookType,
      lang
    });

    const systemPrompt = `You are an assistant specialized in editing existing book outlines. You must modify the existing outline according to the user's prompt, while respecting the specified writing style and book type.
IMPORTANT:
- Your response must be ONLY a valid JSON object, with no extra text before or after.
- Do not add comments, explanations, or extra text.
- The response must start with { and end with }.
- JSON keys must be in English (title, genre, parts, chapters, etc.).
- ALL content (titles, descriptions, stories) must be in French.
- Each chapter MUST have a "chapter_number" field corresponding to its number in the part (starting at 1).
- The expected JSON format is as follows (types in brackets, do not include brackets in the response):
{
  "title": [string],
  "genre": [string],
  "parts": [
    {
      "title": [string],
      "chapters": [
        {
          "chapter_number": [number],
          "title": [string],
          "narrative_goal": [string],
          "story": [string],
          "summary": [string],
          "characters": [array of string],
          "narrative_element": [string],
          "subparts"?: [
            {
              "id": [string],
              "title": [string],
              "content": [string],
              "suspense": [string]
            }
          ],
          "has_subparts"?: [boolean]
        }
      ]
    }
  ],
  "characters": [
    {
      "id": [string],
      "name": [string],
      "description": [string]
    }
  ]
}
`;

    const userPrompt = `Modify the following book outline according to the user's request.

Current outline:
${JSON.stringify(currentPlan, null, 2)}

Current configuration:
${JSON.stringify(currentConfig, null, 2)}

User request:
${prompt}

Your task is to:
1. Keep the general structure of the outline (parts, chapters)
2. Modify the elements requested by the user
3. Ensure narrative coherence between the different parts
4. Maintain existing characters and their narrative arcs
5. Respect the specified writing style and book type
6. Ensure each chapter has a "chapter_number" field corresponding to its number in the part (starting at 1)

The expected JSON structure is the same as the current outline, with the addition of the "chapter_number" field for each chapter.`;

    console.log(`[${requestId}] Making OpenAI API call...`);
    const response = await callOpenAI(systemPrompt, userPrompt, {
      responseFormat: { type: "json_object" }
    });
    console.log(`[${requestId}] OpenAI API call completed`);

    let plan = response;
    if (!plan || !validateBookPlan(plan)) {
      console.warn(`[${requestId}] OpenAI response invalid, retrying with explicit format reminder...`);
      const correctionPrompt = `ATTENTION : Le format de la réponse précédente n'est pas conforme au format JSON strictement attendu. Voici le format exact à respecter (types entre crochets, ne pas inclure les crochets dans la réponse) :
{
  "title": [string],
  "genre": [string],
  "parts": [
    {
      "title": [string],
      "chapters": [
        {
          "chapter_number": [number],
          "title": [string],
          "narrative_goal": [string],
          "story": [string],
          "summary": [string],
          "characters": [array of string],
          "narrative_element": [string],
          "subparts"?: [
            {
              "id": [string],
              "title": [string],
              "content": [string],
              "suspense": [string]
            }
          ],
          "has_subparts"?: [boolean]
        }
      ]
    }
  ],
  "characters": [
    {
      "id": [string],
      "name": [string],
      "description": [string]
    }
  ]
}
Corrige la réponse précédente pour qu'elle corresponde STRICTEMENT à ce format.`;
      plan = await callOpenAI(systemPrompt, correctionPrompt, {
        responseFormat: { type: "json_object" }
      });
      if (!plan || !validateBookPlan(plan)) {
        console.error(`[${requestId}] OpenAI failed to return a valid BookPlan format after retry.`);
        return NextResponse.json(
          { error: 'Failed to generate plan in the expected format' },
          { status: 500 }
        );
      }
    }

    console.log(`[${requestId}] Saving generated plan...`);
    saveBookPlan(plan);
    console.log(`[${requestId}] Plan saved successfully`);

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
    console.log(`[${requestId}] Plan updated successfully`);
    
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
    const filePath = path.join(process.cwd(), 'data', 'book-plan.json');
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