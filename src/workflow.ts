// Workflow management for LLM requests

import * as logger from './logger';

/**
 * Global metadata that will be attached to all requests
 */
let globalMetadata: Record<string, any> = {};

/**
 * Active workflow for automatic tracking
 */
let activeWorkflow: ReturnType<typeof createWorkflow> | null = null;

/**
 * Set global metadata that will be included with all logged requests
 * @param metadata Key-value pairs to include with all requests
 */
export function setGlobalMetadata(metadata: Record<string, any>): void {
  logger.debug('Setting global metadata');
  globalMetadata = { ...metadata };
}

/**
 * Add to existing global metadata
 * @param metadata Additional key-value pairs to include
 */
export function addGlobalMetadata(metadata: Record<string, any>): void {
  logger.debug('Adding to global metadata');
  globalMetadata = { ...globalMetadata, ...metadata };
}

/**
 * Get the current global metadata
 * @returns The current global metadata object
 */
export function getGlobalMetadata(): Record<string, any> {
  return { ...globalMetadata };
}

/**
 * Remove specific keys from global metadata
 * @param keys Array of keys to remove
 */
export function removeGlobalMetadata(keys: string[]): void {
  if (!Array.isArray(keys) || keys.length === 0) return;
  
  logger.trace(`Removing keys from global metadata: ${keys.join(', ')}`);
  
  const newMetadata = { ...globalMetadata };
  
  for (const key of keys) {
    delete newMetadata[key];
  }
  
  globalMetadata = newMetadata;
}

/**
 * Clear all global metadata
 */
export function clearGlobalMetadata(): void {
  logger.debug('Clearing all global metadata');
  globalMetadata = {};
}

/**
 * Create a workflow for grouping related LLM requests
 * This allows tracking conversation history or multi-step processes
 * 
 * @param workflowId Unique identifier for this workflow
 * @param initialMetadata Initial metadata for this workflow
 * @returns An object with methods to manage workflow metadata
 */
export function createWorkflow(workflowId: string, initialMetadata: Record<string, any> = {}) {
  logger.debug(`Creating workflow: ${workflowId}`);
  
  let workflowMetadata: Record<string, any> = {
    workflowId,
    ...initialMetadata,
    createdAt: new Date().toISOString(),
  };
  
  // Array for artifacts
  let artifacts: Array<any> = [];
  
  return {
    /**
     * Get the workflow ID
     */
    get id(): string {
      return workflowId;
    },
    
    /**
     * Internal property to store artifacts
     */
    _artifacts: artifacts,
    
    /**
     * Add metadata to this workflow
     */
    addMetadata(metadata: Record<string, any>): void {
      logger.trace(`Adding metadata to workflow ${workflowId}`);
      workflowMetadata = { ...workflowMetadata, ...metadata };
    },
    
    /**
     * Get the current metadata for this workflow
     */
    getMetadata(): Record<string, any> {
      return { ...workflowMetadata };
    },
    
    /**
     * Create a metadata object for a specific LLM request within this workflow
     * @param requestMetadata Additional metadata specific to this request
     */
    forRequest(requestMetadata: Record<string, any> = {}): Record<string, any> {
      return {
        ...this.getMetadata(),
        ...requestMetadata,
        requestTimestamp: new Date().toISOString()
      };
    }
  };
}

/**
 * Generate a unique ID for workflows
 * @returns A unique string identifier
 */
function generateUniqueId(): string {
  return `wf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Start tracking a workflow
 * @param metadata Initial metadata for the workflow
 * @returns The workflow context
 */
export function startWorkflow(metadata: Record<string, any> = {}): ReturnType<typeof createWorkflow> {
  if (activeWorkflow) {
    logger.debug('Workflow already exists, adding restart metadata');
    activeWorkflow.addMetadata({
      restartAttempt: new Date().toISOString(),
      ...metadata
    });
    return activeWorkflow;
  }
  
  const workflowId = generateUniqueId();
  logger.info(`Starting new workflow: ${workflowId}`);
  
  activeWorkflow = createWorkflow(workflowId, {
    workflowStartTime: new Date().toISOString(),
    workflowType: 'automatic',
    ...metadata
  });
  
  return activeWorkflow;
}

/**
 * End the current workflow
 * @param metadata Final metadata to add to the workflow
 */
export function endWorkflow(metadata: Record<string, any> = {}): void {
  if (!activeWorkflow) {
    logger.warn('Attempted to end workflow, but no active workflow exists');
    return;
  }
  
  logger.info(`Ending workflow: ${activeWorkflow.id}`);
  activeWorkflow.addMetadata({
    workflowEndTime: new Date().toISOString(),
    ...metadata
  });
  
  // Force flush logs to ensure everything is sent
  logger.debug('Flushing logs for ended workflow');
  import('./api/client').then(({ forceFlush }) => forceFlush())
    .catch(error => logger.error('Failed to flush logs:', error));
}

/**
 * Get the current workflow context (or create one if none exists)
 * @returns The current workflow context
 */
export function getWorkflow(): ReturnType<typeof createWorkflow> {
  if (!activeWorkflow) {
    logger.debug('No active workflow, creating one automatically');
    return startWorkflow();
  }
  return activeWorkflow;
}

/**
 * Log an artifact for the current workflow
 * Artifacts are stored separately from workflow metadata
 * 
 * @param name Unique name for this artifact
 * @param value The data to log (will be serialized as JSON)
 * @param options Additional options (type, metadata)
 * @returns The workflow context
 */
export function saveArtifact(
  name: string, 
  value: any, 
  options?: { type?: string; metadata?: Record<string, any> }
): ReturnType<typeof createWorkflow> | undefined {
  try {
    const workflow = getWorkflow();
    
    // Create artifact data
    const artifactData = {
      name,
      value,
      type: options?.type || 'default',
      timestamp: new Date().toISOString(),
      metadata: options?.metadata || {}
    };
    
    // Store artifacts in a private property on the workflow object
    if (!workflow._artifacts) {
      workflow._artifacts = [artifactData];
    } else {
      // Update existing artifact or add new one
      const existingIndex = workflow._artifacts.findIndex(a => a.name === name);
      if (existingIndex >= 0) {
        workflow._artifacts[existingIndex] = artifactData;
      } else {
        workflow._artifacts.push(artifactData);
      }
    }
    
    logger.debug(`Logged artifact "${name}" to workflow ${workflow.id}`);
    return workflow;
  } catch (error) {
    logger.error(`Error logging artifact "${name}":`, error);
    return undefined;
  }
}

/**
 * Mark a step in the workflow
 * @param stepName Name of the step
 * @param metadata Additional metadata for this step
 * @returns The workflow context
 */
export function markWorkflowStep(stepName: string, metadata: Record<string, any> = {}): ReturnType<typeof createWorkflow> {
  const workflow = getWorkflow();
  logger.debug(`Marking workflow step: ${stepName}`);
  
  workflow.addMetadata({
    [`step:${stepName}`]: {
      timestamp: new Date().toISOString(),
      ...metadata
    }
  });
  return workflow;
}
