// Core library patching implementation for automatic observability

import { LLMInteraction, LLMProvider } from './types';
import { logInteraction } from './api/client';
import { getGlobalMetadata, getCurrentWorkflow } from './workflow';
import { generateInteractionId } from './interaction-ids';
import * as logger from './logger';
import { createStreamWrapper, processStreamInBackground } from './stream-handler';

// Track methods we've already patched to avoid double-patching
const patchedLibraries = new Set<string>();

/**
 * Attempt to patch a library if it exists in the environment
 */
export function patchIfExists(packageName: string, patchFn: Function): void {
  if (patchedLibraries.has(packageName)) return;
  
  try {
    const pkg = require(packageName);
    patchFn(pkg);
    patchedLibraries.add(packageName);
    logger.debug(`Successfully patched library: ${packageName}`);
  } catch (e) {
    // Package not installed or import failed, skip silently
    logger.trace(`Skipped patching library (not available): ${packageName}`);
  }
}

/**
 * Patch all supported LLM libraries
 */
export function patchLLMLibraries(): void {
  logger.debug('Starting to patch LLM libraries');
  patchIfExists('openai', patchOpenAI);
  patchIfExists('@anthropic-ai/sdk', patchAnthropic);
  patchIfExists('@google/genai', patchGoogle);
}

/**
 * Patch the OpenAI library
 */
function patchOpenAI(OpenAIModule: any): void {
  // Check if already patched
  if (OpenAIModule._patched) {
    logger.debug('OpenAI module already patched, skipping');
    return;
  }
  
  logger.debug('Patching OpenAI module');
  
  const originalOpenAI = OpenAIModule.OpenAI;
  
  if (!originalOpenAI) {
    logger.error('Could not find OpenAI constructor in module!');
    return;
  }
  
  // Replace the constructor
  OpenAIModule.OpenAI = function(...args: any[]) {
    logger.debug('Creating instrumented OpenAI client');
    const client = new originalOpenAI(...args);
    const wrappedClient = wrapLLMClient(client, LLMProvider.OPENAI);
    logger.debug('OpenAI client wrapped successfully');
    return wrappedClient;
  };
  
  // Mark as patched to prevent double patching
  OpenAIModule._patched = true;
  logger.debug('OpenAI module patched successfully');
}

/**
 * Patch the Anthropic library
 */
function patchAnthropic(AnthropicModule: any): void {
  // Check if already patched
  if (AnthropicModule._patched) {
    logger.debug('Anthropic module already patched, skipping');
    return;
  }
  
  const originalAnthropic = AnthropicModule.Anthropic;
  
  // Replace the constructor
  AnthropicModule.Anthropic = function(...args: any[]) {
    logger.debug('Creating instrumented Anthropic client');
    const client = new originalAnthropic(...args);
    const wrappedClient = wrapLLMClient(client, LLMProvider.ANTHROPIC);
    logger.debug('Anthropic client wrapped successfully');
    return wrappedClient;
  };
  
  // Mark as patched to prevent double patching
  AnthropicModule._patched = true;
  logger.debug('Anthropic module patched successfully');
}

/**
 * Patch the Google AI library
 */
function patchGoogle(GoogleModule: any): void {
  // Check if already patched
  if (GoogleModule._patched) {
    logger.debug('Google module already patched, skipping');
    return;
  }
  
  const originalGenAI = GoogleModule.GoogleGenAI;
  
  // Replace the constructor
  GoogleModule.GoogleGenAI = function(...args: any[]) {
    logger.debug('Creating instrumented Google client');
    const client = new originalGenAI(...args);
    const wrappedClient = wrapLLMClient(client, LLMProvider.GOOGLE);
    logger.debug('Google client wrapped successfully');
    return wrappedClient;
  };
  
  // Mark as patched to prevent double patching
  GoogleModule._patched = true;
  logger.debug('Google module patched successfully');
}

/**
 * Detect provider from client instance
 */
function detectProvider(client: any): LLMProvider {
  if (!client) return LLMProvider.CUSTOM;
  
  // Check constructor name
  const constructorName = client.constructor?.name?.toLowerCase() || '';
  
  if (constructorName.includes('openai')) return LLMProvider.OPENAI;
  if (constructorName.includes('anthropic')) return LLMProvider.ANTHROPIC;
  if (constructorName.includes('genai') || constructorName.includes('google')) return LLMProvider.GOOGLE;
  
  // Check for known methods/properties
  if (client.chat?.completions?.create) return LLMProvider.OPENAI;
  if (client.messages?.create) return LLMProvider.ANTHROPIC;
  if (client.models?.generateContent) return LLMProvider.GOOGLE;
  
  logger.debug('Could not detect provider, defaulting to CUSTOM');
  return LLMProvider.CUSTOM;
}

/**
 * Wrap an AI client with instrumentation
 * @param client The LLM client to observe
 * @param provider Optional provider type (auto-detected if not specified)
 * @returns Instrumented client
 */
export function observeAIClient<T>(client: T, provider?: LLMProvider): T {
  // Auto-detect provider if not specified
  if (!provider) {
    provider = detectProvider(client);
  }
  
  // Special handling for Google
  if (provider === LLMProvider.GOOGLE) {
    // Check if we've already tried patching Google
    const globalAny = global as any;
    if (globalAny.__dirigibleGooglePatchAttempted !== true) {
      // Mark that we've attempted patching to avoid repeated attempts
      globalAny.__dirigibleGooglePatchAttempted = true;
      
      // Find Google module in require.cache if it exists
      if (require && require.cache) {
        const modulePath = Object.keys(require.cache).find(path => 
          path.includes('@google/genai') || path.includes('genai')
        );
        
        if (modulePath && require.cache[modulePath]) {
          const GoogleModule = require.cache[modulePath].exports;
          if (GoogleModule && !GoogleModule._patched) {
            patchGoogle(GoogleModule);
          }
        }
      }
    }
  }
  
  logger.info(`Observing ${provider} client`);
  return wrapLLMClient(client, provider);
}

/**
 * Methods to ignore when wrapping
 */
const ignoredMethods = new Set([
  'toString', 'valueOf', 'inspect', 'constructor',
  'then', 'catch', 'finally', // Promise methods
  'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 
  'toLocaleString', 'toJSON'
]);

/**
 * Check if a method should be ignored
 */
function shouldIgnoreMethod(methodPath: string): boolean {
  if (methodPath.includes('_')) return true; // Internal methods
  if (ignoredMethods.has(methodPath)) return true;
  
  return false;
}

/**
 * Helper function to get error message safely
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Check if an object is an async iterable (stream)
 */
function isAsyncIterable(obj: any): boolean {
  return obj && typeof obj === 'object' && typeof obj[Symbol.asyncIterator] === 'function';
}

/**
 * Check if the object has a tee method (OpenAI streams)
 */
function hasTeeMethod(obj: any): boolean {
  return obj && typeof obj === 'object' && typeof obj.tee === 'function';
}

/**
 * Wrap an LLM client with a proxy that logs all API calls
 */
function wrapLLMClient(client: any, provider: LLMProvider, basePath: string = ''): any {
  return new Proxy(client, {
    get(target, prop: string | symbol) {
      // Skip symbols
      if (typeof prop !== 'string') {
        return target[prop];
      }
      
      const value = target[prop];
      const currentPath = basePath ? `${basePath}.${prop}` : prop;
      
      // If it's a method
      if (typeof value === 'function') {
        // Skip methods we should ignore
        if (shouldIgnoreMethod(currentPath)) {
          return value;
        }
        
        // Wrap the method
        return function(...args: any[]) {
          const startTime = Date.now();
          const reqData = args[0] || {};
          
          // Extract metadata from any observeLLM decorators
          const metadata = {
            ...getGlobalMetadata(),
            method: currentPath,
          };
          
          // Get current workflow metadata if available
          try {
            const workflow = getCurrentWorkflow();
            Object.assign(metadata, workflow.getMetadata());
          } catch (error) {
            // Ignore errors in workflow handling
            logger.trace(`Error getting workflow metadata for method ${currentPath}:`, error);
          }
          
          try {
            logger.debug(`Calling ${provider} method: ${currentPath}`);
            const result = value.apply(target, args);
            
            // Handle promises
            if (result instanceof Promise) {
              return result.then(
                (response) => {
                  // Generate a unique ID for this interaction
                  const interactionId = generateInteractionId();
                  
                  // Special handling for OpenAI streaming with stream=true parameter
                  if (provider === LLMProvider.OPENAI && reqData.stream === true) {
                    logger.debug('OpenAI streaming request detected');
                    
                    // If the response has the tee method (OpenAI SDK)
                    if (hasTeeMethod(response)) {
                      logger.debug('OpenAI response with tee method detected');
                      
                      try {
                        // Split the stream into two copies
                        const [userStream, loggingStream] = response.tee();
                        
                        // Process the logging copy in the background with the new StreamHandler
                        processStreamInBackground(
                          provider,
                          loggingStream,
                          reqData,
                          {
                            ...metadata,
                            interactionId
                          },
                          logInteraction,
                          extractModel
                        ).catch(err => logger.error('Error in background processing:', err));
                        
                        // Return the user's copy untouched
                        return userStream;
                      } catch (teeError) {
                        logger.error('Error using OpenAI tee method:', teeError);
                        
                        // Log a basic interaction and return the original stream
                        const interaction: LLMInteraction = {
                          id: interactionId,
                          provider,
                          timestamp: new Date().toISOString(),
                          model: extractModel(reqData, null, provider),
                          request: reqData,
                          response: {
                            model: reqData.model || 'openai-model',
                            streaming: true,
                            requestTime: new Date().toISOString(),
                            teeError: getErrorMessage(teeError)
                          },
                          status: 'success',
                          metadata: {
                            ...metadata,
                            streamingRequest: true,
                            teeMethodFailed: true
                          }
                        };
                        
                        logInteraction(interaction);
                        return response;
                      }
                    } else {
                      // For older OpenAI SDK versions or non-standard implementations
                      // Just log the request without trying to process the stream
                      logger.debug('OpenAI streaming request without tee method, logging basic info');
                      
                      const interaction: LLMInteraction = {
                        id: interactionId,
                        provider,
                        timestamp: new Date().toISOString(),
                        model: extractModel(reqData, null, provider),
                        request: reqData,
                        response: {
                          model: reqData.model || 'openai-model',
                          streaming: true,
                          requestTime: new Date().toISOString()
                        },
                        status: 'success',
                        metadata: {
                          ...metadata,
                          streamingRequest: true
                        }
                      };
                      
                      logInteraction(interaction);
                      return response;
                    }
                  }
                  
                  // Check if this is a streaming response for other providers
                  if (isAsyncIterable(response)) {
                    logger.debug(`Streaming response from ${currentPath} - will log after completion`);
                    
                    // Use the new StreamHandler wrapper to process the stream
                    return createStreamWrapper(
                      provider,
                      response,
                      reqData,
                      {
                        ...metadata,
                        interactionId
                      },
                      logInteraction,
                      extractModel
                    );
                  }
                  
                  // Handle regular non-streaming responses
                  logger.debug(`Successful response from ${currentPath}`);
                  const interaction: LLMInteraction = {
                    id: interactionId,
                    provider,
                    timestamp: new Date().toISOString(),
                    duration: Date.now() - startTime,
                    model: extractModel(reqData, response, provider),
                    request: reqData,
                    response,
                    status: 'success',
                    tokens: extractTokens(response, provider),
                    metadata
                  };
                  
                  logInteraction(interaction);
                  return response;
                },
                (error: unknown) => {
                  // Generate a unique ID for this error interaction
                  const interactionId = generateInteractionId();
                  
                  // Log error
                  logger.warn(`Error response from ${currentPath}:`, error);
                  const interaction: LLMInteraction = {
                    id: interactionId,
                    provider,
                    timestamp: new Date().toISOString(),
                    duration: Date.now() - startTime,
                    model: extractModel(reqData, null, provider),
                    request: reqData,
                    response: null,
                    status: 'error',
                    errorMessage: getErrorMessage(error),
                    metadata
                  };
                  
                  logInteraction(interaction);
                  throw error;
                }
              );
            } else {
              // Generate a unique ID for this synchronous interaction
              const interactionId = generateInteractionId();
              
              // Handle synchronous results
              logger.debug(`Synchronous result from ${currentPath}`);
              const interaction: LLMInteraction = {
                id: interactionId,
                provider,
                timestamp: new Date().toISOString(),
                duration: Date.now() - startTime,
                model: extractModel(reqData, result, provider),
                request: reqData,
                response: result,
                status: 'success',
                tokens: extractTokens(result, provider),
                metadata
              };
              
              logInteraction(interaction);
              return result;
            }
          } catch (error: unknown) {
            // Generate a unique ID for this synchronous error
            const interactionId = generateInteractionId();
            
            // Handle synchronous errors
            logger.warn(`Synchronous error in ${currentPath}:`, error);
            const interaction: LLMInteraction = {
              id: interactionId,
              provider,
              timestamp: new Date().toISOString(),
              duration: Date.now() - startTime,
              model: extractModel(reqData, null, provider),
              request: reqData,
              response: null,
              status: 'error',
              errorMessage: getErrorMessage(error),
              metadata
            };
            
            logInteraction(interaction);
            throw error;
          }
        };
      }
      
      // If it's an object, wrap it recursively
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return wrapLLMClient(value, provider, currentPath);
      }
      
      // Otherwise return the original value
      return value;
    }
  });
}

/**
 * Extract model information from request and response
 */
function extractModel(request: any, response: any, provider: LLMProvider): string {
  // Try to get model from request first
  if (request && typeof request === 'object') {
    // Standard model field
    if (request.model) {
      return String(request.model);
    }
    
    // Nested model in message params
    if (request.params?.model) {
      return String(request.params.model);
    }
    
    // Model in OpenAI messages format
    if (request.messages && Array.isArray(request.messages)) {
      if (request.model) {
        return String(request.model);
      }
    }
  }
  
  // Try to get from response next
  if (response && typeof response === 'object') {
    // OpenAI response format
    if (response.model) {
      return String(response.model);
    }
    
    // Anthropic response format
    if (response.type === 'message' && response.model) {
      return String(response.model);
    }
    
    // Google might have model inside candidates
    if (response.candidates && Array.isArray(response.candidates) && response.candidates.length > 0) {
      if (response.candidates[0].modelConfig?.model) {
        return String(response.candidates[0].modelConfig.model);
      }
    }
    
    // Google model config
    if (response.modelConfig?.model) {
      return String(response.modelConfig.model);
    }
  }
  
  // Provider-specific defaults if we couldn't detect
  switch (provider) {
    case LLMProvider.OPENAI:
      return 'openai-model';
    case LLMProvider.ANTHROPIC:
      return 'anthropic-model';
    case LLMProvider.GOOGLE:
      return 'google-model';
    default:
      return 'unknown';
  }
}

/**
 * Extract token usage information from response
 */
function extractTokens(response: any, provider: LLMProvider): { input?: number; output?: number; total?: number } {
  if (!response || typeof response !== 'object') {
    return {};
  }
  
  // Check for usage data based on provider
  switch (provider) {
    case LLMProvider.OPENAI:
      if (response.usage && typeof response.usage === 'object') {
        return {
          input: response.usage.prompt_tokens,
          output: response.usage.completion_tokens,
          total: response.usage.total_tokens
        };
      }
      break;
      
    case LLMProvider.ANTHROPIC:
      if (response.usage && typeof response.usage === 'object') {
        return {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens
        };
      }
      break;
      
    case LLMProvider.GOOGLE:
      if (response.usageMetadata && typeof response.usageMetadata === 'object') {
        return {
          input: response.usageMetadata.promptTokenCount,
          output: response.usageMetadata.candidatesTokenCount,
          total: response.usageMetadata.totalTokenCount
        };
      }
      break;
  }
  
  return {};
}
