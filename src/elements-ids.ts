// ID management

import * as logger from './logger';
import { getCurrentWorkflow } from './workflow';

// Store the most recent interaction ID
let lastInteractionId: string | null = null;

/**
 * Generate a unique interaction ID
 * @returns A unique string identifier for an interaction
 */
export function generateInteractionId(): string {
  const id = `int-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  lastInteractionId = id;
  return id;
}

/**
 * Get the ID of the most recent interaction
 * @returns The most recent interaction ID or null if none exists
 */
export function getInteractionId(): string | null {
  return lastInteractionId;
}

/**
 * Get the ID of the current workflow
 * @returns The current workflow ID or null if no workflow exists
 */
export function getWorkflowId(): string | null {
  try {
    const workflow = getCurrentWorkflow();
    return workflow.id;
  } catch (error) {
    logger.warn('Failed to get workflow ID:', error);
    return null;
  }
}

/**
 * Reset the last interaction ID (mainly for testing)
 */
export function resetInteractionId(): void {
  lastInteractionId = null;
}

// Store the most recent artifact ID
let lastArtifactId: string | null = null;

/**
 * Generate a unique artifact ID
 * @returns A unique string identifier for an artifact
 */
export function generateArtifactId(): string {
  const id = `art-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  lastArtifactId = id;
  return id;
}

/**
 * Get the ID of the most recent artifact
 * @returns The most recent artifact ID or null if none exists
 */
export function getArtifactId(): string | null {
  return lastArtifactId;
}

/**
 * Get the ID of the current workflow's most recent artifact
 * @returns The current workflow's most recent artifact ID or null if none exists
 */
export function getCurrentWorkflowArtifactId(): string | null {
  try {
    const workflow = getCurrentWorkflow();
    if (workflow._artifacts && workflow._artifacts.length > 0) {
      return workflow._artifacts[workflow._artifacts.length - 1].artifact_id || null;
    }
    return null;
  } catch (error) {
    logger.warn('Failed to get workflow artifact ID:', error);
    return null;
  }
}

/**
 * Reset the last artifact ID (mainly for testing)
 */
export function resetArtifactId(): void {
  lastArtifactId = null;
}
