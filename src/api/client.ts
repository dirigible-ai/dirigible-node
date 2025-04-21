// Client for communicating with the observability service API

import { getConfig } from '../config';
import { LLMInteraction } from '../types';
import { getGlobalMetadata } from '../workflow';
import * as logger from '../logger';

// Queue for batching requests
let queue: LLMInteraction[] = [];
let flushTimeout: NodeJS.Timeout | null = null;
const MAX_QUEUE_SIZE = 50;
// Flush interval from config
function getFlushInterval(): number {
  const configuredInterval = getConfig().flushInterval || 1000;
  // Minimum of 200ms to prevent excessive network activity
  return Math.max(configuredInterval, 200);
}

/**
 * Transform interaction to match server schema
 */
function transformInteraction(interaction: LLMInteraction): any {
  const tokens = interaction.tokens || {};
  
  // Extract provider from metadata if available
  const provider = interaction.metadata?.provider || interaction.provider;
  
  // Extract model from response data if not already set
  let model = interaction.model;
  if (model === 'unknown' && interaction.response?.model) {
    model = interaction.response.model;
  }
  
  // Extract tokens from response usage if not already extracted
  let tokensInput = tokens.input;
  let tokensOutput = tokens.output;
  let tokensTotal = tokens.total;
  
  // Try to get tokens from response_data.usage if not already present
  if ((!tokensInput || !tokensOutput || !tokensTotal) && 
      interaction.response?.usage) {
    const usage = interaction.response.usage;
    tokensInput = tokensInput || usage.prompt_tokens;
    tokensOutput = tokensOutput || usage.completion_tokens;
    tokensTotal = tokensTotal || usage.total_tokens;
    
    // Handle Anthropic format which uses different field names
    if (!tokensInput) tokensInput = usage.input_tokens;
    if (!tokensOutput) tokensOutput = usage.output_tokens;
    if (!tokensTotal && tokensInput && tokensOutput) {
      tokensTotal = tokensInput + tokensOutput;
    }
  }
  
  // Extract method information
  const method = interaction.metadata?.method || 'unknown';
  
  // Extract workflow metadata
  const workflowId = interaction.metadata?.workflowId;
  
  // Create a workflow_metadata object with workflow-specific fields and global metadata
  let workflowMetadata: Record<string, any> = {
    // Include global metadata in workflow metadata
    ...getGlobalMetadata(),
    // Include the user-defined workflowMetadata from initialization
    ...(getConfig().workflowMetadata || {})
  };
  
  if (interaction.metadata) {
    // Copy workflow-specific metadata fields
    const metadataCopy = {...interaction.metadata};
    
    // Fields that should be considered workflow metadata
    const workflowFields = [
      'workflowId', 'workflowType', 'workflowStartTime', 'workflowEndTime', 'createdAt',
      'sdkVersion', 'environment', 'projectId', 'initTimestamp', 'restartAttempt'
    ];
    
    // Extract workflow metadata fields
    workflowFields.forEach(field => {
      if (field in metadataCopy) {
        workflowMetadata[field] = metadataCopy[field];
      }
    });
    
    // Also include any fields with workflow-related prefixes
    Object.keys(metadataCopy).forEach(key => {
      if (key.startsWith('workflow') || key.startsWith('step:')) {
        workflowMetadata[key] = metadataCopy[key];
      }
    });
  }
  
  logger.trace(`Transforming interaction for model: ${model}, method: ${method}`);
  
  return {
    provider: provider,
    environment: interaction.metadata?.environment || getConfig().environment || 'development',
    workflow_id: workflowId,
    model: model,
    timestamp: interaction.timestamp,
    duration_ms: interaction.duration,
    method_path: method,
    request_data: interaction.request,
    response_data: interaction.response,
    status: interaction.status,
    error_message: interaction.errorMessage,
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
    tokens_total: tokensTotal,
    workflow_metadata: Object.keys(workflowMetadata).length > 0 ? workflowMetadata : undefined,
    metadata: interaction.metadata
  };
}

/**
 * Log an LLM interaction to the observability service
 * @param data LLM interaction data
 */
export async function logInteraction(data: LLMInteraction): Promise<void> {
  const config = getConfig();
  
  // Skip if logging is disabled
  if (!config.enabled) {
    logger.debug('Logging is disabled, skipping interaction log');
    return;
  }
  
  // Add to queue for potential batching
  queue.push(data);
  logger.debug(`Added interaction to queue (${queue.length}/${MAX_QUEUE_SIZE})`);
  
  // Schedule flush if not already scheduled
  if (!flushTimeout) {
    const interval = getFlushInterval();
    logger.trace(`Scheduling flush in ${interval}ms`);
    flushTimeout = setTimeout(() => flush(), interval);
  }
  
  // Flush immediately if queue is large enough
  if (queue.length >= MAX_QUEUE_SIZE) {
    logger.debug(`Queue size reached threshold (${queue.length}), flushing immediately`);
    flush();
  }
}

/**
 * Send queued logs to the observability service
 */
export async function flush(): Promise<void> {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  
  if (queue.length === 0) {
    logger.trace('No interactions to flush');
    return;
  }
  
  const config = getConfig();
  const queueSize = queue.length;
  logger.debug(`Flushing ${queueSize} interaction(s)`);
  
  // Transform interactions to match server schema
  const transformedLogs = queue.map(transformInteraction);
  queue = [];
  
  try {
    // Send to API
    const apiUrl = `${config.apiUrl}/logs`;
    logger.debug(`Sending logs to API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        'X-Project-ID': config.projectId || 'default',
        'X-Environment': config.environment || 'development',
      },
      body: JSON.stringify({ logs: transformedLogs }),
    });
    
    if (!response.ok) {
      logger.error(`Failed to send logs: ${response.status} ${response.statusText}`);
    } else {
      logger.debug(`Successfully sent ${queueSize} interaction(s) to API`);
    }
  } catch (error) {
    logger.error('Error sending logs to observability service:', error);
  }
}

/**
 * Force immediate sending of all queued logs
 */
export async function forceFlush(): Promise<void> {
  logger.debug('Force flushing logs');
  return flush();
}
