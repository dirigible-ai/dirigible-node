/**
 * Dirigible namespace
 * 
 * This file exports a static class that provides access to all SDK functionality.
 */

import { initialize, getConfig, updateConfig } from './config';
import { LLMProvider } from './types';
import { observeLLM as _observeLLM, logLLMInteraction } from './decorator';
import { 
  getInteractionId, 
  getWorkflowId, 
  generateInteractionId,
  generateArtifactId,
  getArtifactId,
  getCurrentWorkflowArtifactId
} from './elements-ids';
import {
  setGlobalMetadata,
  addGlobalMetadata,
  getGlobalMetadata,
  removeGlobalMetadata,
  clearGlobalMetadata,
  createWorkflow,
  startWorkflow,
  endWorkflow,
  getCurrentWorkflow,
  markWorkflowStep,
  saveArtifact
} from './workflow';
import { observeAIClient as _observeAIClient, patchLLMLibraries, patchIfExists } from './patching';
import { forceFlush } from './api/client';
import { LogLevel, configureLogger } from './logger';
import {
  getInteraction,
  getInteractions,
  getWorkflow,
  getWorkflows,
  getWorkflowInteractions,
  getWorkflowArtifacts,
  getArtifact,
  getArtifacts,
  searchInteractions,
  searchWorkflows
} from './api/data-retrieval';

/**
 * Dirigible namespace
 * 
 * Provides a centralized access point for all SDK functionality
 * while keeping the special functions like observeAIClient and observeLLM
 * available as direct imports for better ergonomics.
 */
export class Dirigible {
  // Configuration

  /**
   * Initialize the SDK with configuration options
   * @param config User configuration options
   * @returns The current configuration
   */
  static initialize = initialize;

  /**
   * Get the current configuration
   * @returns The current configuration
   */
  static getConfig = getConfig;

  /**
   * Update specific configuration options
   * @param config Partial configuration to update
   * @returns The updated configuration
   */
  static updateConfig = updateConfig;
  
  // Logging

  /**
   * Log levels for the SDK
   */
  static LogLevel = LogLevel;

  /**
   * Configure the logger
   * @param config Configuration options
   */
  static configureLogger = configureLogger;
  
  // Workflow management

  /**
   * Create a workflow for grouping related LLM requests
   * @param workflowId Unique identifier for this workflow
   * @param initialMetadata Initial metadata for this workflow
   * @returns An object with methods to manage workflow metadata
   */
  static createWorkflow = createWorkflow;

  /**
   * Start tracking a workflow
   * @param metadata Initial metadata for the workflow
   * @returns The workflow context
   */
  static startWorkflow = startWorkflow;

  /**
   * End the current workflow
   * @param metadata Final metadata to add to the workflow
   */
  static endWorkflow = endWorkflow;

  /**
   * Get the current workflow context (or create one if none exists)
   * @returns The current workflow context
   */
  static getCurrentWorkflow = getCurrentWorkflow;

  /**
   * Mark a step in the workflow
   * @param stepName Name of the step
   * @param metadata Additional metadata for this step
   * @returns The workflow context
   */
  static markWorkflowStep = markWorkflowStep;
  
  // Metadata management

  /**
   * Set global metadata that will be included with all logged requests
   * @param metadata Key-value pairs to include with all requests
   */
  static setGlobalMetadata = setGlobalMetadata;

  /**
   * Add to existing global metadata
   * @param metadata Additional key-value pairs to include
   */
  static addGlobalMetadata = addGlobalMetadata;

  /**
   * Get the current global metadata
   * @returns The current global metadata object
   */
  static getGlobalMetadata = getGlobalMetadata;

  /**
   * Remove specific keys from global metadata
   * @param keys Array of keys to remove
   */
  static removeGlobalMetadata = removeGlobalMetadata;

  /**
   * Clear all global metadata
   */
  static clearGlobalMetadata = clearGlobalMetadata;
  
  // Artifact management

  /**
   * Log an artifact for the current workflow
   * @param name Unique name for this artifact
   * @param value The data to log (will be serialized as JSON)
   * @param options Additional options (type, metadata)
   * @returns The workflow context
   */
  static saveArtifact = saveArtifact;

  /**
   * Generate a unique artifact ID
   * @returns A unique string identifier for an artifact
   */
  static generateArtifactId = generateArtifactId;

  /**
   * Get the ID of the most recent artifact
   * @returns The most recent artifact ID or null if none exists
   */
  static getArtifactId = getArtifactId;

  /**
   * Get the ID of the current workflow's most recent artifact
   * @returns The current workflow's most recent artifact ID or null if none exists
   */
  static getCurrentWorkflowArtifactId = getCurrentWorkflowArtifactId;
  
  // ID management

  /**
   * Get the ID of the most recent interaction
   * @returns The most recent interaction ID or null if none exists
   */
  static getInteractionId = getInteractionId;

  /**
   * Get the ID of the current workflow
   * @returns The current workflow ID or null if no workflow exists
   */
  static getWorkflowId = getWorkflowId;

  /**
   * Generate a unique interaction ID
   * @returns A unique string identifier for an interaction
   */
  static generateInteractionId = generateInteractionId;
  
  // Manual logging

  /**
   * Manually log an LLM interaction
   * @param interaction The LLM interaction data to log
   */
  static logLLMInteraction = logLLMInteraction;

  /**
   * Force immediate sending of all queued logs
   */
  static forceFlush = forceFlush;
  
  // Advanced patching

  /**
   * Patch all supported LLM libraries
   */
  static patchLLMLibraries = patchLLMLibraries;

  /**
   * Attempt to patch a library if it exists in the environment
   */
  static patchIfExists = patchIfExists;
  
  // Data retrieval

  /**
   * Get a single interaction by ID
   * @param interactionId The unique ID of the interaction
   * @returns The interaction
   */
  static getInteraction = getInteraction;

  /**
   * Get multiple interactions with optional filtering
   * @param options Filter and pagination options
   * @returns Paginated interactions with cursor for next page
   */
  static getInteractions = getInteractions;

  /**
   * Get a single workflow by ID
   * @param workflowId The unique ID of the workflow
   * @returns The workflow
   */
  static getWorkflow = getWorkflow;

  /**
   * Get multiple workflows with optional filtering
   * @param options Filter and pagination options
   * @returns Paginated workflows with cursor for next page
   */
  static getWorkflows = getWorkflows;

  /**
   * Get workflow interactions
   * @param workflowId The workflow ID
   * @returns The interactions in the workflow
   */
  static getWorkflowInteractions = getWorkflowInteractions;

  /**
   * Get workflow artifacts
   * @param workflowId The workflow ID
   * @returns The artifacts in the workflow
   */
  static getWorkflowArtifacts = getWorkflowArtifacts;

  /**
   * Get a single artifact by ID
   * @param artifactId The unique ID of the artifact
   * @returns The artifact
   */
  static getArtifact = getArtifact;

  /**
   * Get multiple artifacts with optional filtering
   * @param options Filter and pagination options
   * @returns Paginated artifacts with cursor for next page
   */
  static getArtifacts = getArtifacts;

  /**
   * Search for interactions matching a query
   * @param options Search options including query string, filters, and pagination
   * @returns Paginated search results with cursor for next page
   */
  static searchInteractions = searchInteractions;

  /**
   * Search for workflows matching a query
   * @param options Search options including query string, filters, and pagination
   * @returns Paginated search results with cursor for next page
   */
  static searchWorkflows = searchWorkflows;
  
  // Special client wrappers - also exported directly from index.ts
  
  /**
   * Wrap an AI client with instrumentation
   * @param client The LLM client to observe
   * @param provider Optional provider type (auto-detected if not specified)
   * @returns Instrumented client
   */
  static observeAIClient = _observeAIClient;
  
  /**
   * Create a method decorator for enriching LLM API calls with metadata
   * @param input Metadata to include with the logs or a function that returns metadata
   * @returns A method decorator that enhances LLM interaction logs
   */
  static observeLLM = _observeLLM;
  
  /**
   * Provider types
   */
  static LLMProvider = LLMProvider;
}

// Export special functions for direct imports
export const observeAIClient = _observeAIClient;
export const observeLLM = _observeLLM;
export { LLMProvider };
