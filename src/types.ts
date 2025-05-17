// Core types for the SDK

import { LogLevel } from './logger';

/**
 * Supported LLM providers
 */
export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  CUSTOM = 'custom',
}

/**
 * Configuration options for the SDK
 */
export interface ObservabilityConfig {
  /**
   * API key for the observability service
   */
  apiKey: string;
  
  /**
   * Base URL for the observability service API
   * @default 'https://api.dirigible.ai'
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
  workflowTracking?: boolean;
  
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

  /**
   * Interval in milliseconds between automatic flushes of the log queue
   * @default 1000
   */
  flushInterval?: number;
}

/**
 * Base interface for LLM interaction data
 */
export interface LLMInteraction {
  /**
   * Unique identifier for this interaction
   */
  id?: string;
  
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
  
  /**
   * Optional labels for categorizing and filtering
   */
  labels?: Record<string, any>;
  
  /**
   * Optional Markdown formatted version of the interaction
   */
  markdown?: string;
  
  /**
   * Optional Markdown formatted version of just the request
   */
  requestMarkdown?: string;
  
  /**
   * Optional Markdown formatted version of just the response
   */
  responseMarkdown?: string;
  
  /**
   * Optional JSON formatted version of the interaction
   */
  json?: string;
}

/**
 * Type for decorator options or function that returns metadata
 */
export type DecoratorInput = Record<string, any> | ((params: any) => Record<string, any>);


// Types for data retrieval API

/**
 * AI Workflow data structure (camelCase)
 */
export interface AIWorkflow {
  workflowId: string;
  projectId: string;
  environment: string;
  workflowType: string;
  startedAt: string;
  lastUpdated: string;
  metadata: Record<string, any>;
  labels?: Record<string, any>;
  totalInteractions: number;
  errorCount: number;
  totalTokens: number;
  totalDurationMs: number;
  firstInteraction: string;
  lastInteraction: string;
}

/**
 * Artifact data structure (camelCase)
 */
export interface Artifact {
  id: string;
  workflowId: string;
  projectId: string;
  name: string;
  type: string;
  value: any;
  metadata: Record<string, any>;
  labels?: Record<string, any>;
  timestamp: string;
  createdAt: string;
  
  /**
   * Optional Markdown formatted version of the artifact
   */
  markdown?: string;
  
  /**
   * Optional JSON formatted version of the artifact
   */
  json?: string;
}

/**
 * Pagination parameters using cursor-based pagination
 */
export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

/**
 * Interaction filter options (camelCase)
 */
export interface InteractionFilter {
  environment?: string;
  provider?: string;
  model?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  interactionId?: string;
  metadata?: string | Record<string, any>; // Accept both string and object
  labels?: string | Record<string, any>; // Accept both string and object
  datasetId?: string;
  toolName?: string;
}

/**
 * Artifact filter options
 */
export interface ArtifactFilter {
  environment?: string;
  name?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  workflowId?: string;
  metadata?: string | Record<string, any>; // Accept both string and object
  labels?: string | Record<string, any>; // Accept both string and object
  datasetId?: string;
}

/**
 * Workflow filter options (camelCase)
 */
export interface WorkflowFilter {
  environment?: string;
  workflowType?: string;
  startDate?: string;
  endDate?: string;
  metadata?: string | Record<string, any>; // Accept both string and object
  labels?: string | Record<string, any>; // Accept both string and object
  datasetId?: string;
  status?: string; // Support status:error filtering
}

/**
 * Standard API response metadata
 */
export interface ResponseMetadata {
  /**
   * Timestamp of when the response was generated
   */
  timestamp: string;
  
  /**
   * Additional metadata properties
   */
  [key: string]: any;
}

/**
 * Pagination metadata for collections
 */
export interface PaginationMetadata {
  /**
   * Total number of items available
   */
  total: number;
  
  /**
   * Number of items per page
   */
  limit: number;
  
  /**
   * Cursor for the next page of results
   */
  nextCursor?: string;
  
  /**
   * Whether there are more results available
   */
  hasMore: boolean;
}

/**
 * Standard API response wrapper for single resources
 */
export interface ApiResponse<T> {
  /**
   * The resource data
   */
  data: T;
  
  /**
   * Metadata about the response
   */
  meta: ResponseMetadata;
}

/**
 * Standard API response wrapper for collections
 */
export interface ApiCollectionResponse<T> {
  /**
   * The collection of resources
   */
  data: T[];
  
  /**
   * Metadata about the response, including pagination info
   */
  meta: ResponseMetadata & {
    pagination: PaginationMetadata;
  };
}

/**
 * Standard API response wrapper for relationships
 */
export interface ApiRelationshipResponse<T, R> {
  /**
   * The relationship data
   */
  data: T & R;
  
  /**
   * Metadata about the response
   */
  meta: ResponseMetadata;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  /**
   * Error details
   */
  error: {
    /**
     * Error code
     */
    code: string;
    
    /**
     * Human-readable error message
     */
    message: string;
    
    /**
     * Additional error details
     */
    details?: any;
  };
  
  /**
   * Metadata about the error response
   */
  meta: ResponseMetadata;
}

/**
 * Options for data retrieval methods
 */
export interface DataRetrievalOptions {
  /**
   * Include Markdown formatted version in the response
   */
  includeMarkdown?: boolean;
  
  /**
   * Include JSON formatted version in the response
   */
  includeJson?: boolean;
}

/**
 * Extended response for interaction with export formats
 */
export interface InteractionResponseWithExports extends ApiResponse<LLMInteraction> {
  /**
   * Markdown formatted version of the interaction
   */
  markdown?: string;
  
  /**
   * Request part only in Markdown format
   */
  requestMarkdown?: string;
  
  /**
   * Response part only in Markdown format
   */
  responseMarkdown?: string;
  
  /**
   * JSON formatted version of the interaction
   */
  json?: string;
}

/**
 * Extended response for workflow interactions with export formats
 */
export interface WorkflowInteractionsResponseWithExports extends ApiRelationshipResponse<{workflow: AIWorkflow | null}, {interactions: LLMInteraction[]}> {
  /**
   * Markdown formatted version of the workflow with interactions
   */
  markdown?: string;
  
  /**
   * Request parts only in Markdown format
   */
  requestMarkdown?: string;
  
  /**
   * Response parts only in Markdown format
   */
  responseMarkdown?: string;
  
  /**
   * JSON formatted version of the workflow with interactions
   */
  json?: string;
}

/**
 * Extended response for artifact with export formats
 */
export interface ArtifactResponseWithExports extends ApiResponse<Artifact> {
  /**
   * Markdown formatted version of the artifact
   */
  markdown?: string;
  
  /**
   * JSON formatted version of the artifact
   */
  json?: string;
}

/**
 * Extended response for interactions collection with export formats
 */
export interface InteractionsCollectionWithExports extends ApiCollectionResponse<LLMInteraction> {
  /**
   * Markdown formatted version of the interactions collection
   */
  markdown?: string;
  
  /**
   * Collection of requests in Markdown format
   */
  requestMarkdown?: string;
  
  /**
   * Collection of responses in Markdown format
   */
  responseMarkdown?: string;
  
  /**
   * JSON formatted version of the interactions collection
   */
  json?: string;
}

/**
 * Extended response for artifacts collection with export formats
 */
export interface ArtifactsCollectionWithExports extends ApiCollectionResponse<Artifact> {
  /**
   * Markdown formatted version of the artifacts collection
   */
  markdown?: string;
  
  /**
   * JSON formatted version of the artifacts collection
   */
  json?: string;
}
