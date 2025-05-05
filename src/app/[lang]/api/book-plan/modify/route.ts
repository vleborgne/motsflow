import { NextResponse } from 'next/server';
import { getBookPlan, saveBookPlan } from '@/lib/fileStorage';
import callOpenAI from '../../../../../lib/aiProvider';
import path from 'path';
import fs from 'fs';
import { validateBookPlan } from '@/components/book-plan/types';

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Starting plan modification request`);

  try {
    const body = await request.json();
    console.log(`[${requestId}] Request body:`, JSON.stringify(body, null, 2));
    const { prompt, lang } = body;
    
    if (!prompt) {
      console.error(`[${requestId}] Missing required fields:`, { prompt });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Retrieve the current plan and configuration
    const currentPlan = getBookPlan();
    if (!currentPlan) {
      console.error(`[${requestId}] No plan exists to modify`);
      return NextResponse.json(
        { error: 'No plan exists to modify' },
        { status: 404 }
      );
    }

    const configPath = path.join(process.cwd(), 'data', 'book-config.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const currentConfig = JSON.parse(configContent);

    console.log(`[${requestId}] Calling OpenAI with parameters:`, {
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
6. Preserve existing chapter numbers

The expected JSON structure is the same as the current outline, preserving the existing chapter numbers.`;

    console.log(`[${requestId}] Making OpenAI API call...`);
    const response = await callOpenAI(systemPrompt, userPrompt, {
      responseFormat: { type: "json_object" }
    });
    console.log(`[${requestId}] OpenAI API call completed`);

    let plan = response;
    if (!plan || !validateBookPlan(plan)) {
      console.warn(`[${requestId}] OpenAI response invalid, retrying with explicit format reminder...`);
      const correctionPrompt = `ATTENTION : Le format de la réponse précédente n'est pas conforme au format JSON strictement attendu. Voici le format exact à respecter (types entre crochets, ne pas inclure les crochets dans la réponse) :\n{
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
}\nCorrige la réponse précédente pour qu'elle corresponde STRICTEMENT à ce format.`;
      plan = await callOpenAI(systemPrompt, correctionPrompt, {
        responseFormat: { type: "json_object" }
      });
      if (!plan || !validateBookPlan(plan)) {
        console.error(`[${requestId}] OpenAI failed to return a valid BookPlan format after retry.`);
        return NextResponse.json(
          { error: 'Failed to modify plan in the expected format' },
          { status: 500 }
        );
      }
    }

    console.log(`[${requestId}] Saving modified plan...`);
    saveBookPlan(plan);
    console.log(`[${requestId}] Plan saved successfully`);

    return NextResponse.json({ plan });
  } catch (error) {
    console.error(`[${requestId}] Error in plan modification:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to modify plan' },
      { status: 500 }
    );
  }
} 