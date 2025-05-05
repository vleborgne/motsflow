import OpenAI from 'openai';

// Configuration constants
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral:latest';

// Interface for AI providers
interface AIProvider {
  generateCompletion(systemPrompt: string, userPrompt: string, config: AIConfig): Promise<any>;
}

interface AIConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" | "text" };
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
      maxTokens = 2000,
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
      console.log('OpenAI response (first 200 chars):', response ? response.slice(0, 200) : '[empty]');

      if (!response) {
        console.error('OpenAI returned empty response');
        return null;
      }

      return this.processResponse(response);
    } catch (error) {
      console.error('Error in OpenAI API call:', error);
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

// Factory to create the appropriate provider
export function createAIProvider(provider: 'openai' | 'ollama' = 'openai'): AIProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider();
    case 'ollama':
      return new OllamaProvider();
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
  const provider = createAIProvider(process.env.AI_PROVIDER as 'openai' | 'ollama' || 'openai');
  return provider.generateCompletion(systemPrompt, userPrompt, config);
}

export type { AIProvider, AIConfig };
export { OpenAIProvider, OllamaProvider };