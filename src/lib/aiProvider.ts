import OpenAI from 'openai';

// Configuration constants
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral:latest';

// Mistral configuration
const MISTRAL_BASE_URL = process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai';
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;

// Interface for AI providers
interface AIProvider {
  generateCompletion(systemPrompt: string, userPrompt: string, config: AIConfig): Promise<any>;
}

interface AIConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" | "text" };
  agentId?: string; // Optional agentId for Mistral agents
}

// OpenAI Implementation
class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor() {
    console.log('Initializing OpenAI provider...');
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is missing from environment variables');
      throw new Error('OPENAI_API_KEY is missing from environment variables');
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('OpenAI provider initialized successfully');
  }

  async generateCompletion(systemPrompt: string, userPrompt: string, config: AIConfig = {}) {
    const {
      model = "gpt-4-turbo-preview",
      temperature = 0.7,
      maxTokens = 4000,
      responseFormat = { type: "json_object" as const }
    } = config;

    console.log('Making OpenAI API call with config:', {
      model,
      temperature,
      maxTokens,
      responseFormat
    });

    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: responseFormat
      });

      console.log('OpenAI API call completed successfully');
      const response = completion.choices[0]?.message?.content;
      console.log('Raw response:', response);
      console.log('OpenAI response length:', response ? response.length : 0);

      if (!response) {
        console.error('OpenAI returned empty response');
        return null;
      }

      // NEW: Return raw response if text is expected
      if (responseFormat?.type === 'text') {
        return response;
      }

      return this.processResponse(response);
    } catch (error) {
      console.error('Error in OpenAI API call:', error);
      console.error('OpenAI call failed with:', {
        systemPrompt,
        userPrompt,
        config,
        error
      });
      throw error;
    }
  }

  private processResponse(response: string | null) {
    if (!response) {
      console.error('Cannot process null response');
      return null;
    }

    try {
      console.log('Processing OpenAI response...');
      // Try direct JSON parse
      try {
        const parsed = JSON.parse(response);
        console.log('Response parsed successfully');
        return parsed;
      } catch (e1) {
        // Try to extract the first JSON array in the string
        const firstBracket = response.indexOf('[');
        const lastBracket = response.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
          const jsonArrayStr = response.slice(firstBracket, lastBracket + 1);
          try {
            const parsed = JSON.parse(jsonArrayStr);
            console.log('Response parsed successfully after extracting array');
            return parsed;
          } catch (e2) {
            // Try to parse again if it's a stringified string
            try {
              const parsed = JSON.parse(JSON.parse(jsonArrayStr));
              console.log('Response parsed successfully after double parsing');
              return parsed;
            } catch (e3) {
              // All attempts failed
              console.error('Error parsing OpenAI response after extracting array:', e2);
              console.error('Raw response that failed to parse:', response);
              throw new Error('Failed to parse OpenAI response as JSON (even after cleaning)');
            }
          }
        } else {
          console.error('Error parsing OpenAI response:', e1);
          console.error('Raw response that failed to parse:', response);
          throw new Error('Failed to parse OpenAI response as JSON');
        }
      }
    } catch (error) {
      console.error('Error cleaning/parsing OpenAI response:', error);
      console.error('Raw response that failed to parse:', response);
      throw new Error('Failed to parse OpenAI response as JSON (even after cleaning)');
    }
  }
}

// Ollama Implementation
class OllamaProvider implements AIProvider {
  private baseUrl: string;

  constructor() {
    this.baseUrl = OLLAMA_BASE_URL;
  }

  async generateCompletion(systemPrompt: string, userPrompt: string, config: AIConfig = {}) {
    const {
      model = OLLAMA_MODEL,
      temperature = 0.7,
      maxTokens = 2000,
      responseFormat = { type: "json_object" as const }
    } = config;

    try {
      const requestBody = {
        model,
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens,
        }
      };

      console.log('Ollama Request:', {
        url: `${this.baseUrl}/api/generate`,
        body: requestBody
      });

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ollama API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText
        });
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}\n${errorText}`);
      }

      const data = await response.json();
      console.log('Ollama Response:', data);
      return this.processResponse(data.response);
    } catch (error) {
      console.error('Ollama API Error:', error);
      throw error;
    }
  }

  private processResponse(response: string | null) {
    if (!response) {
      throw new Error('No response from Ollama');
    }

    try {
      // First try to parse the response directly
      try {
        return JSON.parse(response);
      } catch (e) {
        console.log('Direct JSON parse failed, attempting to clean response');
      }

      const cleanedResponse = response
        .trim()
        .replace(/^```json\s*|\s*```$/g, '')
        .replace(/^```\s*|\s*```$/g, '')
        .replace(/^\s*\{/, '{')
        .replace(/\}\s*$/, '}')
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Fix unquoted property names
        .trim();

      console.log('Cleaned response:', cleanedResponse);
      return JSON.parse(cleanedResponse);
    } catch (error) {
      console.error('Failed to parse Ollama response:', error);
      console.error('Original response:', response);
      throw new Error(`Failed to parse Ollama response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
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

  async generateCompletion(systemPrompt: string, userPrompt: string, config: AIConfig = {}) {
    const {
      model = 'mistral-large-latest',
      maxTokens = 4000,
      responseFormat = { type: 'json_object' as const },
      agentId
    } = config;

    let requestBody: any;
    let endpoint: string;
    if (agentId) {
      // Use the agents endpoint
      endpoint = '/v1/agents/completions';
      requestBody = {
        agent_id: agentId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: maxTokens,
        // Add response_format if present
        ...(responseFormat ? { response_format: responseFormat } : {})
      };
    } else {
      // Use the chat endpoint
      endpoint = '/v1/chat/completions';
      requestBody = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        max_tokens: maxTokens,
        // Add response_format if present
        ...(responseFormat ? { response_format: responseFormat } : {})
      };
    }

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

  private processResponse(response: string | null, responseType: 'json_object' | 'text' = 'json_object') {
    if (!response) {
      throw new Error('No response from Mistral');
    }
    if (responseType === 'text') {
      return response;
    }
    try {
      // Try direct JSON parse
      try {
        return JSON.parse(response);
      } catch (e) {
        // Try to extract the first JSON array in the string
        const firstBracket = response.indexOf('[');
        const lastBracket = response.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
          const jsonArrayStr = response.slice(firstBracket, lastBracket + 1);
          try {
            return JSON.parse(jsonArrayStr);
          } catch (e2) {
            // Try to parse again if it's a stringified string
            try {
              return JSON.parse(JSON.parse(jsonArrayStr));
            } catch (e3) {
              console.error('Error parsing Mistral response after extracting array:', e2);
              console.error('Raw response that failed to parse:', response);
              throw new Error('Failed to parse Mistral response as JSON (even after cleaning)');
            }
          }
        } else {
          console.error('Error parsing Mistral response:', e);
          console.error('Raw response that failed to parse:', response);
          throw new Error('Failed to parse Mistral response as JSON');
        }
      }
    } catch (error) {
      console.error('Error cleaning/parsing Mistral response:', error);
      console.error('Raw response that failed to parse:', response);
      throw new Error('Failed to parse Mistral response as JSON (even after cleaning)');
    }
  }
}

// Factory to create the appropriate provider
export function createAIProvider(provider: 'openai' | 'ollama' | 'mistral' = 'openai'): AIProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider();
    case 'ollama':
      return new OllamaProvider();
    case 'mistral':
      return new MistralProvider();
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

// Default export for backward compatibility
export default async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  config: AIConfig = {}
) {
  const provider = createAIProvider(process.env.AI_PROVIDER as 'openai' | 'ollama' | 'mistral' || 'openai');
  return provider.generateCompletion(systemPrompt, userPrompt, config);
}

export type { AIProvider, AIConfig };
export { OpenAIProvider, OllamaProvider, MistralProvider };

function parseAIResponse(response: string | null): any {
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

function handleAIResponse(response: string | null, responseType: 'json_object' | 'text' = 'json_object') {
  if (!response) return null;
  if (responseType === 'text') return response;
  return parseAIResponse(response);
}