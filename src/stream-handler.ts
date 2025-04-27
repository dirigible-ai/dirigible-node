// Stream handling implementation

import { LLMInteraction, LLMProvider } from './types';
import * as logger from './logger';

/**
 * StreamHandler - A class for handling streaming responses from LLM providers
 * Simplifies the processing and logging of streaming responses
 */
export class StreamHandler {
  private content = '';
  private usageData: any = null;
  private finishReason: string | null = null;
  private metadata: Record<string, any>;
  private startTime: number;
  private provider: LLMProvider;
  private request: any;
  private inputTokensFromStart: number | undefined = undefined;
  private interactionId: string | undefined = undefined;
  
  /**
   * Create a new StreamHandler
   * @param provider The LLM provider
   * @param request The original request data
   * @param metadata Metadata to include with logs
   */
  constructor(provider: LLMProvider, request: any, metadata: Record<string, any>) {
    this.provider = provider;
    this.request = request;
    // Create a snapshot of metadata to avoid later modifications affecting it
    this.metadata = { ...metadata };
    this.startTime = Date.now();
    
    // Extract interaction ID from metadata if available
    this.interactionId = metadata.interactionId;
    
    logger.debug(`Created StreamHandler for ${provider} request${this.interactionId ? ` with ID ${this.interactionId}` : ''}`);
  }
  
  /**
   * Process a chunk from the stream
   * @param chunk The chunk to process
   */
  processChunk(chunk: any): void {
    // Extract content and metadata based on provider-specific format
    this.extractContent(chunk);
    this.extractMetadata(chunk);
  }
  
  /**
   * Extract content from a chunk based on provider
   * @param chunk The chunk to process
   */
  private extractContent(chunk: any): void {
    switch (this.provider) {
      case LLMProvider.OPENAI:
        // Regular content delta (chat completions)
        if (chunk.choices?.[0]?.delta?.content) {
          this.content += chunk.choices[0].delta.content;
        }
        
        // Response API format
        if (chunk.type === 'response.output_text.delta' && chunk.delta?.text) {
          this.content += chunk.delta.text;
        }
        break;
        
      case LLMProvider.ANTHROPIC:
        // Content block delta
        if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta' && chunk.delta?.text) {
          this.content += chunk.delta.text;
        } 
        // Content block start
        else if (chunk.type === 'content_block_start' && chunk.content_block?.text) {
          this.content += chunk.content_block.text;
        } 
        // Content block stop
        else if (chunk.type === 'content_block_stop' && chunk.content_block?.text) {
          this.content += chunk.content_block.text;
        }
        break;
        
      case LLMProvider.GEMINI:
        // Extract content from candidates
        if (chunk.candidates?.[0]?.content?.parts) {
          const parts = chunk.candidates[0].content.parts;
          for (const part of parts) {
            if (part.text) {
              this.content += part.text;
            }
          }
        }
        break;
        
      default:
        // For unknown providers, attempt simple extraction
        if (chunk.content) this.content += chunk.content;
        if (chunk.text) this.content += chunk.text;
        break;
    }
  }
  
  /**
   * Extract metadata from a chunk based on provider
   * @param chunk The chunk to process
   */
  private extractMetadata(chunk: any): void {
    switch (this.provider) {
      case LLMProvider.OPENAI:
        // Handle OpenAI's usage chunk (with empty choices array)
        if (Array.isArray(chunk.choices) && 
            chunk.choices.length === 0 && 
            chunk.usage) {
          logger.debug('Found OpenAI usage chunk with token information');
          this.usageData = chunk.usage;
        }
        
        // General usage data (might be in any chunk)
        if (chunk.usage && !this.usageData) {
          this.usageData = chunk.usage;
        }
        
        // Track finish reason
        if (chunk.choices?.[0]?.finish_reason) {
          this.finishReason = chunk.choices[0].finish_reason;
        }
        break;
        
      case LLMProvider.ANTHROPIC:
        // Capture input_tokens from the initial message_start event
        if (chunk.type === 'message_start' && chunk.message?.usage?.input_tokens !== undefined) {
          this.inputTokensFromStart = chunk.message.usage.input_tokens;
          logger.debug(`Captured input_tokens (${this.inputTokensFromStart}) from message_start event`);
        }
        
        // Message stop event
        if (chunk.type === 'message_stop') {
          this.finishReason = 'stop';
        }
        
        // Message delta event might have the final output_tokens
        if (chunk.type === 'message_delta' && chunk.usage) {
          if (!this.usageData) {
            this.usageData = {};
          }
          
          // Merge with any existing usage data
          Object.assign(this.usageData, chunk.usage);
          logger.debug(`Updated usage data from message_delta: ${JSON.stringify(this.usageData)}`);
        }
        
        // Regular usage field
        if (chunk.usage && typeof chunk.usage === 'object') {
          if (!this.usageData) {
            this.usageData = {};
          }
          
          // Merge with any existing usage data
          Object.assign(this.usageData, chunk.usage);
        }
        
        // Also capture initial usage from message object
        if (chunk.message?.usage && typeof chunk.message.usage === 'object') {
          if (!this.usageData) {
            this.usageData = {};
          }
          
          // Merge with any existing usage data
          Object.assign(this.usageData, chunk.message.usage);
        }
        break;
        
      case LLMProvider.GEMINI:
        // Usage metadata
        if (chunk.usageMetadata) {
          this.usageData = chunk.usageMetadata;
        }
        
        // Finish reason
        if (chunk.candidates?.[0]?.finishReason) {
          this.finishReason = chunk.candidates[0].finishReason;
        }
        break;
    }
  }
  
  /**
   * Create the final response object for logging
   * @returns A structured response object in provider-specific format
   */
  createFinalResponse(): any {
    // Build a provider-specific response format
    switch (this.provider) {
      case LLMProvider.OPENAI:
        return {
          id: `chatcmpl-stream-${Date.now()}`,
          model: this.request.model || 'unknown',
          object: "chat.completion.stream",
          choices: [{
            message: {
              content: this.content,
              role: 'assistant'
            },
            finish_reason: this.finishReason || 'stop'
          }],
          usage: this.usageData
        };
      
      case LLMProvider.ANTHROPIC:
        return {
          id: `msg_${Date.now()}`,
          type: "message",
          role: "assistant",
          content: [{
            type: "text",
            text: this.content
          }],
          model: this.request.model || 'anthropic-model',
          usage: this.usageData
        };
      
      case LLMProvider.GEMINI:
        return {
          candidates: [{
            content: {
              parts: [{
                text: this.content
              }],
              role: "model"
            },
            finishReason: this.finishReason
          }],
          usageMetadata: this.usageData,
          modelConfig: {
            model: this.request.model || 'gemini-model'
          }
        };
      
      default:
        // Generic response structure for unknown providers
        return {
          content: this.content,
          model: this.request.model || 'unknown',
          usage: this.usageData
        };
    }
  }
  
  /**
   * Extract token usage information from the accumulated data
   * @returns Object with token counts
   */
  extractTokens(): { input?: number; output?: number; total?: number } {
    // No usage data available
    if (!this.usageData && !this.inputTokensFromStart) return {};
    
    // Extract based on provider format
    switch (this.provider) {
      case LLMProvider.OPENAI:
        return {
          input: this.usageData.prompt_tokens,
          output: this.usageData.completion_tokens,
          total: this.usageData.total_tokens
        };
        
      case LLMProvider.ANTHROPIC:
        // Get input tokens from either the stored initial value or the usage data
        const inputTokens = this.inputTokensFromStart !== undefined ? 
          this.inputTokensFromStart : 
          (this.usageData?.input_tokens);
        
        // Get output tokens from the usage data
        const outputTokens = this.usageData?.output_tokens;
        
        // Calculate total if we have both
        const totalTokens = (inputTokens !== undefined && outputTokens !== undefined) ? 
          inputTokens + outputTokens : undefined;
        
        return {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens
        };
        
      case LLMProvider.GEMINI:
        return {
          input: this.usageData.promptTokenCount,
          output: this.usageData.candidatesTokenCount,
          total: this.usageData.totalTokenCount
        };
        
      default:
        return {};
    }
  }
  
  /**
   * Create the final interaction log
   * @param modelExtractor Function to extract model name
   * @returns The complete interaction log
   */
  createInteractionLog(modelExtractor: (req: any, res: any, provider: LLMProvider) => string): LLMInteraction {
    const response = this.createFinalResponse();
    
    return {
      id: this.interactionId,
      provider: this.provider,
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      model: modelExtractor(this.request, response, this.provider),
      request: this.request,
      response,
      status: 'success',
      tokens: this.extractTokens(),
      metadata: {
        ...this.metadata,
        streamingRequest: true,
        streamFullyProcessed: true,
        contentLength: this.content.length,
        hasUsageData: !!this.usageData || !!this.inputTokensFromStart
      }
    };
  }
  
  /**
   * Get current content accumulated from the stream
   */
  getContent(): string {
    return this.content;
  }
  
  /**
   * Check if usage data was found in the stream
   */
  hasUsageData(): boolean {
    return !!this.usageData || !!this.inputTokensFromStart;
  }
}

/**
 * Create an async iterator wrapper that processes stream chunks
 * @param provider The LLM provider
 * @param originalStream The original stream
 * @param request The original request data
 * @param metadata Metadata to include with logs
 * @param logInteractionFn Function to log the interaction
 * @param modelExtractorFn Function to extract model name
 * @returns A wrapped stream that logs after completion
 */
export function createStreamWrapper(
  provider: LLMProvider,
  originalStream: AsyncIterable<any>,
  request: any,
  metadata: Record<string, any>,
  logInteractionFn: (interaction: LLMInteraction) => Promise<void>,
  modelExtractorFn: (req: any, res: any, provider: LLMProvider) => string
): AsyncIterable<any> {
  return {
    [Symbol.asyncIterator]: async function*() {
      // Create stream handler to process chunks
      const handler = new StreamHandler(provider, request, metadata);
      
      try {
        // Process stream chunks and yield to user
        for await (const chunk of originalStream) {
          handler.processChunk(chunk);
          yield chunk;
        }
      } finally {
        // Stream is complete, log the interaction
        logger.debug(`Stream processing complete for ${provider}, has usage data: ${handler.hasUsageData()}`);
        
        // Log the interaction
        const interaction = handler.createInteractionLog(modelExtractorFn);
        logInteractionFn(interaction).catch(err => {
          logger.error('Error logging stream interaction:', err);
        });
      }
    }
  };
}

/**
 * Process a stream in the background for logging
 * @param provider The LLM provider
 * @param stream The stream to process
 * @param request The original request data
 * @param metadata Metadata to include with logs
 * @param logInteractionFn Function to log the interaction
 * @param modelExtractorFn Function to extract model name
 */
export async function processStreamInBackground(
  provider: LLMProvider,
  stream: AsyncIterable<any>,
  request: any,
  metadata: Record<string, any>,
  logInteractionFn: (interaction: LLMInteraction) => Promise<void>,
  modelExtractorFn: (req: any, res: any, provider: LLMProvider) => string
): Promise<void> {
  try {
    logger.debug(`Processing ${provider} stream in background`);
    
    // Create stream handler
    const handler = new StreamHandler(provider, request, metadata);
    
    // Process the stream
    for await (const chunk of stream) {
      handler.processChunk(chunk);
    }
    
    logger.debug(`Background stream processing complete for ${provider}, has usage data: ${handler.hasUsageData()}`);
    
    // Log the interaction
    const interaction = handler.createInteractionLog(modelExtractorFn);
    await logInteractionFn(interaction);
  } catch (error) {
    logger.error(`Error processing ${provider} stream in background:`, error);
    
    // Extract the interaction ID if available
    const interactionId = metadata.interactionId;
    
    // Log a minimal interaction in case of error
    const interaction: LLMInteraction = {
      id: interactionId,
      provider,
      timestamp: new Date().toISOString(),
      model: modelExtractorFn(request, null, provider),
      request,
      response: {
        model: request.model || `${provider}-model`,
        streaming: true,
        processingError: error instanceof Error ? error.message : String(error)
      },
      status: 'success',
      metadata: {
        ...metadata,
        streamingRequest: true,
        streamProcessingError: true
      }
    };
    
    await logInteractionFn(interaction).catch(err => {
      logger.error('Error logging error interaction:', err);
    });
  }
}
