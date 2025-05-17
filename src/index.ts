/**
 * Main export file for the Dirigible SDK
 * 
 * This file exports both the Dirigible namespace and individual exports.
 */

// Import Dirigible class
import { Dirigible as DirigibleClass } from './dirigible';
export { observeAIClient, observeLLM } from './dirigible';
export { LLMProvider } from './types';

// Export Dirigible as both default and named export
export const Dirigible = DirigibleClass;
// Support import Dirigible from '@dirigible-ai/sdk'
export default DirigibleClass;

// Re-export everything individually for backward compatibility
// Configuration exports
export { initialize, getConfig, updateConfig } from './config';

// Type exports
export { ObservabilityConfig, LLMInteraction, DecoratorInput } from './types';

// Decorator exports
export { logLLMInteraction } from './decorator';

// Interaction and artifact ID exports
export { getInteractionId, getWorkflowId, generateInteractionId, generateArtifactId, getArtifactId, getCurrentWorkflowArtifactId } from './elements-ids';

// Workflow, metadata and artifact exports
export {
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

// Manual patching export (for advanced use cases)
export { patchLLMLibraries, patchIfExists } from './patching';

// API utilities
export { forceFlush } from './api/client';

// Logger exports
export { LogLevel, configureLogger } from './logger';

// Data access API exports
export {
  getInteraction,
  getInteractions,
  getWorkflow,
  getWorkflows,
  getWorkflowInteractions,
  getWorkflowArtifacts,
  getArtifact,
  getArtifacts,
  searchInteractions,
  searchWorkflows,
  searchArtifacts
} from './api/data-retrieval';
