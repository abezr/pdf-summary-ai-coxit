/**
 * LLM Provider Abstraction Layer
 * Supports: OpenAI GPT-4o & GCP Vertex AI (Gemini Pro, Claude 3.5 Sonnet)
 */

import OpenAI from 'openai';
import { VertexAI } from '@google-cloud/vertexai';
import { logger } from '../utils/logger';

export type LLMProviderType = 'openai' | 'gcp';

export interface LLMConfig {
  provider: LLMProviderType;
  model: string;
  maxTokens: number;
  temperature?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
}

export interface ChatCompletionResponse {
  content: string;
  tool_calls?: Array<{
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  finish_reason: 'stop' | 'tool_calls' | 'length';
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface EmbeddingResponse {
  embedding: number[];
  usage: {
    total_tokens: number;
  };
}

/**
 * Abstract LLM Provider Interface
 */
export abstract class LLMProvider {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  abstract chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  abstract generateEmbedding(text: string): Promise<EmbeddingResponse>;
  abstract estimateCost(usage: { prompt_tokens: number; completion_tokens: number }): number;
}

/**
 * OpenAI Provider Implementation
 */
export class OpenAIProvider extends LLMProvider {
  private client: OpenAI;
  private embeddingModel: string;

  // Pricing per 1K tokens (as of Nov 2024)
  private static readonly PRICING = {
    'gpt-4o': { input: 0.0025, output: 0.010 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'text-embedding-3-large': { input: 0.00013, output: 0 },
    'text-embedding-3-small': { input: 0.00002, output: 0 }
  };

  constructor(config: LLMConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large';
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: request.messages as any,
        tools: request.tools as any,
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? this.config.maxTokens,
        response_format: request.response_format as any
      });

      const choice = response.choices[0];

      return {
        content: choice.message.content || '',
        tool_calls: choice.message.tool_calls as any,
        finish_reason: choice.finish_reason as any,
        usage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0
        }
      };
    } catch (error: any) {
      logger.error('OpenAI API error', { error: error.message });
      throw new Error(`OpenAI API failed: ${error.message}`);
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    try {
      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: text,
        encoding_format: 'float'
      });

      return {
        embedding: response.data[0].embedding,
        usage: {
          total_tokens: response.usage.total_tokens
        }
      };
    } catch (error: any) {
      logger.error('OpenAI Embedding error', { error: error.message });
      throw new Error(`OpenAI Embedding failed: ${error.message}`);
    }
  }

  estimateCost(usage: { prompt_tokens: number; completion_tokens: number }): number {
    const pricing = OpenAIProvider.PRICING[this.config.model as keyof typeof OpenAIProvider.PRICING];
    if (!pricing) {
      logger.warn(`Unknown pricing for model: ${this.config.model}`);
      return 0;
    }

    const inputCost = (usage.prompt_tokens / 1000) * pricing.input;
    const outputCost = (usage.completion_tokens / 1000) * pricing.output;
    return inputCost + outputCost;
  }
}

/**
 * GCP Vertex AI Provider Implementation
 */
export class GCPProvider extends LLMProvider {
  private vertexAI: VertexAI;
  private projectId: string;
  private location: string;

  // Pricing per 1K tokens (as of Nov 2024)
  private static readonly PRICING = {
    'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
    'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
    'claude-3-5-sonnet@20240620': { input: 0.003, output: 0.015 },
    'claude-3-haiku@20240307': { input: 0.00025, output: 0.00125 }
  };

  constructor(config: LLMConfig) {
    super(config);
    this.projectId = process.env.GCP_PROJECT_ID || '';
    this.location = process.env.GCP_LOCATION || 'us-central1';

    this.vertexAI = new VertexAI({
      project: this.projectId,
      location: this.location
    });
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      const generativeModel = this.vertexAI.getGenerativeModel({
        model: this.config.model,
        generation_config: {
          max_output_tokens: request.max_tokens ?? this.config.maxTokens,
          temperature: request.temperature ?? this.config.temperature ?? 0.7
        }
      });

      // Convert messages to Vertex AI format
      const contents = this.convertMessagesToVertexFormat(request.messages);

      // Handle tool calling (function calling in Vertex AI)
      const tools = request.tools ? this.convertToolsToVertexFormat(request.tools) : undefined;

      const result = await generativeModel.generateContent({
        contents,
        tools
      });

      const response = result.response;
      const functionCalls = response.candidates?.[0]?.content?.parts?.filter(
        (part: any) => part.functionCall
      );

      return {
        content: response.candidates?.[0]?.content?.parts
          ?.filter((part: any) => part.text)
          .map((part: any) => part.text)
          .join('') || '',
        tool_calls: functionCalls?.map((fc: any, idx: number) => ({
          id: `call_${idx}`,
          function: {
            name: fc.functionCall.name,
            arguments: JSON.stringify(fc.functionCall.args)
          }
        })),
        finish_reason: functionCalls?.length ? 'tool_calls' : 'stop',
        usage: {
          prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
          completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: response.usageMetadata?.totalTokenCount || 0
        }
      };
    } catch (error: any) {
      logger.error('GCP Vertex AI error', { error: error.message });
      throw new Error(`GCP Vertex AI failed: ${error.message}`);
    }
  }

  async generateEmbedding(text: string): Promise<EmbeddingResponse> {
    try {
      // Use text-embedding-004 model from Vertex AI
      const model = this.vertexAI.getGenerativeModel({
        model: 'text-embedding-004'
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text }] }]
      });

      // Extract embedding from response
      const embedding = result.response.candidates?.[0]?.content?.parts?.[0]?.embedding || [];

      return {
        embedding,
        usage: {
          total_tokens: result.response.usageMetadata?.totalTokenCount || 0
        }
      };
    } catch (error: any) {
      logger.error('GCP Embedding error', { error: error.message });
      throw new Error(`GCP Embedding failed: ${error.message}`);
    }
  }

  estimateCost(usage: { prompt_tokens: number; completion_tokens: number }): number {
    const pricing = GCPProvider.PRICING[this.config.model as keyof typeof GCPProvider.PRICING];
    if (!pricing) {
      logger.warn(`Unknown pricing for model: ${this.config.model}`);
      return 0;
    }

    const inputCost = (usage.prompt_tokens / 1000) * pricing.input;
    const outputCost = (usage.completion_tokens / 1000) * pricing.output;
    return inputCost + outputCost;
  }

  private convertMessagesToVertexFormat(messages: ChatMessage[]): any[] {
    return messages
      .filter(m => m.role !== 'system') // System messages handled separately in Vertex
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
  }

  private convertToolsToVertexFormat(tools: ToolDefinition[]): any[] {
    return tools.map(tool => ({
      function_declarations: [
        {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters
        }
      ]
    }));
  }
}

/**
 * Factory function to create LLM provider based on configuration
 */
export function createLLMProvider(providerType?: LLMProviderType): LLMProvider {
  const provider = providerType || (process.env.LLM_PROVIDER as LLMProviderType) || 'openai';

  const config: LLMConfig = {
    provider,
    model: provider === 'openai' 
      ? process.env.OPENAI_MODEL || 'gpt-4o'
      : process.env.GCP_MODEL || 'gemini-1.5-pro',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '128000'),
    temperature: 0.7
  };

  logger.info(`Initializing LLM provider: ${provider} with model: ${config.model}`);

  switch (provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'gcp':
      return new GCPProvider(config);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
