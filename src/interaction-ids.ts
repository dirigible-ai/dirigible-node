// ID management

import * as logger from './logger';
import { getWorkflow } from './workflow';

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
    const workflow = getWorkflow();
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
