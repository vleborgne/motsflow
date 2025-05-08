// Mistral configuration
const MISTRAL_BASE_URL = process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai';
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

// OpenAI configuration
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Set PROVIDER to either 'openai' or 'mistral'
export const PROVIDER: string = process.env.AI_PROVIDER || 'openai';

// Generic model mapping for both providers
export const LARGE_MODEL = PROVIDER === 'mistral' ? 'mistral-large-latest' : 'gpt-4o';
export const MEDIUM_MODEL = PROVIDER === 'mistral' ? 'mistral-medium-latest' : 'gpt-3.5-turbo';

// Interface for AI providers
interface AIProvider {
  generateCompletion(systemPrompt: string[], userPrompt: string[], config: AIConfig): Promise<unknown>;
  getLargeModelName(): string;
  getMediumModelName(): string;
}

interface AIConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" | "text" };
}

// Mistral Implementation
class MistralProvider implements AIProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = MISTRAL_BASE_URL;
    this.apiKey = MISTRAL_API_KEY || '';
    if (!this.apiKey) {
      console.error('MISTRAL_API_KEY is missing from environment variables');
      throw new Error('MISTRAL_API_KEY is missing from environment variables');
    }
  }

  async generateCompletion(systemPrompt: Array<string>, userPrompt: Array<string>, config: AIConfig = {}) {
    const {
      model = 'mistral-large-latest',
      maxTokens = 8000,
      responseFormat = { type: 'json_object' as const },
    } = config;


    const prompts = systemPrompt.map(prompt => ({ role: 'system', content: prompt })).concat(userPrompt.map(prompt => ({ role: 'user', content: prompt })));
   
    // Use the chat endpoint
    const endpoint = '/v1/chat/completions';
    const requestBody = {
      model,
      messages: prompts,
      temperature: config.temperature || 0.7,
      max_tokens: maxTokens,
      // Add response_format if present
      ...(responseFormat ? { response_format: responseFormat } : {})
    };

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Mistral API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText
        });
        throw new Error(`Mistral API error: ${response.status} ${response.statusText}\n${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.error('Mistral returned empty response');
        return null;
      }
      // If text is expected, return as is
      if (responseFormat?.type === 'text') {
        return content;
      }
      return handleAIResponse(content, responseFormat?.type);
    } catch (error) {
      console.error('Mistral API Error:', error);
      throw error;
    }
  }

  getLargeModelName(): string {
    return 'mistral-large-latest';
  }

  getMediumModelName(): string {
    return 'mistral-medium-latest';
  }
}

// Factory to create the appropriate provider (now only Mistral)
export function createAIProvider(): AIProvider {
  return new MistralProvider();
}

// Default export for backward compatibility (now only Mistral)
export default async function callMistral(
  systemPrompt: Array<string>,
  userPrompt: Array<string>,
  config: AIConfig = {}
) {
  const provider = createAIProvider();
  return provider.generateCompletion(systemPrompt, userPrompt, config);
}

export type { AIProvider, AIConfig };
export { MistralProvider };

// Agent class definition
class Agent {
  private systemPrompt: string[];
  private model: string;
  private temperature: number;
  private provider: AIProvider;
  private responseFormat?: AIConfig['responseFormat'];
  private maxTokens?: number;

  constructor({ systemPrompt, model, temperature, responseFormat, maxTokens, provider }: { systemPrompt: string[]; model: string; temperature: number; responseFormat?: AIConfig['responseFormat']; maxTokens?: number; provider?: AIProvider }) {
    this.systemPrompt = systemPrompt;
    this.model = model;
    this.temperature = temperature;
    this.provider = provider || new MistralProvider();
    this.responseFormat = responseFormat;
    this.maxTokens = maxTokens;
  }

  async submitQuery(query: string[], config: Partial<AIConfig> = {}) {
    return this.provider.generateCompletion(
      this.systemPrompt,
      query,
      {
        model: this.model,
        temperature: this.temperature,
        responseFormat: config.responseFormat || this.responseFormat,
        maxTokens: config.maxTokens || this.maxTokens,
        ...config,
      }
    );
  }
}

export { Agent };

function parseAIResponse(response: string | null): unknown {
  console.log('[parseAIResponse] Raw response:', response);
  if (!response) return null;

  // Clean markdown code block delimiters
  let cleaned = response.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '');
  }
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/```\s*$/, '');
  }
  cleaned = cleaned.trim();
  console.log('[parseAIResponse] Cleaned response:', cleaned);

  // Try to parse the whole object
  try {
    const parsed = JSON.parse(cleaned);
    console.log('[parseAIResponse] Successfully parsed as JSON:', parsed);
    return parsed;
  } catch (e1) {
    console.warn('[parseAIResponse] Failed to parse as JSON, trying to extract array. Error:', e1);
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const jsonArrayStr = cleaned.slice(firstBracket, lastBracket + 1);
      console.log('[parseAIResponse] Extracted array string:', jsonArrayStr);
      try {
        const parsedArray = JSON.parse(jsonArrayStr);
        console.log('[parseAIResponse] Successfully parsed extracted array:', parsedArray);
        return parsedArray;
      } catch (e2) {
        console.warn('[parseAIResponse] Failed to parse extracted array, trying double JSON.parse. Error:', e2);
        try {
          const doubleParsed = JSON.parse(JSON.parse(jsonArrayStr));
          console.log('[parseAIResponse] Successfully double-parsed array:', doubleParsed);
          return doubleParsed;
        } catch (e3) {
          console.error('[parseAIResponse] Failed to parse response as JSON (even after cleaning). Error:', e3);
          throw new Error('Failed to parse response as JSON (even after cleaning)');
        }
      }
    } else {
      console.error('[parseAIResponse] Failed to parse response as JSON, no array found.');
      throw new Error('Failed to parse response as JSON');
    }
  }
}

function handleAIResponse(response: string | null, responseType: 'json_object' | 'text' = 'json_object'): unknown {
  if (!response) return null;
  if (responseType === 'text') return response;
  return parseAIResponse(response);
}

export interface AgentConfig {
  systemPrompt: string[];
  model: string;
  temperature: number;
  responseFormat?: { type: 'text' | 'json_object' };
  maxTokens?: number;
}

// Shared helper for formatting prompts
function buildChatMessages(systemPrompt: string[], userPrompt: string[]) {
  return [
    ...systemPrompt.map(prompt => ({ role: 'system', content: prompt })),
    ...userPrompt.map(prompt => ({ role: 'user', content: prompt })),
  ];
}

// Shared helper for building request body
function buildChatRequestBody({ model, messages, temperature, maxTokens, responseFormat }: {
  model: string;
  messages: any[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' | 'text' };
}) {
  // OpenAI and Mistral use the same field names for these
  const body: any = {
    model,
    messages,
    temperature: temperature ?? 0.7,
    max_tokens: maxTokens,
  };
  if (responseFormat) {
    // OpenAI uses response_format: { type: 'json_object' } for JSON mode
    body.response_format = responseFormat;
  }
  return body;
}

// OpenAI Implementation
class OpenAIProvider implements AIProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = OPENAI_BASE_URL;
    this.apiKey = OPENAI_API_KEY || '';
    if (!this.apiKey) {
      console.error('OPENAI_API_KEY is missing from environment variables');
      throw new Error('OPENAI_API_KEY is missing from environment variables');
    }
  }

  async generateCompletion(systemPrompt: Array<string>, userPrompt: Array<string>, config: AIConfig = {}) {
    const {
      model = 'gpt-3.5-turbo',
      maxTokens = 8000,
      responseFormat = { type: 'json_object' as const },
    } = config;

    const messages = buildChatMessages(systemPrompt, userPrompt);
    const endpoint = '/v1/chat/completions';
    const requestBody = buildChatRequestBody({
      model,
      messages,
      temperature: config.temperature,
      maxTokens,
      responseFormat,
    });

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText
        });
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}\n${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.error('OpenAI returned empty response');
        return null;
      }
      if (responseFormat?.type === 'text') {
        return content;
      }
      return handleAIResponse(content, responseFormat?.type);
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw error;
    }
  }

  getLargeModelName(): string {
    return 'gpt-4o';
  }

  getMediumModelName(): string {
    return 'gpt-3.5-turbo';
  }
}

export { OpenAIProvider };

/**
 * Utility to generate long text with an Agent, splitting the generation into several calls if needed.
 * This function will repeatedly call the agent with a continuation prompt until the model stops or a limit is reached.
 * @param agent The Agent instance to use
 * @param userPrompt The initial user prompt (array of strings)
 * @param options Optional: maxTokens (default 4096), stopSequence (optional)
 * @returns The concatenated long text
 */
export async function generateLongText(
  agent: Agent,
  userPrompt: string[],
  options: { maxTokens?: number; stopSequence?: string } = {}
): Promise<string> {
  const maxTokens = options.maxTokens ?? 4096;
  const stopSequence = options.stopSequence ?? undefined;
  let fullText = '';
  let continuePrompt = [...userPrompt];
  let finished = false;
  let iteration = 0;

  while (!finished && iteration < 10) { // Safety limit to avoid infinite loops
    const response = await agent.submitQuery(continuePrompt, { maxTokens });
    const text = typeof response === 'string' ? response : (response as any)?.content ?? '';
    fullText += text;

    // If the response is short or ends with a typical ending, stop
    if (!text || text.trim().toLowerCase().endsWith('fin.') || text.length < 100) {
      finished = true;
    } else {
      // Prepare the prompt to ask for the continuation
      continuePrompt = ['Continue le texte précédent sans répéter ni résumer.'];
    }
    iteration++;
  }

  return fullText;
}