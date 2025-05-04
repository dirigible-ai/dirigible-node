// Data retrieval APIs

import { getConfig } from '../config';
import * as logger from '../logger';
import { 
  LLMInteraction, 
  AIWorkflow, 
  Artifact, 
  InteractionFilter, 
  WorkflowFilter,
  ApiResponse,
  ApiCollectionResponse,
  ApiRelationshipResponse,
  ApiErrorResponse,
  DataRetrievalOptions,
  InteractionResponseWithExports,
  WorkflowInteractionsResponseWithExports,
  ArtifactResponseWithExports,
  InteractionsCollectionWithExports,
  ArtifactsCollectionWithExports
} from '../types';

/**
 * Transform snake_case object keys to camelCase
 * @param obj Object with snake_case keys
 * @returns Object with camelCase keys
 */
function transformResponseToCamelCase(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(transformResponseToCamelCase);
  }
  
  const camelCaseObj: Record<string, any> = {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      camelCaseObj[camelKey] = transformResponseToCamelCase(obj[key]);
    }
  }
  
  return camelCaseObj;
}

/**
 * Transform camelCase object keys to snake_case
 * @param obj Object with camelCase keys
 * @returns Object with snake_case keys
 */
function transformCamelToSnakeCase(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(transformCamelToSnakeCase);
  }
  
  const snakeCaseObj: Record<string, any> = {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Convert camelCase to snake_case
      const snakeKey = key.replace(/([A-Z])/g, (letter) => `_${letter.toLowerCase()}`);
      snakeCaseObj[snakeKey] = transformCamelToSnakeCase(obj[key]);
    }
  }
  
  return snakeCaseObj;
}

/**
 * Process API response to standardized format
 * @param response Raw API response
 * @returns Standardized response object
 */
function processApiResponse<T>(response: any): ApiResponse<T> & { markdown?: string, json?: string } {
  // Handle error responses
  if (response.error) {
    const errorResponse = response as ApiErrorResponse;
    throw new Error(`API Error: ${errorResponse.error.code} - ${errorResponse.error.message}`);
  }

  // Create the base response
  const apiResponse: ApiResponse<T> & { markdown?: string, json?: string } = {
    data: transformResponseToCamelCase(response.data),
    meta: transformResponseToCamelCase(response.meta || {})
  };
  
  // Add markdown if present
  if (response.markdown) {
    apiResponse.markdown = response.markdown;
  }
  
  // Add JSON if present
  if (response.json) {
    apiResponse.json = response.json;
  }
  
  return apiResponse;
}

/**
 * Process collection API response to standardized format
 * @param response Raw API response
 * @returns Standardized collection response object
 */
function processCollectionResponse<T>(response: any): ApiCollectionResponse<T> & { markdown?: string, json?: string } {
  // Handle error responses
  if (response.error) {
    const errorResponse = response as ApiErrorResponse;
    throw new Error(`API Error: ${errorResponse.error.code} - ${errorResponse.error.message}`);
  }

  // Process the data, retaining any markdown/json properties on individual items
  const processedData = response.data ? response.data.map((item: any) => {
    const processed = transformResponseToCamelCase(item);
    
    // Preserve markdown/json if present on the item
    if (item.markdown) processed.markdown = item.markdown;
    if (item.json) processed.json = item.json;
    
    return processed;
  }) : [];

  // Create the base response
  const apiResponse: ApiCollectionResponse<T> & { markdown?: string, json?: string } = {
    data: processedData as T[],
    meta: transformResponseToCamelCase(response.meta || {})
  };
  
  // Add collection-level markdown if present
  if (response.markdown) {
    apiResponse.markdown = response.markdown;
  }
  
  // Add collection-level JSON if present
  if (response.json) {
    apiResponse.json = response.json;
  }
  
  return apiResponse;
}

/**
 * Process relationship API response to standardized format
 * @param response Raw API response
 * @returns Standardized relationship response object
 */
function processRelationshipResponse<T, R>(response: any): ApiRelationshipResponse<T, R> & { markdown?: string, json?: string } {
  // Handle error responses
  if (response.error) {
    const errorResponse = response as ApiErrorResponse;
    throw new Error(`API Error: ${errorResponse.error.code} - ${errorResponse.error.message}`);
  }

  // Process the data, handling the possibility of items with markdown/json properties
  const processedData = { ...transformResponseToCamelCase(response.data || {}) };
  
  // Special handling for 'interactions' array if present to preserve markdown/json
  if (response.data && response.data.interactions && Array.isArray(response.data.interactions)) {
    const processedInteractions = response.data.interactions.map((item: any) => {
      const processed = transformResponseToCamelCase(item);
      
      // Preserve markdown/json if present on the item
      if (item.markdown) processed.markdown = item.markdown;
      if (item.json) processed.json = item.json;
      
      return processed;
    });
    
    (processedData as any).interactions = processedInteractions;
  }

  // Create the base response
  const apiResponse: ApiRelationshipResponse<T, R> & { markdown?: string, json?: string } = {
    data: processedData as T & R,
    meta: transformResponseToCamelCase(response.meta || {})
  };
  
  // Add markdown if present
  if (response.markdown) {
    apiResponse.markdown = response.markdown;
  }
  
  // Add JSON if present
  if (response.json) {
    apiResponse.json = response.json;
  }
  
  return apiResponse;
}

/**
 * Get a single interaction by ID
 * @param interactionId The unique ID of the interaction
 * @param options Optional export format options
 * @returns The interaction, optionally with formatted content
 * @throws Error if interaction not found or request fails
 */
export async function getInteraction(
  interactionId: string, 
  options?: DataRetrievalOptions
): Promise<InteractionResponseWithExports> {
  const config = getConfig();
  
  try {
    logger.debug(`Fetching interaction: ${interactionId}`);
    
    // Build the URL with options if needed
    const url = `${config.apiUrl}/data/interactions/${interactionId}?projectId=${config.projectId || 'default'}`;
    
    // Add options as query parameters if needed
    const urlWithOptions = new URL(url);
    if (options?.includeMarkdown) urlWithOptions.searchParams.append('includeMarkdown', 'true');
    if (options?.includeJson) urlWithOptions.searchParams.append('includeJson', 'true');
    
    const response = await fetch(urlWithOptions.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Interaction not found: ${interactionId}`);
      }
      
      const errorText = await response.text();
      logger.error(`Error fetching interaction: ${response.status} ${errorText}`);
      throw new Error(`Failed to fetch interaction: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return processApiResponse<LLMInteraction>(data) as InteractionResponseWithExports;
  } catch (error) {
    logger.error('Error in getInteraction:', error);
    throw error;
  }
}

/**
 * Get multiple interactions with optional filtering
 * @param options Filter and pagination options
 * @returns Paginated interactions with cursor for next page
 */
export async function getInteractions(options: {
  filters?: InteractionFilter,
  limit?: number,
  cursor?: string,
  includeMarkdown?: boolean,
  includeJson?: boolean
} = {}): Promise<InteractionsCollectionWithExports> {
  const config = getConfig();
  const { filters = {}, limit = 50, cursor, includeMarkdown, includeJson } = options;
  
  try {
    logger.debug(`Fetching interactions with filters: ${JSON.stringify(filters)}`);
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    
    // Add project ID (required)
    queryParams.append('projectId', config.projectId || 'default');
    
    // Add pagination parameters
    queryParams.append('limit', String(limit));
    
    // Calculate offset from cursor if provided
    const offset = cursor ? parseInt(atob(cursor), 10) : 0;
    queryParams.append('offset', String(offset));
    
    // Add individual filter parameters directly
    if (filters.environment) queryParams.append('environment', filters.environment);
    if (filters.provider) queryParams.append('provider', filters.provider);
    if (filters.model) queryParams.append('model', filters.model);
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);
    if (filters.interactionId) queryParams.append('interaction_id', filters.interactionId);
    
    // Handle metadata - automatically JSON stringify if it's an object
    if (filters.metadata) {
      const metadataStr = typeof filters.metadata === 'string' 
        ? filters.metadata 
        : JSON.stringify(filters.metadata);
      queryParams.append('metadata', metadataStr);
    }
    
    // Add export format options
    if (includeMarkdown) queryParams.append('includeMarkdown', 'true');
    if (includeJson) queryParams.append('includeJson', 'true');
    
    const response = await fetch(`${config.apiUrl}/data/interactions?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Error fetching interactions: ${response.status} ${errorText}`);
      throw new Error(`Failed to fetch interactions: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return processCollectionResponse<LLMInteraction>(data) as InteractionsCollectionWithExports;
  } catch (error) {
    logger.error('Error in getInteractions:', error);
    throw error;
  }
}

/**
 * Search for interactions matching a query
 * @param options Search options including query string, filters, and pagination
 * @returns Paginated search results with cursor for next page
 */
export async function searchInteractions(options: {
  query: string,
  filters?: InteractionFilter,
  limit?: number,
  cursor?: string,
  includeMarkdown?: boolean,
  includeJson?: boolean
} = { query: '' }): Promise<InteractionsCollectionWithExports> {
  const config = getConfig();
  const { query, filters = {}, limit = 50, cursor, includeMarkdown, includeJson } = options;
  
  try {
    logger.debug(`Searching interactions with query: "${query}"`);
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    
    // Add project ID (required)
    queryParams.append('projectId', config.projectId || 'default');
    
    // Add search query
    queryParams.append('query', query);
    
    // Add pagination parameters - ensure limit is passed as a string
    queryParams.append('limit', String(limit));
    
    // Add offset from cursor if provided
    const offset = cursor ? parseInt(atob(cursor), 10) : 0;
    queryParams.append('offset', String(offset));
    
    // Convert camelCase filter keys to snake_case for API
    const apiFilters = transformCamelToSnakeCase(filters);
    
    // Add filter parameters as JSON
    if (Object.keys(apiFilters).length > 0) {
      queryParams.append('filters', JSON.stringify(apiFilters));
    }
    
    // Add export format options
    if (includeMarkdown) queryParams.append('includeMarkdown', 'true');
    if (includeJson) queryParams.append('includeJson', 'true');
      
    const response = await fetch(`${config.apiUrl}/data/search/interactions?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Error searching interactions: ${response.status} ${errorText}`);
      throw new Error(`Failed to search interactions: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return processCollectionResponse<LLMInteraction>(data) as InteractionsCollectionWithExports;
  } catch (error) {
    logger.error('Error in searchInteractions:', error);
    throw error;
  }
}

/**
 * Get a single workflow by ID
 * @param workflowId The unique ID of the workflow
 * @returns The workflow
 * @throws Error if workflow not found or request fails
 */
export async function getWorkflow(workflowId: string): Promise<ApiResponse<AIWorkflow>> {
  const config = getConfig();
  
  try {
    logger.debug(`Fetching workflow: ${workflowId}`);
    
    const response = await fetch(`${config.apiUrl}/data/workflows/${workflowId}/summary?projectId=${config.projectId || 'default'}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }
      
      const errorText = await response.text();
      logger.error(`Error fetching workflow: ${response.status} ${errorText}`);
      throw new Error(`Failed to fetch workflow: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return processApiResponse<AIWorkflow>(data);
  } catch (error) {
    logger.error('Error in getWorkflow:', error);
    throw error;
  }
}

/**
 * Get multiple workflows with optional filtering
 * @param options Filter and pagination options
 * @returns Paginated workflows with cursor for next page
 */
export async function getWorkflows(options: {
  filters?: WorkflowFilter,
  limit?: number,
  cursor?: string
} = {}): Promise<ApiCollectionResponse<AIWorkflow>> {
  const config = getConfig();
  const { filters = {}, limit = 50, cursor } = options;
  
  try {
    logger.debug(`Fetching workflows with filters: ${JSON.stringify(filters)}`);
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    
    // Add project ID (required)
    queryParams.append('projectId', config.projectId || 'default');
    
    // Add pagination parameters
    queryParams.append('limit', String(limit));
    
    // Calculate offset from cursor if provided
    const offset = cursor ? parseInt(atob(cursor), 10) : 0;
    queryParams.append('offset', String(offset));
    
    // Add individual filter parameters directly
    if (filters.environment) queryParams.append('environment', filters.environment);
    if (filters.workflowType) queryParams.append('workflowType', filters.workflowType);
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);
    
    // Handle metadata - automatically JSON stringify if it's an object
    if (filters.metadata) {
      const metadataStr = typeof filters.metadata === 'string' 
        ? filters.metadata 
        : JSON.stringify(filters.metadata);
      queryParams.append('metadata', metadataStr);
    }
    
    const response = await fetch(`${config.apiUrl}/data/workflows?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Error fetching workflows: ${response.status} ${errorText}`);
      throw new Error(`Failed to fetch workflows: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return processCollectionResponse<AIWorkflow>(data);
  } catch (error) {
    logger.error('Error in getWorkflows:', error);
    throw error;
  }
}

/**
 * Search for workflows matching a query
 * @param options Search options including query string, filters, and pagination
 * @returns Paginated search results with cursor for next page
 */
export async function searchWorkflows(options: {
  query: string,
  filters?: WorkflowFilter,
  limit?: number,
  cursor?: string
} = { query: '' }): Promise<ApiCollectionResponse<AIWorkflow>> {
  const config = getConfig();
  const { query, filters = {}, limit = 50, cursor } = options;
  
  try {
    logger.debug(`Searching workflows with query: "${query}"`);
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    
    // Add project ID (required)
    queryParams.append('projectId', config.projectId || 'default');
    
    // Add search query
    queryParams.append('query', query);
    
    // Add pagination parameters - ensure limit is passed as a string
    queryParams.append('limit', String(limit));
    
    // Add offset from cursor if provided
    const offset = cursor ? parseInt(atob(cursor), 10) : 0;
    queryParams.append('offset', String(offset));
    
    // Convert camelCase filter keys to snake_case for API
    const apiFilters = transformCamelToSnakeCase(filters);
    
    // Add filter parameters as JSON
    if (Object.keys(apiFilters).length > 0) {
      queryParams.append('filters', JSON.stringify(apiFilters));
    }
      
    const response = await fetch(`${config.apiUrl}/data/search/workflows?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Error searching workflows: ${response.status} ${errorText}`);
      throw new Error(`Failed to search workflows: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return processCollectionResponse<AIWorkflow>(data);
  } catch (error) {
    logger.error('Error in searchWorkflows:', error);
    throw error;
  }
}

/**
 * Get workflow interactions
 * @param workflowId The workflow ID
 * @param options Optional export format options
 * @returns The interactions in the workflow, optionally with formatted content
 */
export async function getWorkflowInteractions(
  workflowId: string, 
  options?: DataRetrievalOptions
): Promise<WorkflowInteractionsResponseWithExports> {
  const config = getConfig();
  
  try {
    logger.debug(`Fetching interactions for workflow: ${workflowId}`);
    
    // Build the URL with options if needed
    const url = `${config.apiUrl}/data/workflows/${workflowId}?projectId=${config.projectId || 'default'}`;
    
    // Add options as query parameters if needed
    const urlWithOptions = new URL(url);
    if (options?.includeMarkdown) urlWithOptions.searchParams.append('includeMarkdown', 'true');
    if (options?.includeJson) urlWithOptions.searchParams.append('includeJson', 'true');
    
    const response = await fetch(urlWithOptions.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Error fetching workflow interactions: ${response.status} ${errorText}`);
      throw new Error(`Failed to fetch workflow interactions: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return processRelationshipResponse<{workflow: AIWorkflow | null}, {interactions: LLMInteraction[]}>(data) as WorkflowInteractionsResponseWithExports;
  } catch (error) {
    logger.error('Error in getWorkflowInteractions:', error);
    throw error;
  }
}

/**
 * Get workflow artifacts
 * @param workflowId The workflow ID
 * @param options Optional export format options
 * @returns The artifacts in the workflow, optionally with formatted content
 */
export async function getWorkflowArtifacts(
  workflowId: string,
  options?: DataRetrievalOptions
): Promise<ArtifactsCollectionWithExports> {
  const config = getConfig();
  
  try {
    logger.debug(`Fetching artifacts for workflow: ${workflowId}`);
    
    // Build the URL with options if needed
    const url = `${config.apiUrl}/data/workflows/${workflowId}/artifacts?projectId=${config.projectId || 'default'}`;
    
    // Add options as query parameters if needed
    const urlWithOptions = new URL(url);
    if (options?.includeMarkdown) urlWithOptions.searchParams.append('includeMarkdown', 'true');
    if (options?.includeJson) urlWithOptions.searchParams.append('includeJson', 'true');
    
    const response = await fetch(urlWithOptions.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Error fetching workflow artifacts: ${response.status} ${errorText}`);
      throw new Error(`Failed to fetch workflow artifacts: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return processCollectionResponse<Artifact>(data) as ArtifactsCollectionWithExports;
  } catch (error) {
    logger.error('Error in getWorkflowArtifacts:', error);
    throw error;
  }
}

/**
 * Get a single artifact by ID
 * @param artifactId The unique ID of the artifact
 * @param options Optional export format options
 * @returns The artifact, optionally with formatted content
 * @throws Error if artifact not found or request fails
 */
export async function getArtifact(
  artifactId: string,
  options?: DataRetrievalOptions
): Promise<ArtifactResponseWithExports> {
  const config = getConfig();
  
  try {
    logger.debug(`Fetching artifact: ${artifactId}`);
    
    // Build the URL with options if needed
    const url = `${config.apiUrl}/data/artifacts/${artifactId}?projectId=${config.projectId || 'default'}`;
    
    // Add options as query parameters if needed
    const urlWithOptions = new URL(url);
    if (options?.includeMarkdown) urlWithOptions.searchParams.append('includeMarkdown', 'true');
    if (options?.includeJson) urlWithOptions.searchParams.append('includeJson', 'true');
    
    const response = await fetch(urlWithOptions.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Artifact not found: ${artifactId}`);
      }
      
      const errorText = await response.text();
      logger.error(`Error fetching artifact: ${response.status} ${errorText}`);
      throw new Error(`Failed to fetch artifact: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return processApiResponse<Artifact>(data) as ArtifactResponseWithExports;
  } catch (error) {
    logger.error('Error in getArtifact:', error);
    throw error;
  }
}
