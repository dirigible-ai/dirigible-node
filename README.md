# Dirigible: AI Observability SDK

Official JavaScript / TypeScript library for the [Dirigible AI](https://dirigible.ai) API.

A lightweight SDK for monitoring AI and Large Language Model (LLM) workflows.

Simply wrap AI clients for comprehensive observability, and add a decorator to your existing LLM methods for adding specific metadata.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Getting started](#getting-started)
- [Global metadata](#global-metadata)
- [Making sure logs are sent](#making-sure-logs-are-sent)
- [Streaming](#streaming)
- [Manual management](#manual-management)
- [Configuring log levels](#configuring-log-levels)
- [Configuration options](#configuration-options)
- [Supported AI providers](#supported-ai-providers)
- [License](#license)

## Features

- 🪄 **Single wrapper**: One `observeAIClient` wrapper for all AI providers
- 🔍 **Auto-detection**: Automatically detects OpenAI, Anthropic, and Gemini models
- 🔄 **Workflow tracking**: Automatically group related interactions into workflows
- 🏷️ **Rich metadata**: Attach custom metadata at global, workflow, and request levels
- 📊 **Smart metrics**: Tracks token usage, latency, and other metrics automatically
- 🧠 **Configurable sampling**: Control logging rate for high-volume applications
- 📝 **Flexible logging**: Configurable log levels for development and production
- 🚀 **Minimal performance impact**: Efficient batched logging with low overhead

## Installation

```bash
npm install @dirigible-ai/sdk
```

## Getting started

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

The SDK supports OpenAI, Anthropic and Google Gemini:
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

### 3. Add workflow metadata

The SDK automatically tracks entire application workflows. Every LLM call is automatically associated with the current workflow.

You can add workflow metadata when initializing:

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

Use the `@observeLLM` decorator to add metadata to specific LLM calls:

```typescript
import { observeLLM } from '@dirigible-ai/sdk';
import OpenAI from 'openai';

class AIService {
  private openai = observeAIClient(new OpenAI({ apiKey: 'your-openai-key' }));
  
  // Add the decorator just above the method calling the LLM
  @observeLLM({
    requestSource: 'web-app',
    userId: '123',
    taskType: 'classification'
  })
  async classifyText(text: string) {
    return this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: text }]
    });
  }
}
```

You can also use a function to generate dynamic metadata:

```typescript
import { observeLLM } from '@dirigible-ai/sdk';

class DynamicMetadataService {
  @observeLLM((params) => ({
    promptLength: params.messages[0].content.length,
    timestamp: new Date().toISOString(),
    userId: getCurrentUser().id
  }))
  async generateResponse(prompt: string) {
    // Your LLM call here
    return this.llmClient.complete(prompt);
  }
}
```

That's it! With those 4 steps, your AI interactions and workflows are tracked and visualized in your Dirigible dashboard with the right metadata.

## Global metadata

You can add global metadata that will be included with all requests (interactions and workflows):

```typescript
import { setGlobalMetadata, addGlobalMetadata } from '@dirigible-ai/sdk';

// Set initial global metadata
setGlobalMetadata({
  application: 'my-app',
  version: '1.2.3'
});

// Add more metadata later in your workflow
addGlobalMetadata({
  deploymentRegion: 'us-west'
});
```

## Making sure logs are sent

This should be automatic but when running scripts or processes that exit quickly, you can flush logs before exiting:

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

## Manual management

For more control, you can manually create and manage workflows:

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
    
    // Return chat methods
    return {
      async sendMessage(message: string) {
        // Get current workflow metadata
        const workflowData = chatWorkflow.getMetadata();
        
        // Make the LLM call
        const response = await this.llmClient.generateResponse(message);
        
        // Log the interaction with workflow metadata
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
        // End the workflow when chat ends
        endWorkflow({ 
          outcome: 'completed',
          finalState: 'conversation_ended'
        });
      }
    };
  }
}
```

You can log manually when automatic instrumentation isn't suitable:

```typescript
import { logLLMInteraction } from '@dirigible-ai/sdk';

// Log an interaction manually
await logLLMInteraction({
  model: 'custom-model',
  request: { prompt: 'Hello, world!' },
  response: { text: 'Hi there!' },
  metadata: {
    source: 'custom-integration'
  }
});
```

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

## License

MIT
