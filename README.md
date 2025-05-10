# Dirigible TypeScript SDK for AI Observability

JavaScript / TypeScript library for the [Dirigible AI](https://dirigible.ai) API.

A lightweight SDK for monitoring and improving AI and Large Language Model (LLM) workflows.

Check the [Product documentation](https://dirigible.ai/documentation) for more details and practical examples.

## Table of contents

- [Features](#features)
- [Installation](#installation)
- [Getting started](#getting-started)
  - [1. Initialize the SDK](#1-initialize-the-sdk)
  - [2. Wrap your AI clients](#2-wrap-your-ai-clients)
  - [3. Add workflow metadata](#3-add-workflow-metadata)
  - [4. Add interaction metadata with the decorator](#4-add-interaction-metadata-with-the-decorator)
- [Import styles](#import-styles)
- [Global metadata](#global-metadata)
- [Artifacts](#artifacts)
- [Interaction and workflow IDs](#interaction-and-workflow-ids)
- [Data retrieval](#data-retrieval)
- [Streaming](#streaming)
- [Making sure logs are sent](#making-sure-logs-are-sent)
- [Manual management](#manual-management)
- [Configuration options](#configuration-options)
- [Supported AI providers](#supported-ai-providers)
- [Configuring log levels](#configuring-log-levels)
- [License](#license)

## Features

- 🪄 **Single wrapper**: One `observeAIClient` wrapper for all AI providers
- 🔍 **Auto-detection**: Automatically detects OpenAI, Anthropic, and Google models
- 🔄 **Workflow tracking**: Automatically group related interactions into workflows
- 🏷️ **Rich metadata**: Attach custom metadata at global, workflow, and interaction levels
- 💎 **Data artifacts**: In addition to LLM interactions, store intermediary data artifacts
- 📈 **Smart metrics**: Tracks token usage, latency, and other metrics automatically
- ⚡ **Fast and reliable**: Efficient batched logging with production-grade reliability across architectural patterns

## Installation

```bash
npm install @dirigible-ai/sdk
```

## Getting started

Follow those four simple steps to fully track your AI workflows and interactions with specific metadata.

### 0. Get your API key

Sign up for a free account at [https://dirigible.ai](https://dirigible.ai) to get your API key.

### 1. Initialize the SDK

Initialize the SDK using your Dirigible API key and project ID:

```typescript
import Dirigible from '@dirigible-ai/sdk';

Dirigible.initialize({
  apiKey: 'your-api-key',
  projectId: 'your-project-id',
  environment: 'production' // or 'development', 'staging', etc.
});
```

The initialization creates a workflow context that's automatically shared across all wrapped clients in your application.

See the full list of supported parameters in the **Configuration options** section.

### 2. Wrap your AI clients

To add observability, simply wrap your AI clients using `observeAIClient`:

```typescript
import Dirigible, { observeAIClient } from '@dirigible-ai/sdk';
import OpenAI from 'openai';

// Create and wrap in one step
const openai = observeAIClient(new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}));

// Then use your AI clients normally - everything is automatically logged!
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello world' }]
});
```

The wrapper works reliably regardless of where clients are initialized, including in factory patterns, service classes, or multiple files.

The SDK supports OpenAI, Anthropic and Google clients:
```typescript
import Dirigible, { observeAIClient } from '@dirigible-ai/sdk';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

const openai = observeAIClient(new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}));

const anthropic = observeAIClient(new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
}));

const google = observeAIClient(new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY
}));
```

With those two steps (initializing + wrapping), the application workflow and corresponding interactions are captured and logged to Dirigible.

### 3. Add workflow metadata

You can add workflow-specific metadata when initializing, that will be attached to the workflow and all interactions:

```typescript
import Dirigible from '@dirigible-ai/sdk';

// Initialize with optional workflow metadata
Dirigible.initialize({
  apiKey: 'your-api-key',
  projectId: 'my-project',
  workflowMetadata: {
    version: '1.2.0',
    userType: 'premium'
  }
});
```

### 4. Add interaction metadata with the decorator

Use the `@observeLLM` decorator to add metadata to specific interactions:

```typescript
import Dirigible, { observeAIClient, observeLLM } from '@dirigible-ai/sdk';
import OpenAI from 'openai';

class AIService {
  private openai = observeAIClient(new OpenAI({ apiKey: 'your-openai-key' }));
  
  // Add the decorator just above the method calling the LLM
  @observeLLM({
    task: 'classify_input',
    userId: 'user-123',
    inputId: 'input-456'
  })
  async classifyText(text: string) {
    return this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: text }]
    });
  }
  
  // You can also use a function to generate dynamic metadata
  @observeLLM((params) => ({
    promptLength: params.messages[0].content.length,
    timestamp: new Date().toISOString()
  }))
  async summarizeText(text: string) {
    return this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: `Summarize: ${text}` }]
    });
  }
}
```

That's it! With those four steps, your AI workflows and interactions are entirely tracked and visualized in your Dirigible dashboard with the right metadata.

## Global metadata

You can add global metadata that will be included with all requests:

```typescript
import Dirigible from '@dirigible-ai/sdk';

// Set initial global metadata
Dirigible.setGlobalMetadata({
  deploymentRegion: 'us-west',
  version: '1.2.3'
});

// Add more metadata later in your workflow
Dirigible.addGlobalMetadata({
  generatedId: 'id-789'
});
```

Global metadata is attached to the workflow, and to all interactions happening after its declaration.

It can for example be used to add metadata that is generated during the workflow.

## Artifacts

In addition to LLM interactions, you can log intermediary data artifacts during your workflows:

```typescript
import Dirigible from '@dirigible-ai/sdk';

// Store vector search results used for RAG, with name and value
const searchResults = await vectorDb.search(query, { topK: 5 });
Dirigible.saveArtifact('search_results', searchResults);

// Optionally, log with artifact metadata and type
Dirigible.saveArtifact('search_results_with_meta', searchResults, { 
  metadata: { query, similarity_threshold: 0.8 },
  type: 'vector_search'
});
```

You can store any serializable data structure:

```typescript
import Dirigible from '@dirigible-ai/sdk';

Dirigible.saveArtifact('processed_results', {
  relevant: searchResults.slice(0, 2),
  irrelevant: searchResults.slice(2),
  stats: {
    totalResults: searchResults.length,
    avgScore: searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length,
    executionTimeMs: 42
  }
});
```

Artifacts can be used to track intermediate steps in your pipelines or see what data was used for generation.

## Interaction and workflow IDs

For better traceability and easier correlation with your own systems, both workflows and individual interactions have unique IDs that you can access:

```typescript
import Dirigible, { observeAIClient } from '@dirigible-ai/sdk';
import OpenAI from 'openai';

// Initialize your client
const openai = observeAIClient(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

// Get the current workflow ID
const workflowId = Dirigible.getWorkflowId();
console.log(`Current workflow ID: ${workflowId}`);

// Make an LLM API call
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello world' }]
});

// Get the ID of the interaction that just occurred (do it just after)
const interactionId = Dirigible.getInteractionId();
console.log(`Interaction ID: ${interactionId}`);
```

This is particularly useful for cross-system tracing and debugging complex AI workflows that span multiple services.

You can also create direct links to Dirigible to easily access those logs:
```typescript
`https://dirigible.ai/workflows/${workflowId}`
`https://dirigible.ai/interactions/${interactionId}`
```
and retrieve them later using the data retrieval API, as specified below.

## Data retrieval

Dirigible provides a powerful data retrieval API that gives you access to all of your logged AI interactions and workflows. This makes it possible to:

- Retrieve historical interactions for in-context learning
- Build high-quality datasets for fine-tuning models
- Export interactions in Markdown or JSON formats
- Develop custom analytics dashboards
- Search across your interactions and workflows with powerful filtering

```typescript
import Dirigible from '@dirigible-ai/sdk';

// Initialize without creating new workflows
Dirigible.initialize({
  apiKey: process.env.DIRIGIBLE_API_KEY,
  projectId: process.env.DIRIGIBLE_PROJECT_ID,
  workflowTracking: false  // disable tracking for analytics mode
});

// Get a single interaction with export formats
const interaction = await Dirigible.getInteraction('int-12345', {
  includeMarkdown: true,  // Get a formatted Markdown version
  includeJson: true       // Get a structured JSON version
});

// Search for similar interactions
const searchResults = await Dirigible.searchInteractions({
  query: 'classification algorithm',
  filters: { status: 'success' },
  limit: 10
});

// Get workflow interactions
const workflowData = await Dirigible.getWorkflowInteractions('wf-67890');
```

For more details and examples, see the [Data Retrieval API documentation](https://github.com/dirigible-ai/dirigible-sdk-typescript/blob/main/DATA-RETRIEVAL.md).

## Streaming

For OpenAI streaming responses, add the `stream_options` parameter to capture all usage information:

```typescript
const stream = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Your prompt" }],
  stream: true,
  stream_options: { "include_usage": true }  // This ensures capture of OpenAI stream info
});
```

It works out of the box for other providers.

## Making sure logs are sent

This should be automatic, but when running scripts or processes that exit quickly, you can force a flush:

```typescript
import Dirigible from '@dirigible-ai/sdk';

// At the end of your script
async function main() {
  // ...your code...
  
  // Force flush at the end to ensure logs are sent
  console.log('Forcing final flush of logs...');
  await Dirigible.forceFlush();
  
  // Optional: Wait a bit to ensure network requests complete
  await new Promise(resolve => setTimeout(resolve, 1000));
}

main().catch(console.error);
```

## Manual management

For more control or when automatic instrumentation isn't suitable, you can manually create and manage workflows:

```typescript
import Dirigible, { logLLMInteraction } from '@dirigible-ai/sdk';

class ChatService {
  private llmClient: any;
  
  constructor() {
    // Initialize your LLM client here
  }
  
  // Create a chat session with explicit workflow
  createChat(userId: string) {
    // Create a workflow for this conversation
    const chatWorkflow = Dirigible.createWorkflow(`chat-${Date.now()}`, {
      userId,
      startTime: new Date().toISOString()
    });
    
    return {
      async sendMessage(message: string) {
        // Get current workflow metadata
        const workflowData = chatWorkflow.getMetadata();
        
        // Make the LLM call
        const response = await this.llmClient.generateResponse(message);
        
        // Log the interaction, with workflow metadata
        await logLLMInteraction({
          model: 'llm-model',
          request: { message },
          response,
          metadata: workflowData
        });
        
        // Update workflow after each message
        chatWorkflow.addMetadata({
          lastMessageTime: new Date().toISOString()
        });
        
        return response;
      },
      
      endChat() {
        // Optionally, end the workflow when chat ends
        Dirigible.endWorkflow({ 
          outcome: 'completed',
          finalState: 'conversation_ended'
        });
      }
    };
  }
}
```

## Configuration options

The SDK can be configured with these options:

```typescript
import Dirigible from '@dirigible-ai/sdk';

Dirigible.initialize({
  // Required
  apiKey: 'your-api-key',                // Dirigible API key
  projectId: 'your-project-id',          // Dirigible project identifier
  
  // Optional
  apiUrl: 'https://custom-api-url.com',  // Default is Dirigible API
  environment: 'production',             // Environment name
  enabled: true,                         // Enable/disable logging globally
  flushInterval: 1000,                   // Flush queue every 1 second(s) (ms)
  samplingRate: 0.5,                     // Log a limited % of requests
  workflowTracking: true,                // Enable/disable automatic workflow tracking
  autoInstrument: true,                  // Enable/disable automatic client patching
  workflowMetadata: {                    // Initial metadata for workflow
    version: '1.2.3',
    userType: 'premium'
  },
  logLevel: Dirigible.LogLevel.INFO,     // Logging verbosity level
  logPrefix: '[Dirigible]'               // Prefix for log messages
});
```

## Supported AI providers

- OpenAI
- Anthropic
- Google AI
- Custom providers (with manual configuration)

## Configuring log levels

The SDK includes a configurable logging system with different verbosity levels:

```typescript
import Dirigible from '@dirigible-ai/sdk';

// Configure with custom log level
Dirigible.initialize({
  apiKey: 'your-api-key',
  projectId: 'your-project-id',
  logLevel: Dirigible.LogLevel.INFO,
  logPrefix: '[MyApp]' // Custom prefix for log messages
});
```

Available log levels:

- `Dirigible.LogLevel.NONE`: Disable all logs
- `Dirigible.LogLevel.ERROR`: Only show errors
- `Dirigible.LogLevel.WARN`: Show warnings and errors
- `Dirigible.LogLevel.INFO`: Show info, warnings, and errors (default)
- `Dirigible.LogLevel.DEBUG`: Show debug and all above
- `Dirigible.LogLevel.TRACE`: Most verbose level for detailed tracing

You can adjust log levels for different environments:

```typescript
import Dirigible from '@dirigible-ai/sdk';

Dirigible.initialize({
  apiKey: 'your-api-key',
  projectId: 'your-project-id',
  environment: process.env.NODE_ENV,
  // Set log level based on environment
  logLevel: process.env.NODE_ENV === 'production' 
    ? Dirigible.LogLevel.WARN
    : Dirigible.LogLevel.DEBUG
});
```

## License

MIT
