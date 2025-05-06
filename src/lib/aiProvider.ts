// Mistral configuration
const MISTRAL_BASE_URL = process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai';
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

// Interface for AI providers
interface AIProvider {
  generateCompletion(systemPrompt: string[], userPrompt: string[], config: AIConfig): Promise<unknown>;
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
  private provider: MistralProvider;
  private responseFormat?: AIConfig['responseFormat'];

  constructor({ systemPrompt, model, temperature, responseFormat }: { systemPrompt: string[]; model: string; temperature: number; responseFormat?: AIConfig['responseFormat'] }) {
    this.systemPrompt = systemPrompt;
    this.model = model;
    this.temperature = temperature;
    this.provider = new MistralProvider();
    this.responseFormat = responseFormat;
  }

  async submitQuery(query: string[], config: Partial<AIConfig> = {}) {
    return this.provider.generateCompletion(
      this.systemPrompt,
      query,
      {
        model: this.model,
        temperature: this.temperature,
        responseFormat: config.responseFormat || this.responseFormat,
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