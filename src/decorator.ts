// Core decorator implementation for LLM observability

import { DecoratorInput, LLMInteraction, LLMProvider } from './types';
import { shouldLog, getConfig } from './config';
import { logInteraction } from './api/client';
import { getGlobalMetadata, addGlobalMetadata, removeGlobalMetadata, getWorkflow } from './workflow';
import * as logger from './logger';

/**
 * Detect the LLM provider based on client instance and request parameters
 */
function detectProvider(params: any, context: any): LLMProvider {
  // 1. Check if the provider was explicitly specified in decorator metadata
  if (context?.metadata?.provider) {
    return context.metadata.provider;
  }
  
  // 2. Look for model name - this is the most reliable indicator
  if (params && typeof params === 'object') {
    const modelName = params.model?.toLowerCase() || '';
    
    // OpenAI models follow consistent naming patterns
    if (modelName.startsWith('gpt-') || 
        modelName.includes('davinci') || 
        modelName.includes('curie') || 
        modelName.includes('babbage') ||
        modelName.includes('ada') ||
        modelName.startsWith('o3-') || 
        modelName.startsWith('text-') ||
        modelName.includes('gpt4')) {
      return LLMProvider.OPENAI;
    }
    
    // Claude models always include 'claude' in the name
    if (modelName.includes('claude')) {
      return LLMProvider.ANTHROPIC;
    }
    
    // Gemini models include 'gemini'
    if (modelName.includes('gemini')) {
      return LLMProvider.GEMINI;
    }
  }
  
  // 3. Check constructor name if available (reliable for class instances)
  if (context && typeof context === 'object') {
    const constructorName = context.constructor?.name?.toLowerCase() || '';
    if (constructorName.includes('openai')) return LLMProvider.OPENAI;
    if (constructorName.includes('anthropic')) return LLMProvider.ANTHROPIC;
    if (constructorName.includes('genai') || constructorName.includes('gemini')) return LLMProvider.GEMINI;
  }
  
  // Default to CUSTOM if detection fails
  return LLMProvider.CUSTOM;
}

/**
 * Extract token usage based on the provider and response structure
 */
function extractTokens(provider: LLMProvider, response: any): { input?: number; output?: number; total?: number } {
  if (!response || typeof response !== 'object') return {};
  
  switch (provider) {
    case LLMProvider.OPENAI:
      // OpenAI format from inspect-model-responses.ts
      if (response.usage && typeof response.usage === 'object') {
        return {
          input: typeof response.usage.prompt_tokens === 'number' ? response.usage.prompt_tokens : undefined,
          output: typeof response.usage.completion_tokens === 'number' ? response.usage.completion_tokens : undefined,
          total: typeof response.usage.total_tokens === 'number' ? response.usage.total_tokens : undefined
        };
      }
      break;
      
    case LLMProvider.ANTHROPIC:
      // Anthropic format from inspect-model-responses.ts
      if (response.usage && typeof response.usage === 'object') {
        const inputTokens = typeof response.usage.input_tokens === 'number' ? response.usage.input_tokens : undefined;
        const outputTokens = typeof response.usage.output_tokens === 'number' ? response.usage.output_tokens : undefined;
        
        // Calculate total if both input and output are available
        const totalTokens = (typeof inputTokens === 'number' && typeof outputTokens === 'number') 
          ? inputTokens + outputTokens 
          : undefined;
        
        return {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens
        };
      }
      break;
      
    case LLMProvider.GEMINI:
      // Gemini format
      if (response.usage && typeof response.usage === 'object') {
        return {
          input: typeof response.usage.promptTokenCount === 'number' ? response.usage.promptTokenCount : undefined,
          output: typeof response.usage.candidatesTokenCount === 'number' ? response.usage.candidatesTokenCount : undefined,
          total: typeof response.usage.totalTokenCount === 'number' ? response.usage.totalTokenCount : undefined
        };
      }
      
      // Some Gemini responses have token info directly on candidates
      if (response.candidates && Array.isArray(response.candidates) && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.tokenCount) {
          return {
            output: candidate.tokenCount
          };
        }
      }
      break;
  }
  
  return {};
}

/**
 * Extract model information from the request parameters
 */
function extractModel(params: any): string {
  if (!params || typeof params !== 'object') return 'unknown';
  
  // Check for model property
  if ('model' in params && params.model) {
    return typeof params.model === 'string' ? params.model : String(params.model);
  }
  
  // Handle nested model in OpenAI's chat.completions.create structure
  if (params.messages && Array.isArray(params.messages) && params.messages.length > 0) {
    // This might be a chat completion - look for model elsewhere
    if ('model_name' in params) return String(params.model_name);
    if ('engine' in params) return String(params.engine);
  }
  
  return 'unknown';
}

/**
 * Safely execute a metadata function with error handling
 */
function safelyGetMetadata(metadataInput: DecoratorInput, params: any): Record<string, any> {
  try {
    // Handle function-based metadata
    if (typeof metadataInput === 'function') {
      // Ensure params is an object before passing to user-defined function
      const safeParams = (params && typeof params === 'object') ? params : {};
      const result = metadataInput(safeParams);
      
      // Ensure result is an object
      return (result && typeof result === 'object' && !Array.isArray(result)) 
        ? result 
        : {};
    } 
    // Handle object-based metadata
    else if (metadataInput && typeof metadataInput === 'object' && !Array.isArray(metadataInput)) {
      return metadataInput;
    } 
    // Default empty metadata
    else {
      return {};
    }
  } catch (error) {
    logger.warn('Error generating metadata:', error);
    return { metadataError: String(error) };
  }
}

/**
 * Create a method decorator for enriching LLM API calls with metadata
 * This works with both auto-instrumented clients and manual logging
 * 
 * @param input Metadata to include with the logs or a function that returns metadata
 * @returns A method decorator that enhances LLM interaction logs
 */
export function observeLLM(input: DecoratorInput = {}) {
  return function(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      // Check if we should log this request based on sampling rate
      if (!shouldLog()) {
        return originalMethod.apply(this, args);
      }
      
      const params = args[0] || {};
      
      try {
        // Generate metadata safely
        const customMetadata = safelyGetMetadata(input, params);
        
        // Add metadata to global context (will be picked up by auto-instrumentation)
        addGlobalMetadata({
          ...customMetadata,
          methodName: propertyKey,
          decoratedCall: true
        });
        
        logger.debug(`Executing decorated method: ${propertyKey}`);
        
        // Make the actual call (auto-instrumentation will log it if enabled)
        const startTime = Date.now();
        const result = await originalMethod.apply(this, args);
        
        // If auto-instrumentation is disabled, manually log the interaction
        const config = getConfig();
        if (config.autoInstrument === false) {
          // Get the current workflow if available
          let workflowMetadata = {};
          if (config.trackWorkflows !== false) {
            try {
              const workflow = getWorkflow();
              workflowMetadata = workflow.getMetadata();
            } catch (error) {
              // Ignore errors in workflow handling
              logger.trace('Error accessing workflow metadata:', error);
            }
          }
          
          // Detect provider and extract tokens
          const provider = detectProvider(params, this);
          const model = extractModel(params);
          const tokens = extractTokens(provider, result);
          
          logger.debug(`Manually logging decorated call to ${model} (${provider})`);
          
          // Log the interaction manually
          const interaction: LLMInteraction = {
            provider,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            model,
            request: params,
            response: result,
            status: 'success',
            tokens,
            metadata: {
              ...getGlobalMetadata(),
              ...workflowMetadata,
              methodName: propertyKey,
              decoratedCall: true
            }
          };
          
          logInteraction(interaction).catch(err => {
            logger.error('Failed to log LLM interaction:', err);
          });
        }
        
        // Clean up temporary metadata
        const metadataToRemove = [
          ...Object.keys(customMetadata),
          'methodName',
          'decoratedCall'
        ];
        removeGlobalMetadata(metadataToRemove);
        
        return result;
      } catch (error: any) {
        // Clean up any metadata we added even if there's an error
        const customMetadata = safelyGetMetadata(input, params);
        const metadataToRemove = [
          ...Object.keys(customMetadata),
          'methodName',
          'decoratedCall'
        ];
        removeGlobalMetadata(metadataToRemove);
        
        logger.error(`Error in decorated method ${propertyKey}:`, error);
        
        // If auto-instrumentation is disabled, manually log the error
        const config = getConfig();
        if (config.autoInstrument === false) {
          // Calculate duration for errors
          const provider = detectProvider(params, this);
          const model = extractModel(params);
          
          // Get workflow metadata if available
          let workflowMetadata = {};
          if (config.trackWorkflows !== false) {
            try {
              const workflow = getWorkflow();
              workflowMetadata = workflow.getMetadata();
            } catch (e) {
              // Ignore errors in workflow handling
              logger.trace('Error accessing workflow metadata during error handling:', e);
            }
          }
          
          // Create error interaction
          const errorInteraction: LLMInteraction = {
            provider,
            timestamp: new Date().toISOString(),
            model,
            request: params,
            response: null,
            status: 'error',
            errorMessage: error.message || String(error),
            metadata: {
              ...getGlobalMetadata(),
              ...workflowMetadata,
              methodName: propertyKey,
              decoratedCall: true
            }
          };
          
          // Log error
          logInteraction(errorInteraction).catch(err => {
            logger.error('Failed to log LLM error interaction:', err);
          });
        }
        
        // Re-throw the original error
        throw error;
      }
    };
    
    return descriptor;
  };
}

/**
 * Manually log an LLM interaction
 * 
 * This can be used for cases where the decorator pattern doesn't fit
 * or for custom logging needs.
 * 
 * @param interaction The LLM interaction data to log
 */
export function logLLMInteraction(interaction: Partial<LLMInteraction> & { 
  model: string;
  request: any;
  response: any;
}): Promise<void> {
  logger.debug(`Manually logging LLM interaction for model: ${interaction.model}`);
  
  // Auto-detect provider if not specified
  const provider = interaction.provider || detectProvider(interaction.request, null);
  
  // Get workflow metadata if tracking is enabled
  const config = getConfig();
  let workflowMetadata = {};
  
  if (config.trackWorkflows !== false) {
    try {
      const workflow = getWorkflow();
      workflowMetadata = workflow.getMetadata();
    } catch (error) {
      // Ignore errors in workflow handling for manual logging
      logger.trace('Error accessing workflow metadata during manual logging:', error);
    }
  }
  
  const fullInteraction: LLMInteraction = {
    provider,
    timestamp: new Date().toISOString(),
    status: 'success',
    ...interaction,
    metadata: {
      ...getGlobalMetadata(),
      ...workflowMetadata,
      ...(interaction.metadata || {}),
      manuallyLogged: true
    }
  };
  
  // Auto-extract tokens if not provided
  if (!fullInteraction.tokens) {
    fullInteraction.tokens = extractTokens(provider, interaction.response);
  }
  
  return logInteraction(fullInteraction);
}
