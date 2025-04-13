// Core types for the LLM observability SDK

import { LogLevel } from './logger';

/**
 * Supported LLM providers
 */
export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GEMINI = 'gemini',
  CUSTOM = 'custom',
}

/**
 * Configuration options for the LLM observability SDK
 */
export interface ObservabilityConfig {
  /**
   * API key for the observability service
   */
  apiKey: string;
  
  /**
   * Base URL for the observability service API
   * @default 'https://api.yourobservability.com'
   */
  apiUrl?: string;
  
  /**
   * Enable or disable logging globally
   * @default true
   */
  enabled?: boolean;
  
  /**
   * Sampling rate for logging (between 0 and 1)
   * 1 = log everything, 0.5 = log 50% of requests, 0 = log nothing
   * @default 1
   */
  samplingRate?: number;
  
  /**
   * Project identifier (for multi-project scenarios)
   */
  projectId?: string;
  
  /**
   * Environment name (e.g., 'production', 'development')
   * @default 'development'
   */
  environment?: string;
  
  /**
   * Whether to automatically track workflows
   * @default true
   */
  trackWorkflows?: boolean;
  
  /**
   * Whether to automatically instrument LLM libraries
   * @default true
   */
  autoInstrument?: boolean;
  
  /**
   * Initial metadata for the automatically created workflow
   */
  workflowMetadata?: Record<string, any>;
  
  /**
   * Logger verbosity level
   * @default LogLevel.INFO
   */
  logLevel?: LogLevel;
  
  /**
   * Logger prefix for console output
   * @default '[Dirigible]'
   */
  logPrefix?: string;
}

/**
 * Base interface for LLM interaction data
 */
export interface LLMInteraction {
  /**
   * LLM provider (OpenAI, Anthropic, etc.)
   */
  provider: LLMProvider;
  
  /**
   * Timestamp when the request was made
   */
  timestamp: string;
  
  /**
   * Duration of the request in milliseconds
   */
  duration?: number;
  
  /**
   * Model used for the request
   */
  model: string;
  
  /**
   * Request data (usually prompt or messages)
   */
  request: any;
  
  /**
   * Response data from the LLM
   */
  response: any;
  
  /**
   * Status of the request
   */
  status: 'success' | 'error';
  
  /**
   * Error message if status is 'error'
   */
  errorMessage?: string;
  
  /**
   * Token usage information
   */
  tokens?: {
    input?: number;
    output?: number;
    total?: number;
  };
  
  /**
   * Custom metadata for the request
   */
  metadata?: Record<string, any>;
}

/**
 * Type for decorator options or function that returns metadata
 */
export type DecoratorInput = Record<string, any> | ((params: any) => Record<string, any>);
