# Dirigible SDK examples

This page contains practical examples of how to use the Dirigible SDK to track your AI workflows. We'll demonstrate both simple and advanced scenarios to show how Dirigible can help you track and analyze your AI interactions and data artifacts.

## Table of Contents

- [Simple workflow](#simple-workflow)
  - [1. Import the SDK](#1-import-the-sdk)
  - [2. Initialize the SDK](#2-initialize-the-sdk)
  - [3. Wrap OpenAI client](#3-wrap-openai-client)
  - [4. LLM calls and interaction metadata](#4-llm-calls-and-interaction-metadata)
  - [5. Run the workflow](#5-run-the-workflow)
  - [Visualize on Dirigible](#visualize-on-dirigible)
- [Advanced RAG workflow](#advanced-rag-workflow)
  - [1. Import the SDK](#1-import-the-sdk-1)
  - [2. Initialize SDK and wrap multiple AI clients](#2-initialize-sdk-and-wrap-multiple-ai-clients)
  - [3. Create LLM and vector search services](#3-create-llm-and-vector-search-services)
  - [4. Run the complete RAG workflow](#4-run-the-complete-rag-workflow)
  - [Visualization on Dirigible](#visualization-on-dirigible)
- [Data retrieval](#data-retrieval)
  - [Getting data for in-context learning](#getting-data-for-in-context-learning)
  - [Preparing data for finetuning](#preparing-data-for-finetuning)
  - [Exporting data for analysis](#exporting-data-for-analysis)

## Simple workflow

This example shows how to monitor a basic customer support workflow that uses OpenAI to classify customer intents and generate responses. We'll demonstrate how to initialize the SDK, wrap an AI client, and add metadata to specific interactions.

### 1. Import the SDK

First, we import Dirigible and the necessary decorator functions. We use the direct imports for the special functions and the namespace for everything else.

```typescript
import * as dotenv from 'dotenv';
import Dirigible, { observeAIClient, observeLLM } from '@dirigible-ai/sdk';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();
```

### 2. Initialize the SDK

Now we initialize the SDK with our API credentials and add workflow metadata that will be attached to all interactions in this workflow. This helps organize, filter and search your data.

```typescript
Dirigible.initialize({
  apiKey: process.env.DIRIGIBLE_API_KEY,
  projectId: process.env.DIRIGIBLE_PROJECT_ID,
  workflowMetadata: {
    version: '1.0.0',
    app: 'customer-support'
  }
});
```

### 3. Wrap OpenAI client

With a single line of code, we wrap our OpenAI client to automatically track all API calls. This works without changing how you use the client in your code.

```typescript
const openai = observeAIClient(new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}));
```

### 4. LLM calls and interaction metadata

We create a support agent class with two methods for different tasks: classifying the request intent and generating the response. The `@observeLLM` decorator adds specific metadata to each interaction, making it easier to understand their purpose and filter them in the dashboard.

```typescript
class SupportAgent {
  @observeLLM({
    task: 'classify_intent',
    priority: 'high'
  })
  async classifyCustomerIntent(message: string) {
    return openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Classify the customer support intent." },
        { role: "user", content: message }
      ]
    });
  }

  @observeLLM({
    task: 'generate_response',
    tone: 'empathetic'
  })
  async generateResponse(message: string, intent: string) {
    return openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: `You are a support agent. The customer intent is: ${intent}. Be empathetic.` },
        { role: "user", content: message }
      ]
    });
  }
}
```

### 5. Run the workflow

Finally, we create a workflow function that makes both LLM calls. Dirigible automatically associates these calls to the current workflow, providing end-to-end traceability.

```typescript
async function handleCustomerMessage(message: string) {
  const agent = new SupportAgent();
  
  // First LLM call - Classify intent
  const intentResult = await agent.classifyCustomerIntent(message);
  const intent = intentResult.choices[0].message.content || "Unknown intent";
  
  // Second LLM call - Generate response
  const responseResult = await agent.generateResponse(message, intent);
  const response = responseResult.choices[0].message.content || "Sorry, I couldn't generate a response.";
  
  // Log workflow ID for traceability
  const workflowId = Dirigible.getWorkflowId();
  console.log(`View workflow: https://dirigible.ai/workflows/${workflowId}`);
  
  return { intent, response };
}

// Run the workflow
handleCustomerMessage("I've been charged twice for my subscription this month.")
  .then(result => {
    console.log("Intent:", result.intent);
    console.log("Response:", result.response);
  });
```

### Visualize on Dirigible

You can now find your workflow and interactions on Dirigible:

![Simple example visualization - Feed](images/simple-1-dark.png)

Inspect and exploit individual interactions:

![Simple example visualization - Interaction details](images/simple-2-dark.png)

Visualize the workflow:

![Simple example visualization - Workflow details](images/simple-3-dark.png)

## Advanced RAG workflow

This example demonstrates a complete Retrieval-Augmented Generation (RAG) system that uses multiple AI providers and additional Dirigible features. We'll show how to save artifacts, add global metadata, and track workflow/interaction IDs across a multi-step process.

### 1. Import the SDK

We import Dirigible for the namespace and directly import the special functions we'll use frequently.

```typescript
import * as dotenv from 'dotenv';
import Dirigible, { observeAIClient, observeLLM } from '@dirigible-ai/sdk';
import OpenAI from 'openai';
import { type ChatCompletionTool } from "openai/resources/chat/completions";
import Anthropic from '@anthropic-ai/sdk';
import { searchVectorDatabase, fetchDocument } from './vector-store';

// Load environment variables
dotenv.config();
```

### 2. Initialize SDK and wrap multiple AI clients

We initialize the SDK, wrap clients from both OpenAI and Anthropic, get the workflow ID for tracing, and add global metadata that will be attached to all subsequent interactions.

```typescript
// Initialize the SDK
Dirigible.initialize({
  apiKey: process.env.DIRIGIBLE_API_KEY,
  projectId: process.env.DIRIGIBLE_PROJECT_ID,
  environment: 'production',
  workflowMetadata: {
    version: '1.0.0',
    app: 'rag-assistant'
  }
});

// Wrap multiple AI clients
const openai = observeAIClient(new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}));

const anthropic = observeAIClient(new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
}));

// Get workflow ID for tracing
const workflowId = Dirigible.getWorkflowId();
console.log(`Workflow ID: ${workflowId}`);
```

### 3. Create LLM and vector search services

We create service classes for our LLM operations. The SearchService uses function calling to get structured search terms, showing how to combine observability with tools. Each decorated method with `@observeLLM` adds specific metadata to the interaction.

```typescript
// Define search terms extraction tool
const searchTermsTools: ChatCompletionTool[] = [{
  type: "function",
  function: {
    name: "extract_search_terms",
    description: "Extract key search terms from the user query",
    parameters: {
      type: "object",
      properties: {
        terms: {
          type: "array",
          items: {
            type: "string"
          },
          description: "Array of search terms extracted from the query"
        },
        justification: {
          type: "string",
          description: "Justification for the selected search terms"
        }
      },
      required: ["terms", "justification"],
      additionalProperties: false
    }
  }
}];
```

Dirigible seamlessly integrates with structured tools like OpenAI's function calling while providing complete observability.

```typescript
// Search service using function calling
class SearchService {
  @observeLLM({
    task: 'extract_search_terms',
    stage: 'retrieval'
  })
  async generateSearchTerms(query: string) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Extract 3-5 key search terms from the user query." },
        { role: "user", content: query }
      ],
      tools: searchTermsTools,
      tool_choice: { type: "function", function: { name: "extract_search_terms" } }
    });
    
    // Get interaction ID for this specific call
    const interactionId = Dirigible.getInteractionId();
    console.log(`Search terms interaction ID: ${interactionId}`);
    
    // Extract the structured search terms from the function call
    let terms = [];
    let justification = "";
    
    if (response.choices[0].message.tool_calls) {
      const toolCall = response.choices[0].message.tool_calls[0];
      if (toolCall.function && toolCall.function.arguments) {
        const args = JSON.parse(toolCall.function.arguments);
        terms = args.terms || [];
        justification = args.justification || "";
      }
    }
    
    // Store the justification as an artifact
    Dirigible.saveArtifact('search_terms_justification', { 
      query, 
      terms, 
      justification 
    });
    
    return terms;
  }
}
```

The `@observeLLM` decorator enriches interactions with metadata, while the artifacts feature captures intermediate reasoning for full transparency.

```typescript
// Document service for retrieval operations
class DocumentService {
  async retrieveDocuments(query: string, searchTerms: string[]) {
    // Search the vector database
    const results = await searchVectorDatabase(searchTerms.join(' OR '));
    
    // Store search results as an artifact
    Dirigible.saveArtifact('search_results', results, {
      metadata: { 
        query, 
        searchTerms, 
        resultCount: results.length 
      }
    });
    
    // Fetch full documents for top results
    const documents = [];
    for (const result of results.slice(0, 3)) {
      const doc = await fetchDocument(result.id);
      documents.push({
        id: result.id,
        title: doc.title,
        content: doc.content,
        score: result.score
      });
    }
    
    return documents;
  }
}
```

With Dirigible's artifacts, you can monitor non-LLM operations like vector search, gaining visibility into the entire retrieval process.

```typescript
// Answer service for generating responses with Claude
class AnswerService {
  @observeLLM({
    task: 'generate_answer',
    stage: 'response'
  })
  async generateAnswer(query: string, documents: any[]) {
    // Format documents for Claude
    const context = documents.map((doc, i) => 
      `DOCUMENT ${i+1}: ${doc.title}\n${doc.content}\n`
    ).join('\n');
    
    // Generate the answer with Claude
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-latest",
      messages: [
        { 
          role: "user", 
          content: `QUESTION: ${query}\n\nSOURCES:\n${context}\n\nAnswer the question based on the provided sources. Cite document numbers.` 
        }
      ],
      max_tokens: 1000
    });
    
    // Get interaction ID
    const interactionId = Dirigible.getInteractionId();
    console.log(`Answer generation interaction ID: ${interactionId}`);
    
    // Extract the answer from Claude's response
    let answer = '';
    if (response.content) {
      for (const block of response.content) {
        if (block.type === 'text') {
          answer += block.text;
        }
      }
    }
    
    // Save the final answer as an artifact
    Dirigible.saveArtifact('final_answer', { query, answer });
    
    return answer;
  }
}
```

Dirigible's auto-detection enables seamless tracking across different AI providers like OpenAI and Anthropic in the same workflow. This gives you complete visibility into your RAG pipeline from start to finish.

### 4. Run the complete RAG workflow

Finally, we orchestrate the entire RAG process in a single function using our service classes. Dirigible tracks the complete workflow from search term generation to final answer, across both OpenAI and Anthropic.

```typescript
async function answerQuestion(query: string) {
  console.log(`Processing query: "${query}"`);
  
  // Initialize services
  const searchService = new SearchService();
  const documentService = new DocumentService();
  const answerService = new AnswerService();
  
  // Step 1: Generate search terms with OpenAI using function calling
  const searchTerms = await searchService.generateSearchTerms(query);
  console.log(`Search terms: ${searchTerms.join(', ')}`);
  
  // Step 2: Retrieve relevant documents
  const documents = await documentService.retrieveDocuments(query, searchTerms);
  console.log(`Retrieved ${documents.length} documents`);
  
  // Step 3: Generate answer with Claude
  const answer = await answerService.generateAnswer(query, documents);
  
  return answer;
}

// Execute the workflow
answerQuestion("How do I implement RAG with the Dirigible SDK?")
  .then(answer => {
    console.log("\nFINAL ANSWER:");
    console.log(answer);
    console.log(`\nView workflow: https://dirigible.ai/workflows/${Dirigible.getWorkflowId()}`);
  });
```

With this implementation, you get complete observability into your RAG pipeline, including both LLM interactions and intermediary data processing steps. You can track the entire flow from the initial query to the final answer, with detailed metadata at every step.

### Visualization on Dirigible

You can then visualize your workflow on Dirigible, searching in the Observability section or going directly to the newly created `https://dirigible.ai/workflows/${workflowId}`:

![Advanced example visualization - Workflow overview](images/advanced-1-dark.png)

Visualize interactions and artifacts with the interactive canvas:

![Advanced example visualization - Metadata details](images/advanced-2-dark.png)

Inspect and exploit individual interactions and artifacts:

![Advanced example visualization - Performance metrics](images/advanced-3-dark.png)

## Data retrieval

### Retrieving data for in-context learning

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
