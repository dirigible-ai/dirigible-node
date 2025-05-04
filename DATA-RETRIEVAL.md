# Data retrieval API

Dirigible provides a set of data retrieval functions that allow you to fetch, search, and analyze your logged AI interactions and workflows. This makes it possible to retrieve data for analytics, in-context learning, finetuning or integrate Dirigible's data with your existing monitoring systems.

## Table of Contents

- [Introduction](#introduction)
- [Setup](#setup)
- [Core concepts](#core-concepts)
  - [Workflows](#workflows)
  - [Interactions](#interactions)
  - [Artifacts](#artifacts)
- [Retrieving interactions](#retrieving-interactions)
  - [Get a single interaction](#get-a-single-interaction)
  - [Get multiple interactions](#get-multiple-interactions)
  - [Search interactions](#search-interactions)
- [Retrieving workflows](#retrieving-workflows)
  - [Get a single workflow](#get-a-single-workflow)
  - [Get multiple workflows](#get-multiple-workflows)
  - [Get workflow interactions](#get-workflow-interactions)
  - [Get workflow artifacts](#get-workflow-artifacts)
  - [Search workflows](#search-workflows)
- [Retrieving artifacts](#retrieving-artifacts)
  - [Get an artifact](#get-an-artifact)
- [Filtering by metadata](#filtering-by-metadata)
- [Response format](#response-format)
- [Export formats](#export-formats)
  - [Available export options](#available-export-options)
  - [Retrieving an interaction with exports](#retrieving-an-interaction-with-exports)
  - [Retrieving workflow interactions with exports](#retrieving-workflow-interactions-with-exports)
  - [Export format structures](#export-format-structures)
- [Pagination](#pagination)
- [Error handling](#error-handling)
- [Examples](#examples)
  - [Getting data for in-context learning](#getting-data-for-in-context-learning)
  - [Preparing data for finetuning](#preparing-data-for-finetuning)
  - [Exporting data for analysis](#exporting-data-for-analysis)

## Introduction

The data retrieval API provides programmatic access to all the data that Dirigible captures about your AI applications. This powerful capability enables you to:

- Create in-context learning pipelines by retrieving similar historical interactions
- Build high-quality datasets for fine-tuning custom models with your production data
- Export structured interaction data in markdown or JSON formats for documentation
- Develop custom dashboards with your own analytics and visualizations
- Integrate with your existing monitoring and observability stack

All API functions return properly typed responses and support TypeScript out of the box. Pagination is handled through a cursor-based approach to ensure consistent results when fetching multiple pages.

## Setup

When using the data retrieval API in analytics mode, you should initialize Dirigible with `workflowTracking: false` to disable automatic workflow creation since you're only reading data:

```typescript
import Dirigible from '@dirigible-ai/sdk';

// Initialize for data retrieval
Dirigible.initialize({
  apiKey: process.env.DIRIGIBLE_API_KEY || 'your-api-key',
  projectId: process.env.DIRIGIBLE_PROJECT_ID || 'your-project-id',
  workflowTracking: false  // disable tracking in analytics mode
});
```

This ensures your analytics scripts don't create new workflows in your data. When retrieving data for a workflow in production, you can initialize without this parameter.

## Core concepts

### Workflows

A workflow represents a logically connected series of AI interactions, typically corresponding to a single user session or a discrete AI-powered task. Workflows have unique IDs, metadata, and contain zero or more interactions and artifacts.

### Interactions

An interaction represents a single exchange with an AI provider, such as a prompt to OpenAI's GPT-4o or a message to Anthropic's Claude. Interactions include the complete request and response data, as well as performance metrics like token usage and latency.

### Artifacts

Artifacts are data objects saved during a workflow that provide context for the AI interactions. These could be vector search results, intermediary calculation results, or any other data you choose to save. Artifacts help provide a complete picture of your AI system's behavior.

## Retrieving interactions

Interactions can be retrieved individually or in collections, with optional Markdown and JSON exports.

### Get a single interaction

Retrieve a specific interaction by its ID, with optional Markdown and JSON exports:

```typescript
import Dirigible from '@dirigible-ai/sdk';

// Get this interaction with export formats
const response = await Dirigible.getInteraction('int-1746094401615-z2ljxcm', {
  includeMarkdown: true,  // Get Markdown version
  includeJson: true       // Get JSON version
});

// Access the interaction data
const interaction = response.data;
console.log(`Model: ${interaction.model}`);
console.log(`Status: ${interaction.status}`);
console.log(`Input tokens: ${interaction.tokens.input}`);

// Access the export formats
if (response.markdown) {
  console.log('Markdown available for documentation');
  // Use for in-context learning, analytics...
}

if (response.json) {
  console.log('JSON available for structured access');
  const parsedData = JSON.parse(response.json);
  // Use for data processing, training...
}
```

This returns the complete interaction data, including request, response, and all metadata.

### Get multiple interactions

Retrieve multiple interactions with optional filtering:

```typescript
import Dirigible from '@dirigible-ai/sdk';

// Get interactions with optional filters
const response = await Dirigible.getInteractions({
  filters: {
    provider: 'openai',     // Filter by provider
    model: 'gpt-4o',        // Filter by model
    status: 'success',      // Filter by status (success/error)
    startDate: '2025-04-01', // Filter by date range
    metadata: {
      task: 'generate_final_response', // Filter by custom metadata
      userId: 'user-123',
      quality_score: { $gte: 0.8 }    // Use operators for numeric values
    }
  },
  limit: 50,                // Limit results (default: 50)
  includeMarkdown: true,    // Get Markdown for all interactions
  includeJson: true         // Get JSON for all interactions
});

const interactions = response.data;
const pagination = response.meta.pagination;
console.log(`Found ${pagination.total} interactions, showing ${interactions.length}`);

// Access the first interaction
const firstInteraction = interactions[0];
console.log(`Model: ${firstInteraction.model}`);

// Access exports for individual interactions
if (firstInteraction.markdown) {
  console.log('Individual interaction markdown available:');
  console.log(firstInteraction.markdown);
  // Use for documentation, in-context learning...
}

if (firstInteraction.json) {
  console.log('Individual interaction JSON available:');
  const parsedData = JSON.parse(firstInteraction.json);
  // Use for data processing, training...
}

// The complete collection is also available as a single document
if (response.markdown) {
  console.log('All interactions as one document available');
  // Use for documentation of the entire collection
}
```

Pagination with cursor:

```typescript
// Continue from previous example
if (pagination.hasMore) {
  const nextPageResponse = await Dirigible.getInteractions({
    limit: 50,
    cursor: pagination.nextCursor
  });
  // Process next page...
}
```

### Search interactions

Search across interactions with a text query and optional filters:

```typescript
import Dirigible from '@dirigible-ai/sdk';

// Search for interactions containing "classification error"
const response = await Dirigible.searchInteractions({
  query: 'classification error',  // Text to search for
  filters: {
    provider: 'anthropic',        // Additional filters
    startDate: '2025-04-01',
    metadata: {                   // Filter by custom metadata
      task: 'classify_input',
      importance: 'high',
      accuracy: { $lt: 0.9 }      // Find lower accuracy classifications
    }
  },
  limit: 50,
  includeMarkdown: true,          // Get formatted results
  includeJson: true               // Get structured results
});

const searchResults = response.data;
const pagination = response.meta.pagination;
console.log(`Found ${pagination.total} matching interactions`);

// Process search results
for (const interaction of searchResults) {
  console.log(`Model: ${interaction.model} - ${interaction.status}`);
  
  // Access exports for individual search results
  if (interaction.markdown) {
    console.log(`Markdown for interaction ${interaction.id} available`);
    // Each search result has its own formatted version
  }
  
  if (interaction.json) {
    console.log(`JSON for interaction ${interaction.id} available`);
    // Process structured data for this specific result
  }
}

// The complete search results collection is also available as a single document
if (response.markdown) {
  console.log('All search results as one document available');
  // Use for documentation of all results together
}
```

## Retrieving workflows

Workflows can be retrieved individually or in collections, with related interactions and artifacts. Export formats are available for comprehensive documentation.

### Get a single workflow

Retrieve a specific workflow by its ID:

```typescript
import Dirigible from '@dirigible-ai/sdk';

const workflowId = 'wf-1746094392583-bvur8lw';
const response = await Dirigible.getWorkflow(workflowId);

const workflow = response.data;
console.log(`Started: ${workflow.startedAt}`);
console.log(`Interactions: ${workflow.totalInteractions}`);
console.log(`Total tokens: ${workflow.totalTokens}`);
```

### Get multiple workflows

Retrieve multiple workflows with optional filtering:

```typescript
import Dirigible from '@dirigible-ai/sdk';

// Get workflows with optional filters
const response = await Dirigible.getWorkflows({
  filters: {
    environment: 'production',      // Filter by environment
    workflowType: 'conversation',   // Filter by type
    startDate: '2025-04-01',        // Filter by date range
    metadata: {                     // Filter by custom metadata
      sessionType: 'customer_onboarding',
      completed: true
    }
  },
  limit: 20
});

const workflows = response.data;
const pagination = response.meta.pagination;
console.log(`Found ${pagination.total} workflows, showing ${workflows.length}`);

// Process workflows
for (const workflow of workflows) {
  console.log(`Interactions: ${workflow.totalInteractions}`);
}
```

Pagination with cursor:

```typescript
// Continue from previous example
if (pagination.hasMore) {
  const nextPageResponse = await Dirigible.getWorkflows({
    limit: 20,
    cursor: pagination.nextCursor
  });
  // Process next page...
}
```

### Get workflow interactions

Retrieve all interactions that belong to a specific workflow, with optional Markdown and JSON exports:

```typescript
import Dirigible from '@dirigible-ai/sdk';

const workflowId = 'wf-1746094392583-bvur8lw';
const response = await Dirigible.getWorkflowInteractions(workflowId, {
  includeMarkdown: true,  // Get Markdown version
  includeJson: true       // Get JSON version
});

const { workflow, interactions } = response.data;
console.log(`Found ${interactions.length} interactions`);

// Process interactions in chronological order
for (const interaction of interactions) {
  console.log(`${interaction.timestamp}: ${interaction.model} - ${interaction.status}`);
  
  // Access exports for individual interactions within the workflow
  if (interaction.markdown) {
    console.log(`Markdown for interaction ${interaction.id} available`);
    // Each interaction has its own formatted version
  }
  
  if (interaction.json) {
    console.log(`JSON for interaction ${interaction.id} available`);
    // Process structured data for this specific interaction
  }
}

// The complete workflow is also available as a single document
if (response.markdown) {
  console.log('Complete workflow in Markdown format available');
  // Use for documentation, analytics...
  fs.writeFileSync('workflow.md', response.markdown);
}

if (response.json) {
  console.log('Structured workflow data available');
  const parsedWorkflow = JSON.parse(response.json);
  // Use for processing, training...
}
```

### Get workflow artifacts

Retrieve all artifacts that belong to a specific workflow, with optional export formats:

```typescript
import Dirigible from '@dirigible-ai/sdk';

const workflowId = 'wf-1746094392583-bvur8lw';
const response = await Dirigible.getWorkflowArtifacts(workflowId, {
  includeMarkdown: true,  // Get Markdown documentation
  includeJson: true       // Get structured JSON
});

const artifacts = response.data;
console.log(`Found ${artifacts.length} artifacts`);

// Process artifacts
for (const artifact of artifacts) {
  console.log(`${artifact.name}: ${artifact.type}`);
  // Access the artifact data
  console.log(artifact.value);
  
  // Access exports for individual artifacts
  if (artifact.markdown) {
    console.log(`Markdown for artifact ${artifact.name} available`);
    // Each artifact has its own formatted documentation
  }
  
  if (artifact.json) {
    console.log(`JSON for artifact ${artifact.name} available`);
    // Process structured data for this specific artifact
  }
}

// The complete artifacts collection is also available as a single document
if (response.markdown) {
  console.log('All artifacts as one document available');
  // Use for documentation of the entire collection
}
```

### Search workflows

Search across workflows with a text query and optional filters:

```typescript
import Dirigible from '@dirigible-ai/sdk';

// Search for workflows containing "customer support"
const response = await Dirigible.searchWorkflows({
  query: 'customer support',          // Text to search for
  filters: {
    environment: 'production',        // Additional filters
    startDate: '2025-04-01',
    metadata: {                       // Filter by custom metadata
      sessionType: 'support_ticket',
      priority: 'high',
      resolution_time: { $lte: 300 }  // Sessions resolved in 5 min or less
    }
  },
  limit: 20
});

const searchResults = response.data;
const pagination = response.meta.pagination;
console.log(`Found ${pagination.total} matching workflows`);

// Process search results
for (const workflow of searchResults) {
  console.log(`Total interactions: ${workflow.totalInteractions}`);
}
```

## Retrieving artifacts

Artifacts can be retrieved individually or as part of a workflow, with optional Markdown and JSON export formats.

### Get an artifact

Retrieve a specific artifact by its ID, with optional export formats:

```typescript
import Dirigible from '@dirigible-ai/sdk';

const artifactId = 'f5545e11-6f27-4e96-be48-0f57c78807dd';
const response = await Dirigible.getArtifact(artifactId, {
  includeMarkdown: true,  // Get formatted documentation
  includeJson: true       // Get structured data
});

const artifact = response.data;
console.log(`Artifact: ${artifact.name}`);
console.log(`Type: ${artifact.type}`);
console.log(`Created: ${artifact.createdAt}`);

// Access the artifact data
console.log(artifact.value);

// Access export formats
if (response.markdown) {
  console.log('Artifact documentation:');
  console.log(response.markdown);
}

if (response.json) {
  console.log('Structured artifact data:');
  const parsedArtifact = JSON.parse(response.json);
  // Use for processing, visualization...
}
```

## Filtering by metadata

All retrieval methods that accept filters support filtering by custom metadata that you added during logging. This allows you to fetch exactly the interactions or workflows you need based on your application-specific information:

```typescript
// Filtering by metadata in getInteractions
const response = await Dirigible.getInteractions({
  filters: {
    provider: 'anthropic', 
    metadata: {
      task: 'generate_final_response',
      userId: 'user-123',
      quality_score: { $gte: 0.8 } // Operators for numeric comparisons
    }
  },
  limit: 10
});

// Filtering by metadata in searchInteractions
const searchResults = await Dirigible.searchInteractions({
  query: 'error',
  filters: {
    metadata: { 
      importance: 'high',
      resolved: false
    }
  }
});

// Filtering by metadata in searchWorkflows
const workflowResults = await Dirigible.searchWorkflows({
  query: 'customer',
  filters: {
    metadata: {
      conversationType: 'support',
      customerTier: 'premium'
    }
  }
});
```

The metadata filter:
- Must be a JSON-stringified object
- Supports MongoDB-like operators: `$eq`, `$gt`, `$gte`, `$lt`, `$lte`
- Searches in the metadata that was attached when interactions/workflows were logged
- Can be combined with other filter types

## Response format

All API responses follow a consistent format with a standardized structure:

### Single resources

```typescript
{
  data: {
    // Resource data (interaction, workflow, or artifact)
  },
  meta: {
    timestamp: string,  // ISO 8601 timestamp of when the response was generated
    // Additional metadata about the response
  }
}
```

### Collections

```typescript
{
  data: [
    // Array of resources (interactions, workflows, or artifacts)
  ],
  meta: {
    pagination: {
      total: number,      // Total number of available resources
      limit: number,      // Number of items per page
      nextCursor?: string, // Cursor for the next page of results
      hasMore: boolean    // Whether there are more results available
    },
    timestamp: string,    // ISO 8601 timestamp of when the response was generated
    // Additional metadata about the response
  }
}
```

### Relationships

```typescript
{
  data: {
    workflow: {...},    // Primary resource
    interactions: [     // Related resources
      {...},
      {...}
    ]
  },
  meta: {
    timestamp: string,  // ISO 8601 timestamp of when the response was generated
    // Additional metadata about the response
  }
}
```

## Export formats

Interaction and workflow data can be retrieved in additional structured formats for documentation, analysis, or integration with other tools.

### Available export options

When retrieving interactions, workflows, or artifacts, you can request the data in these additional formats:

```typescript
interface DataRetrievalOptions {
  /**
   * Include Markdown formatted version in the response
   */
  includeMarkdown?: boolean;
  
  /**
   * Include JSON formatted version in the response
   */
  includeJson?: boolean;
}
```

### Retrieving an interaction with exports

```typescript
import Dirigible from '@dirigible-ai/sdk';

const interactionId = 'int-1746094401615-z2ljxcm';
const response = await Dirigible.getInteraction(interactionId, {
  includeMarkdown: true, // Request markdown format
  includeJson: true      // Request JSON format
});

// Standard interaction data
const interaction = response.data;
console.log(`Model: ${interaction.model}`);

// Export formats
if (response.markdown) {
  console.log('Markdown export available');
  // Option 1: Save to file for documentation
  fs.writeFileSync('interaction.md', response.markdown);
  
  // Option 2: Use directly for in-context learning
  const enhancedPrompt = `
    Previous successful interaction:
    
    ${response.markdown}
    
    Now, answer the new question using a similar approach:
    ${newUserQuestion}
  `;
}

if (response.json) {
  console.log('JSON export available');
  // Option 1: Save for analysis
  fs.writeFileSync('interaction.json', response.json);
  
  // Option 2: Use structured data for in-context learning
  const parsedExample = JSON.parse(response.json);
  const fewShotExamples = [
    { role: 'user', content: parsedExample.request.content },
    { role: 'assistant', content: parsedExample.response.content }
  ];
  
  // Add to conversation context for the LLM
  const messages = [
    { role: 'system', content: 'Follow this example in your response:' },
    ...fewShotExamples,
    { role: 'user', content: newUserQuestion }
  ];
}
```

### Retrieving workflow interactions with exports

```typescript
import Dirigible from '@dirigible-ai/sdk';

const workflowId = 'wf-1746094392583-bvur8lw';
const response = await Dirigible.getWorkflowInteractions(workflowId, {
  includeMarkdown: true,
  includeJson: true
});

// Standard workflow and interactions data
const { workflow, interactions } = response.data;
console.log(`Found ${interactions.length} interactions`);

// Export formats
if (response.markdown) {
  console.log('Markdown export available');
  // Option 1: Save to file
  fs.writeFileSync(`workflow.md`, response.markdown);
  
  // Option 2: Use as comprehensive context example
  const enhancedSystemPrompt = `
    You are an AI assistant helping with a task.
    Here's a successful example of how to handle this type of request:
    
    ${response.markdown}
    
    Follow a similar multi-step approach for the user's request.
  `;
}

if (response.json) {
  console.log('JSON export available');
  // Option 1: Save for analysis
  fs.writeFileSync(`workflow.json`, response.json);
  
  // Option 2: Extract conversation turns for in-context learning
  const parsedWorkflow = JSON.parse(response.json);
  const conversationExamples = parsedWorkflow.interactions.map(int => [
    { role: 'user', content: int.request.content },
    { role: 'assistant', content: int.response.content }
  ]).flat();
  
  // Use the extracted conversation as context for a new conversation
  const messages = [
    { role: 'system', content: 'This is how to handle this type of conversation:' },
    ...conversationExamples,
    { role: 'user', content: newUserQuestion }
  ];
}
```

### Export format structures

#### Markdown format

The Markdown export includes formatted representations of:

- Request content with system messages if present
- Response content with proper formatting
- Tool calls with arguments (if present)
- Structured output in code blocks (if present)

For workflows, all interactions are included in chronological order with clear headers and separators between them.

Example of a Markdown export for an interaction:

```markdown
# Interaction

## Request (User)

### System Message

You are a helpful assistant that specializes in financial analysis.

I need to calculate the compound interest on a $10,000 investment with 5% annual interest rate over 10 years.

## Response (Model)

I'll calculate the compound interest on a $10,000 investment with 5% annual interest rate over 10 years.

The formula for compound interest is:
A = P(1 + r)^t

Where:
- A = Final amount
- P = Principal (initial investment)
- r = Interest rate (decimal)
- t = Time period in years

Calculation:
A = $10,000 × (1 + 0.05)^10
A = $10,000 × 1.05^10
A = $10,000 × 1.6289
A = $16,289

Therefore, after 10 years, your $10,000 investment will grow to $16,289, which means the compound interest earned is $6,289.
```

#### JSON format

The JSON export provides a structured representation with these components:

```typescript
// Single interaction JSON format
{
  "request": {
    "content": string,
    "system_message": string | undefined,
    "tool_definitions": Array<{name: string, arguments: any}> | undefined
  },
  "response": {
    "content": string,
    "tool_calls": Array<{name: string, arguments: any}> | undefined,
    "structured_output": any | undefined
  }
}

// Workflow JSON format
{
  "interactions": [
    {
      "index": number,
      "timestamp": string,
      "request": {...},
      "response": {...}
    },
    // additional interactions...
  ]
}
```

These export formats are particularly useful for:
- Creating documentation of AI interactions
- Sharing example conversations for review
- Training data preparation
- Providing few-shot examples for in-context learning
- Auditing AI system behavior

## Pagination

All methods that return multiple items (like `getInteractions` and `getWorkflows`) support pagination through a cursor-based approach. This ensures consistent results when fetching multiple pages even if new items are added to the database.

```typescript
import Dirigible from '@dirigible-ai/sdk';

async function fetchAllInteractions() {
  let allInteractions = [];
  let cursor = null;
  let hasMore = true;
  
  while (hasMore) {
    const result = await Dirigible.getInteractions({
      limit: 100,
      cursor: cursor
    });
    
    allInteractions = [...allInteractions, ...result.data];
    cursor = result.meta.pagination.nextCursor;
    hasMore = result.meta.pagination.hasMore;
    
    console.log(`Fetched ${result.data.length} more interactions. Total: ${allInteractions.length}`);
  }
  
  return allInteractions;
}

// Usage
fetchAllInteractions().then(interactions => {
  console.log(`Retrieved all ${interactions.length} interactions`);
});
```

## Error handling

All API endpoints return standardized error responses when something goes wrong:

```typescript
{
  error: {
    code: string,       // Error code (e.g., "not_found", "invalid_api_key")
    message: string,    // Human-readable error message
    details?: any       // Optional additional details about the error
  },
  meta: {
    timestamp: string,  // ISO 8601 timestamp of when the error occurred
    // Additional metadata about the error
  }
}
```

You can handle errors in your code like this:

```typescript
import Dirigible from '@dirigible-ai/sdk';

try {
  const response = await Dirigible.getInteraction('non-existent-id');
  // Process success response...
} catch (error) {
  console.error(`API Error: ${error.message}`);
  // Handle the error appropriately
}
```

## Examples

### Getting data for in-context learning

Use your historical interactions to enhance your prompts with relevant examples:

```typescript
import Dirigible from '@dirigible-ai/sdk';

// Initialize for data retrieval
Dirigible.initialize({
  apiKey: process.env.DIRIGIBLE_API_KEY,
  projectId: process.env.DIRIGIBLE_PROJECT_ID,
  environment: 'production'
});

async function getContextExamples(query, n = 3) {
  // Find similar successful interactions
  const searchResponse = await Dirigible.searchInteractions({
    query: query,
    filters: { 
      status: 'success',
      metadata: { quality_score: { $gte: 0.9 } } // High quality examples only
    },
    limit: n,
    includeMarkdown: true
  });
  
  // Use the individual exports from each search result
  const examples = searchResponse.data
    .filter(interaction => interaction.markdown)
    .map(interaction => interaction.markdown);
  
  // Create a system prompt with examples
  const systemPrompt = `
    Answer using these successful examples as references:
    
    ${examples.join('\n\n---\n\n')}
    
    When answering new questions, follow a similar structure and approach.
  `;
  
  return systemPrompt;
}

// Usage in an LLM call
const systemPrompt = await getContextExamples("How do I implement an agent?");
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: currentUserQuestion }
  ]
});
```

### Preparing data for finetuning

Create high-quality training datasets from your production interactions:

```typescript
import Dirigible from '@dirigible-ai/sdk';
import fs from 'fs';

// Initialize for data retrieval
Dirigible.initialize({
  apiKey: process.env.DIRIGIBLE_API_KEY,
  projectId: process.env.DIRIGIBLE_PROJECT_ID,
  workflowTracking: false  // disable tracking in analytics mode
});

async function createFinetuningData(options = {}) {
  const { minQuality = 0.8, maxCount = 1000 } = options;
  
  // Get successful interactions with high quality scores and JSON exports
  const searchResponse = await Dirigible.getInteractions({
    filters: {
      status: 'success',
      metadata: { quality_score: { $gte: minQuality } }
    },
    limit: maxCount,
    includeJson: true
  });
  
  // Use the individual JSON exports directly from each interaction
  const dataset = searchResponse.data
    .filter(interaction => interaction.json)
    .map(interaction => {
      // Parse the JSON export which is already in a training-friendly format
      const parsed = JSON.parse(interaction.json);
      return {
        messages: [
          { role: 'user', content: parsed.request.content },
          { role: 'assistant', content: parsed.response.content }
        ]
      };
    });
  
  // Filter out any empty or invalid examples
  const validExamples = dataset.filter(item => 
    item.messages[0].content.trim() && item.messages[1].content.trim()
  );
  
  // Write to JSONL file
  const path = './finetuning-data.jsonl';
  fs.writeFileSync(path, validExamples.map(item => JSON.stringify(item)).join('\n'));
  
  return { count: validExamples.length, path };
}

// Usage
const result = await createFinetuningData({ minQuality: 0.9 });
console.log(`Created dataset with ${result.count} examples at ${result.path}`);
```

### Exporting data for analysis

Extract key metrics for external analysis:

```typescript
import Dirigible from '@dirigible-ai/sdk';

// Initialize for data retrieval
Dirigible.initialize({
  apiKey: process.env.DIRIGIBLE_API_KEY,
  projectId: process.env.DIRIGIBLE_PROJECT_ID,
  workflowTracking: false  // disable tracking in analytics mode
});

async function exportAnalytics(days = 7) {
  // Set date range
  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - days * 86400000).toISOString();
  
  // Get workflows from time period
  const response = await Dirigible.getWorkflows({
    filters: { startDate, endDate },
    limit: 500
  });
  
  // Aggregate metrics
  const metrics = {
    summary: {
      total: response.meta.pagination.total,
      totalTokens: response.data.reduce((sum, w) => sum + w.totalTokens, 0),
      avgDuration: response.data.reduce((sum, w) => sum + w.totalDurationMs, 0) / 
                   Math.max(1, response.data.length)
    },
    byModel: {}
  };
  
  // Get model-specific metrics
  for (const workflow of response.data) {
    const interactionsResult = await Dirigible.getWorkflowInteractions(workflow.workflowId);
    
    for (const int of interactionsResult.data.interactions) {
      const model = int.model;
      if (!metrics.byModel[model]) {
        metrics.byModel[model] = { count: 0, tokens: 0, errors: 0 };
      }
      
      metrics.byModel[model].count++;
      metrics.byModel[model].tokens += int.tokens?.total || 0;
      if (int.status === 'error') metrics.byModel[model].errors++;
    }
  }
  
  return metrics;
}

// Usage
const analytics = await exportAnalytics(30);
console.log(`Last 30 days: ${analytics.summary.total} workflows, ${analytics.summary.totalTokens} tokens`);
```
