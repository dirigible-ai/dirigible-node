// Configuration management for the LLM observability SDK

import { ObservabilityConfig } from './types';
import { patchLLMLibraries } from './patching';
import * as logger from './logger';
import { startWorkflow } from './workflow';

// Default configuration
const DEFAULT_CONFIG: ObservabilityConfig = {
  apiKey: '',
  apiUrl: 'https://api.dirigible.ai/v1',
  enabled: true,
  samplingRate: 1,
  environment: 'development',
  trackWorkflows: true,
  autoInstrument: true,
  logLevel: logger.LogLevel.INFO,
  logPrefix: '[Dirigible]',
  flushInterval: 1000
};

// Global configuration instance
let globalConfig: ObservabilityConfig = { ...DEFAULT_CONFIG };

/**
 * Initialize the SDK with configuration options
 * @param config User configuration options
 * @returns The current configuration
 */
export function initialize(config: Partial<ObservabilityConfig>): ObservabilityConfig {
  // Configure the logger first so we can use it during initialization
  if (config.logLevel !== undefined || config.logPrefix !== undefined) {
    logger.configureLogger({
      level: config.logLevel !== undefined ? config.logLevel : DEFAULT_CONFIG.logLevel,
      prefix: config.logPrefix !== undefined ? config.logPrefix : DEFAULT_CONFIG.logPrefix
    });
  }
  
  if (!config.apiKey) {
    logger.warn('LLM Observability SDK initialized without an API key. Logging will be disabled.');
    return { ...globalConfig, enabled: false };
  }
  
  globalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Patch LLM libraries unless explicitly disabled
  if (globalConfig.autoInstrument !== false) {
    logger.debug('Auto-instrumenting LLM libraries');
    patchLLMLibraries();
  }
  
  // Start a workflow synchronously unless explicitly disabled
  if (globalConfig.trackWorkflows !== false) {
    try {
      logger.debug('Starting automatic workflow tracking');
      startWorkflow({
        sdkVersion: '1.0.0', // Add SDK version
        initTimestamp: new Date().toISOString(),
        projectId: globalConfig.projectId || 'default',
        environment: globalConfig.environment || 'development',
        // Allow user-provided metadata for the workflow
        ...(globalConfig.workflowMetadata || {})
      });
    } catch (error) {
      // Ensure workflow tracking errors don't affect core functionality
      logger.error('Failed to start workflow tracking:', error);
    }
  }
  
  logger.info(`Dirigible SDK initialized for project: ${globalConfig.projectId || 'default'}, environment: ${globalConfig.environment}`);
  
  return globalConfig;
}

/**
 * Get the current configuration
 * @returns The current configuration
 */
export function getConfig(): ObservabilityConfig {
  return { ...globalConfig };
}

/**
 * Update specific configuration options
 * @param config Partial configuration to update
 * @returns The updated configuration
 */
export function updateConfig(config: Partial<ObservabilityConfig>): ObservabilityConfig {
  const previousLogLevel = globalConfig.logLevel;
  const previousLogPrefix = globalConfig.logPrefix;
  
  globalConfig = { ...globalConfig, ...config };
  
  // Update logger configuration if log settings changed
  if (config.logLevel !== undefined || config.logPrefix !== undefined) {
    logger.configureLogger({
      level: config.logLevel !== undefined ? config.logLevel : previousLogLevel,
      prefix: config.logPrefix !== undefined ? config.logPrefix : previousLogPrefix
    });
    
    logger.debug('Logger configuration updated');
  }
  
  return globalConfig;
}

/**
 * Check if logging should occur based on sampling rate
 * @returns Boolean indicating if this request should be logged
 */
export function shouldLog(): boolean {
  if (!globalConfig.enabled) return false;
  if (globalConfig.samplingRate === 1) return true;
  if (globalConfig.samplingRate === 0) return false;
  
  return Math.random() < (globalConfig.samplingRate || 1);
}
