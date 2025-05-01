# Dirigible TypeScript SDK for AI Observability

JavaScript / TypeScript library for the [Dirigible AI](https://dirigible.ai) API.

A lightweight SDK for monitoring AI and Large Language Model (LLM) workflows.

Simply wrap your AI clients and add a decorator for complete observability.

Refer to [Examples](https://github.com/dirigible-ai/dirigible-sdk-typescript/blob/main/EXAMPLES.md) to see practical examples.

## Table of contents

- [Features](#features)
- [Installation](#installation)
- [Getting started](#getting-started)
  - [1. Initialize the SDK](#1-initialize-the-sdk)
  - [2. Wrap your AI clients](#2-wrap-your-ai-clients)
  - [3. Add workflow metadata](#3-add-workflow-metadata)
  - [4. Add interaction metadata with the decorator](#4-add-interaction-metadata-with-the-decorator)
- [Global metadata](#global-metadata)
- [Interaction and workflow IDs](#interaction-and-workflow-ids)
- [Artifacts](#artifacts)
- [Streaming](#streaming)
- [Making sure logs are sent](#making-sure-logs-are-sent)
- [Manual management](#manual-management)
- [Configuration options](#configuration-options)
- [Supported AI providers](#supported-ai-providers)
- [Configuring log levels](#configuring-log-levels)
- [License](#license)

## Features

- 🪄 **Single wrapper**: One `observeAIClient` wrapper for all AI providers
- 🔍 **Auto-detection**: Automatically detects OpenAI, Anthropic, and Gemini models
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
import { initialize } from '@dirigible-ai/sdk';

initialize({
  apiKey: 'your-api-key',
  projectId: 'your-project-id',

  // Optional parameters
  environment: 'production' // or 'development', 'staging', etc.
});
```

The initialization creates a workflow context that's automatically shared across all wrapped clients in your application.

See the full list of supported parameters in the **Configuration options** section.

### 2. Wrap your AI clients

To add observability, simply wrap your AI clients using `observeAIClient`:

```typescript
import { observeAIClient } from '@dirigible-ai/sdk';
import OpenAI from 'openai';

// Initialize and wrap your AI clients
let openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
openai = observeAIClient(openai);

// Then use your AI clients normally - everything is automatically logged!
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello world' }]
});
```

Alternatively, create and wrap in one step:

```typescript
const openai = observeAIClient(new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}));
```

The wrapper works reliably regardless of where clients are initialized, including in factory patterns, service classes, or multiple files.

The SDK supports OpenAI, Anthropic and Google clients:
```typescript
import { observeAIClient } from '@dirigible-ai/sdk';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

let openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
openai = observeAIClient(openai);

let anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
anthropic = observeAIClient(anthropic);

let gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
gemini = observeAIClient(gemini);
```

With those two steps (initializing + wrapping), the application workflow and corresponding interactions are captured and logged to Dirigible.

### 3. Add workflow metadata

You can add workflow-specific metadata when initializing:

```typescript
import { initialize } from '@dirigible-ai/sdk';

// Initialize with optional workflow metadata
initialize({
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
import { observeLLM } from '@dirigible-ai/sdk';
import OpenAI from 'openai';

class AIService {
  private openai = observeAIClient(new OpenAI({ apiKey: 'your-openai-key' }));
  
  // Add the decorator just above the method calling the LLM
  @observeLLM({
    task: 'classify_input',
    userId: userId,
    inputId: inputId
  })
  async classifyText(text: string) {
    return this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: text }]
    });
  }
}
```

You can also use a function to generate dynamic metadata:

```typescript
import { observeLLM } from '@dirigible-ai/sdk';

class AIService {
  @observeLLM((params) => ({
    promptLength: params.messages[0].content.length,
    timestamp: new Date().toISOString(),
    userId: getCurrentUser().id
  }))
  async classifyText(text: string) {
    return this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: text }]
    });
  }
}
```

That's it! With those four steps, your AI workflows and interactions are entirely tracked and visualized in your Dirigible dashboard with the right metadata.

## Global metadata

You can add global metadata that will be included with all requests:

```typescript
import { setGlobalMetadata, addGlobalMetadata } from '@dirigible-ai/sdk';

// Set initial global metadata
setGlobalMetadata({
  deploymentRegion: 'us-west',
  version: '1.2.3'
});

// Add more metadata later in your workflow
addGlobalMetadata({
  generatedId: generatedId
});
```

Global metadata is attached to the workflow, and to all interactions happening after its declaration.

It can for example be used to add metadata that is generated during the workflow.

## Interaction and workflow IDs

For better traceability and easier correlation with your own systems, both workflows and individual interactions have unique IDs that you can access:

```typescript
import { getWorkflowId, getInteractionId } from '@dirigible-ai/sdk';
import OpenAI from 'openai';

// Initialize your client
let openai = observeAIClient(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

// Get the current workflow ID
const workflowId = getWorkflowId();
console.log(`Current workflow ID: ${workflowId}`);

// Make an LLM API call
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello world' }]
});

// Get the ID of the interaction that just occurred (do it just after)
const interactionId = getInteractionId();
console.log(`Interaction ID: ${interactionId}`);
```

This is particularly useful for cross-system tracing and debugging complex AI workflows that span multiple services.

You can also create direct links to Dirigible to easily access those logs:
```typescript
`https://dirigible.ai/workflows/${workflowId}`
`https://dirigible.ai/interactions/${interactionId}`
```

## Artifacts

In addition to tracking LLM interactions, you can log data artifacts in your workflows:

```typescript
import { saveArtifact } from '@dirigible-ai/sdk';

// Store vector search results used for RAG, with name and value
const searchResults = await vectorDb.search(query, { topK: 5 });
saveArtifact('search_results', searchResults);

// Optionally, log with artifact metadata and type
saveArtifact('search_results_with_meta', searchResults, { 
  metadata: { query, similarity_threshold: 0.8 }
  type: 'vector_search',
});
```

You can store any serializable data structure:

```typescript
saveArtifact('processed_results', {
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
import { forceFlush } from '@dirigible-ai/sdk';

// At the end of your script
async function main() {
  // ...your code...
  
  // Force flush at the end to ensure logs are sent
  console.log('Forcing final flush of logs...');
  await forceFlush();
  
  // Optional: Wait a bit to ensure network requests complete
  await new Promise(resolve => setTimeout(resolve, 1000));
}

main().catch(console.error);
```

## Manual management

For more control or when automatic instrumentation isn't suitable, you can manually create and manage workflows:

```typescript
import { createWorkflow, logLLMInteraction, endWorkflow } from '@dirigible-ai/sdk';

class ChatService {
  private llmClient: any;
  
  constructor() {
    // Initialize your LLM client here
  }
  
  // Create a chat session with explicit workflow
  createChat(userId: string) {
    // Create a workflow for this conversation
    const chatWorkflow = createWorkflow(`chat-${Date.now()}`, {
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
        endWorkflow({ 
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
initialize({
  // Required
  apiKey: 'your-api-key',                // Dirigible API key
  projectId: 'your-project-id',          // Dirigible project identifier
  
  // Optional
  apiUrl: 'https://custom-api-url.com',  // Default is Dirigible API
  environment: 'production',             // Environment name
  enabled: true,                         // Enable/disable logging globally
  flushInterval: 1000,                   // Flush queue every 1 second(s) (ms)
  samplingRate: 0.5,                     // Log a limited % of requests
  trackWorkflows: true,                  // Enable/disable automatic workflow tracking
  autoInstrument: true,                  // Enable/disable automatic client patching
  workflowMetadata: {                    // Initial metadata for workflow
    version: '1.2.3',
    userType: 'premium'
  },
  logLevel: LogLevel.INFO,               // Logging verbosity level
  logPrefix: '[Dirigible]'               // Prefix for log messages
});
```

## Supported AI providers

- OpenAI
- Anthropic
- Google Gemini
- Custom providers (with manual configuration)

## Configuring log levels

The SDK includes a configurable logging system with different verbosity levels:

```typescript
import { initialize, LogLevel } from '@dirigible-ai/sdk';

// Configure with custom log level
initialize({
  apiKey: 'your-api-key',
  projectId: 'your-project-id',
  logLevel: LogLevel.INFO,
  logPrefix: '[MyApp]' // Custom prefix for log messages
});
```

Available log levels:

- `LogLevel.NONE`: Disable all logs
- `LogLevel.ERROR`: Only show errors
- `LogLevel.WARN`: Show warnings and errors
- `LogLevel.INFO`: Show info, warnings, and errors (default)
- `LogLevel.DEBUG`: Show debug and all above
- `LogLevel.TRACE`: Most verbose level for detailed tracing

You can adjust log levels for different environments:

```typescript
initialize({
  apiKey: 'your-api-key',
  projectId: 'your-project-id',
  environment: process.env.NODE_ENV,
  // Set log level based on environment
  logLevel: process.env.NODE_ENV === 'production' 
    ? LogLevel.WARN
    : LogLevel.DEBUG
});
```

## License

MIT
