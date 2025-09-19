# Threads

Threads are a way to group messages together in a linear history. All messages saved in the Agent component are associated with a thread. When a message is generated based on a prompt, it saves the user message and generated agent message(s) automatically.

Threads can be associated with a user, and messages can each individually be associated with a user. By default, messages are associated with the thread's user.

## Creating a thread[​](#creating-a-thread "Direct link to Creating a thread")

You can create a thread in a mutation or action. If you create it in an action, it will also return a `thread` (see below) and you can start calling LLMs and generating messages. If you specify a userId, the thread will be associated with that user and messages will be saved to the user's history.

```
import { createThread } from "@convex-dev/agent";

const threadId = await createThread(ctx, components.agent);
```

You may also pass in metadata to set on the thread:

```
const userId = await getAuthUserId(ctx);
const threadId = await createThread(ctx, components.agent, {
  userId,
  title: "My thread",
  summary: "This is a summary of the thread",
});
```

Metadata may be provided as context to the agent automatically in the future, but for now it's a convenience that helps organize threads in the [Playground](/agents/playground.md).

## Generating a message in a thread[​](#generating-a-message-in-a-thread "Direct link to Generating a message in a thread")

You can generate a message in a thread via the agent functions: `agent.generateText`, `agent.generateObject`, `agent.streamText`, and `agent.streamObject`. Any agent can generate a message in a thread created by any other agent.

```
const agent = new Agent(components.agent, { languageModel, instructions });

export const generateReplyToPrompt = action({
  args: { prompt: v.string(), threadId: v.string() },
  handler: async (ctx, { prompt, threadId }) => {
    // await authorizeThreadAccess(ctx, threadId);
    const result = await agent.generateText(ctx, { threadId }, { prompt });
    return result.text;
  },
});
```

See [Messages](/agents/messages.md) for more details on creating and saving messages.

## Continuing a thread using the `thread` object from `agent.continueThread`[​](#continuing-a-thread-using-the-thread-object-from-agentcontinuethread "Direct link to continuing-a-thread-using-the-thread-object-from-agentcontinuethread")

You can also continue a thread by creating an agent-specific `thread` object, either when calling `agent.createThread` or `agent.continueThread` from within an action. This allows calling methods without specifying those parameters each time.

```
const { thread } = await agent.continueThread(ctx, { threadId });
const result = await thread.generateText({ prompt });
```

The `thread` from `continueThread` or `createThread` (available in actions only) is a `Thread` object, which has convenience methods that are thread-specific:

* `thread.getMetadata()` to get the `userId`, `title`, `summary` etc.
* `thread.updateMetadata({ patch: { title, summary, userId} })` to update the metadata
* `thread.generateText({ prompt, ... })` - equivalent to `agent.generateText(ctx, { threadId }, { prompt, ... })`
* `thread.streamText({ prompt, ... })` - equivalent to `agent.streamText(ctx, { threadId }, { prompt, ... })`
* `thread.generateObject({ prompt, ... })` - equivalent to `agent.generateObject(ctx, { threadId }, { prompt, ... })`
* `thread.streamObject({ prompt, ... })` - equivalent to `agent.streamObject(ctx, { threadId }, { prompt, ... })`

See [Messages docs](/agents/messages.md) for more details on generating messages.

## Deleting threads[​](#deleting-threads "Direct link to Deleting threads")

You can delete threads by their `threadId`.

Asynchronously (from a mutation or action):

```
await agent.deleteThreadAsync(ctx, { threadId });
```

Synchronously in batches (from an action):

```
await agent.deleteThreadSync(ctx, { threadId });
```

You can also delete all threads by a user by their `userId`.

```
await agent.deleteThreadsByUserId(ctx, { userId });
```

## Getting all threads owned by a user[​](#getting-all-threads-owned-by-a-user "Direct link to Getting all threads owned by a user")

```
const threads = await ctx.runQuery(
  components.agent.threads.listThreadsByUserId,
  { userId, paginationOpts: args.paginationOpts },
);
```

## Deleting all threads and messages associated with a user[​](#deleting-all-threads-and-messages-associated-with-a-user "Direct link to Deleting all threads and messages associated with a user")

Asynchronously (from a mutation or action):

```
await ctx.runMutation(components.agent.users.deleteAllForUserIdAsync, {
  userId,
});
```

Synchronously (from an action):

```
await ctx.runMutation(components.agent.users.deleteAllForUserId, { userId });
```

## Getting messages in a thread[​](#getting-messages-in-a-thread "Direct link to Getting messages in a thread")

See [messages.mdx](/agents/messages.md) for more details.

```
import { listMessages } from "@convex-dev/agent";

const messages = await listMessages(ctx, components.agent, {
  threadId,
  excludeToolMessages: true,
  paginationOpts: { cursor: null, numItems: 10 }, // null means start from the beginning
});
```
# Messages

The Agent component stores message and [thread](/agents/threads.md) history to enable conversations between humans and agents.

To see how humans can act as agents, see [Human Agents](/agents/human-agents.md).

## Generating a message[​](#generating-a-message "Direct link to Generating a message")

To generate a message, you provide a prompt (as a string or a list of messages) to be used as context to generate one or more messages via an LLM, using calls like `streamText` or `generateObject`.

The message history will be provided by default as context. See [LLM Context](/agents/context.md) for details on configuring the context provided.

The arguments to `generateText` and others are the same as the AI SDK, except you don't have to provide a model. By default it will use the agent's chat model.

Note: `authorizeThreadAccess` referenced below is a function you would write to authenticate and authorize the user to access the thread. You can see an example implementation in [threads.ts](https://github.com/get-convex/agent/blob/main/example/convex/threads.ts).

See [chat/basic.ts](https://github.com/get-convex/agent/blob/main/example/convex/chat/basic.ts) or [chat/streaming.ts](https://github.com/get-convex/agent/blob/main/example/convex/chat/streaming.ts) for live code examples.

### Basic approach (synchronous)[​](#basic-approach-synchronous "Direct link to Basic approach (synchronous)")

```
export const generateReplyToPrompt = action({
  args: { prompt: v.string(), threadId: v.string() },
  handler: async (ctx, { prompt, threadId }) => {
    // await authorizeThreadAccess(ctx, threadId);
    const result = await agent.generateText(ctx, { threadId }, { prompt });
    return result.text;
  },
});
```

Note: best practice is to not rely on returning data from the action.Instead, query for the thread messages via the `useThreadMessages` hook and receive the new message automatically. See below.

### Saving the prompt then generating response(s) asynchronously[​](#saving-the-prompt-then-generating-responses-asynchronously "Direct link to Saving the prompt then generating response(s) asynchronously")

While the above approach is simple, generating responses asynchronously provide a few benefits:

* You can set up optimistic UI updates on mutations that are transactional, so the message will be shown optimistically on the client until the message is saved and present in your message query.
* You can save the message in the same mutation (transaction) as other writes to the database. This message can the be used and re-used in an action with retries, without duplicating the prompt message in the history. See [workflows](/agents/workflows.md) for more details.
* Thanks to the transactional nature of mutations, the client can safely retry mutations for days until they run exactly once. Actions can transiently fail.

Any clients listing the messages will automatically get the new messages as they are created asynchronously.

To generate responses asynchronously, you need to first save the message, then pass the `messageId` as `promptMessageId` to generate / stream text.

```
import { components, internal } from "./_generated/api";
import { saveMessage } from "@convex-dev/agent";
import { internalAction, mutation } from "./_generated/server";
import { v } from "convex/values";

// Step 1: Save a user message, and kick off an async response.
export const sendMessage = mutation({
  args: { threadId: v.id("threads"), prompt: v.string() },
  handler: async (ctx, { threadId, prompt }) => {
    const userId = await getUserId(ctx);
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      userId,
      prompt,
      skipEmbeddings: true,
    });
    await ctx.scheduler.runAfter(0, internal.example.generateResponseAsync, {
      threadId,
      promptMessageId: messageId,
    });
  },
});

// Step 2: Generate a response to a user message.
export const generateResponseAsync = internalAction({
  args: { threadId: v.string(), promptMessageId: v.string() },
  handler: async (ctx, { threadId, promptMessageId }) => {
    await agent.generateText(ctx, { threadId }, { promptMessageId });
  },
});

// This is a common enough need that there's a utility to save you some typing.
// Equivalent to the above.
export const generateResponseAsync = agent.asTextAction();
```

Note: when calling `agent.saveMessage`, embeddings are generated automatically when you save messages from an action and you have a text embedding model set. However, if you're saving messages in a mutation, where calling an LLM is not possible, it will generate them automatically when `generateText` receives a `promptMessageId` that lacks an embedding and you have a text embedding model configured. This is useful for workflows where you want to save messages in a mutation, but not generate them. In these cases, pass `skipEmbeddings: true` to `agent.saveMessage` to avoid the warning. If you're calling `saveMessage` directly, you need to provide the embedding yourself, so `skipEmbeddings` is not a parameter.

### Streaming[​](#streaming "Direct link to Streaming")

Streaming follows the same pattern as the basic approach, but with a few differences, depending on the type of streaming you're doing.

The easiest way to stream is to pass `{ saveStreamDeltas: true }` to `streamText`. This will save chunks of the response as deltas as they're generated, so all clients can subscribe to the stream and get live-updating text via normal Convex queries. See below for details on how to retrieve and display the stream.

```
await foo.streamText(ctx, { threadId }, { prompt }, { saveStreamDeltas: true });
```

This can be done in an async function, where http streaming to a client is not possible. Under the hood it will chunk up the response and debounce saving the deltas to prevent excessive bandwidth usage. You can pass more options to `saveStreamDeltas` to configure the chunking and debouncing.

```
  { saveStreamDeltas: { chunking: "line", throttleMs: 1000 } },
```

* `chunking` can be "word", "line", a regex, or a custom function.
* `throttleMs` is how frequently the deltas are saved. This will send multiple chunks per delta, writes sequentially, and will not write faster than the throttleMs ([single-flighted](https://stack.convex.dev/throttling-requests-by-single-flighting) ).

You can also consume the stream in all the ways you can with the underlying AI SDK - for instance iterating over the content, or using [`result.toDataStreamResponse()`](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text#to-data-stream-response).

```
const result = await thread.streamText({ prompt });
// Note: if you do this, don't also call `.consumeStream()`.
for await (const textPart of result.textStream) {
  console.log(textPart);
}
```

### Saving deltas and returning an interactive stream[​](#saving-deltas-and-returning-an-interactive-stream "Direct link to Saving deltas and returning an interactive stream")

If you want to do both: iterate as the stream is happening, as well as save the deltas, you can pass `{ saveStreamDeltas: { returnImmediately: true } }` to `streamText`. This will return immediately, and you can then iterate over the stream as it happens.

```
const result = await agent.streamText(
  ctx,
  { threadId },
  { prompt },
  { saveStreamDeltas: { returnImmediately: true } },
);

return result.toUIMessageStreamResponse();
```

See below for how to retrieve the stream deltas to a client.

### Generating an object[​](#generating-an-object "Direct link to Generating an object")

Similar to the AI SDK, you can generate or stream an object. The same arguments apply, except you don't have to provide a model. It will use the agent's default chat model.

```
import { z } from "zod/v3";

const result = await thread.generateObject({
  prompt: "Generate a plan based on the conversation so far",
  schema: z.object({...}),
});
```

## Retrieving messages[​](#retrieving-messages "Direct link to Retrieving messages")

For streaming, it will save deltas to the database, so all clients querying for messages will get the stream.

See [chat/basic.ts](https://github.com/get-convex/agent/blob/main/example/convex/chat/basic.ts) for the server-side code, and [chat/streaming.ts](https://github.com/get-convex/agent/blob/main/example/convex/chat/streaming.ts) for the streaming example.

You have a function that both allows paginating over messages. To support streaming, you can also take in a `streamArgs` object and return the `streams` result from `syncStreams`.

```
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { listMessages } from "@convex-dev/agent";
import { components } from "./_generated/api";

export const listThreadMessages = query({
  args: { threadId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await authorizeThreadAccess(ctx, threadId);

    const paginated = await listMessages(ctx, components.agent, args);

    // Here you could filter out / modify the documents
    return paginated;
  },
});
```

### Retrieving streamed deltas[​](#retrieving-streamed-deltas "Direct link to Retrieving streamed deltas")

To retrieve the stream deltas, you only have to make a few changes to the query:

```
import { paginationOptsValidator } from "convex/server";
import { vStreamArgs, listMessages, syncStreams } from "@convex-dev/agent";
import { components } from "./_generated/api";

export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    await authorizeThreadAccess(ctx, threadId);

    const paginated = await listMessages(ctx, components.agent, args);

    const streams = await syncStreams(ctx, components.agent, args);

    return { ...paginated, streams };
  },
});
```

You can then use the instructions below along with the `useSmoothText` hook to show the streaming text in a UI.

## Showing messages in React[​](#showing-messages-in-react "Direct link to Showing messages in React")

See [ChatStreaming.tsx](https://github.com/get-convex/agent/blob/main/example/ui/chat/ChatStreaming.tsx) for a streaming example, or [ChatBasic.tsx](https://github.com/get-convex/agent/blob/main/example/ui/chat/ChatBasic.tsx) for a non-streaming example.

### `useThreadMessages` hook[​](#usethreadmessages-hook "Direct link to usethreadmessages-hook")

The crux is to use the `useThreadMessages` hook. For streaming, pass in `stream: true` to the hook.

```
import { api } from "../convex/_generated/api";
import { useThreadMessages, toUIMessages } from "@convex-dev/agent/react";

function MyComponent({ threadId }: { threadId: string }) {
  const messages = useThreadMessages(
    api.chat.streaming.listMessages,
    { threadId },
    { initialNumItems: 10, stream: true },
  );
  return (
    <div>
      {toUIMessages(messages.results ?? []).map((message) => (
        <div key={message.key}>{message.text}</div>
      ))}
    </div>
  );
}
```

### `toUIMessages` helper[​](#touimessages-helper "Direct link to touimessages-helper")

```
import { toUIMessages, type UIMessage } from "@convex-dev/agent/react";
```

`toUIMessages` is a helper function that transforms messages into AI SDK "UIMessage"s. This is a convenient data model for displaying messages:

* `parts` is an array of parts (e.g. "text", "file", "image", "toolCall", "toolResult")
* `content` is a string of the message content.
* `role` is the role of the message (e.g. "user", "assistant", "system").

The helper also adds some additional fields:

* `key` is a unique identifier for the message.
* `order` is the order of the message in the thread.
* `stepOrder` is the step order of the message in the thread.
* `status` is the status of the message (or "streaming").
* `agentName` is the name of the agent that generated the message.

To reference these, ensure you're importing `UIMessage` from `@convex-dev/agent/react`.

### Text smoothing with `SmoothText` and `useSmoothText`[​](#text-smoothing-with-smoothtext-and-usesmoothtext "Direct link to text-smoothing-with-smoothtext-and-usesmoothtext")

The `useSmoothText` hook is a simple hook that smooths the text as it changes. It can work with any text, but is especially handy for streaming text.

```
import { useSmoothText } from "@convex-dev/agent/react";

// in the component
const [visibleText] = useSmoothText(message.text);
```

You can configure the initial characters per second. It will adapt over time to match the average speed of the text coming in.

By default it won't stream the first text it receives unless you pass in `startStreaming: true`. To start streaming immediately when you have a mix of streaming and non-streaming messages, do:

```
import { useSmoothText, type UIMessage } from "@convex-dev/agent/react";

function Message({ message }: { message: UIMessage }) {
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === "streaming",
  });
  return <div>{visibleText}</div>;
}
```

If you don't want to use the hook, you can use the `SmoothText` component.

```
import { SmoothText } from "@convex-dev/agent/react";

//...
<SmoothText text={message.text} />;
```

### Optimistic updates for sending messages[​](#optimistic-updates-for-sending-messages "Direct link to Optimistic updates for sending messages")

The `optimisticallySendMessage` function is a helper function for sending a message, so you can optimistically show a message in the message list until the mutation has completed on the server.

Pass in the query that you're using to list messages, and it will insert the ephemeral message at the top of the list.

```
const sendMessage = useMutation(
  api.streaming.streamStoryAsynchronously,
).withOptimisticUpdate(
  optimisticallySendMessage(api.streaming.listThreadMessages),
);
```

If your arguments don't include `{ threadId, prompt }` then you can use it as a helper function in your optimistic update:

```
import { optimisticallySendMessage } from "@convex-dev/agent/react";

const sendMessage = useMutation(
  api.chatStreaming.streamStoryAsynchronously,
).withOptimisticUpdate(
  (store, args) => {
    optimisticallySendMessage(api.chatStreaming.listThreadMessages)(store, {
      threadId:
      prompt: /* change your args into the user prompt. */,
    })
  }
);
```

## Saving messages manually[​](#saving-messages-manually "Direct link to Saving messages manually")

By default, the Agent will save messages to the database automatically when you provide them as a prompt, as well as all generated messages.

You can save messages to the database manually using `saveMessage` or `saveMessages`.

* You can pass a `prompt` or a full `message` (`ModelMessage` type)
* The `metadata` argument is optional and allows you to provide more details, such as `sources`, `reasoningDetails`, `usage`, `warnings`, `error`, etc.

### Without the Agent class:[​](#without-the-agent-class "Direct link to Without the Agent class:")

Note: If you aren't using the Agent class with a text embedding model set, you need to pass an `embedding` if you want to save it at the same time.

```
import { saveMessage } from "@convex-dev/agent";

const { messageId } = await saveMessage(ctx, components.agent, {
  threadId,
  userId,
  message: { role: "assistant", content: result },
  metadata: [{ reasoning, usage, ... }] // See MessageWithMetadata type
  agentName: "my-agent",
  embedding: { vector: [0.1, 0.2, ...], model: "text-embedding-3-small" },
});
```

```
import { saveMessages } from "@convex-dev/agent";

const { messages } = await saveMessages(ctx, components.agent, {
  threadId,
  userId,
  messages: [{ role, content }, ...],
  metadata: [{ reasoning, usage, ... }, ...] // See MessageWithMetadata type
  agentName: "my-agent",
  embeddings: { model: "text-embedding-3-small", vectors: [[0.1...], ...] },
});
```

### Using the Agent class:[​](#using-the-agent-class "Direct link to Using the Agent class:")

```
const { messageId } = await agent.saveMessage(ctx, {
  threadId,
  userId,
  prompt,
  metadata,
});
```

```
const { messages } = await agent.saveMessages(ctx, {
  threadId, userId,
  messages: [{ role, content }],
  metadata: [{ reasoning, usage, ... }] // See MessageWithMetadata type
});
```

If you are saving the message in a mutation and you have a text embedding model set, pass `skipEmbeddings: true`. The embeddings for the message will be generated lazily if the message is used as a prompt. Or you can provide an embedding upfront if it's available, or later explicitly generate them using `agent.generateEmbeddings`.

## Configuring the storage of messages[​](#configuring-the-storage-of-messages "Direct link to Configuring the storage of messages")

Generally the defaults are fine, but if you want to pass in multiple messages and have them all saved (vs. just the last one), or avoid saving any input or output messages, you can pass in a `storageOptions` object, either to the Agent constructor or per-message.

The use-case for passing in multiple messages but not saving them is if you want to include some extra messages for context to the LLM, but only the last message is the user's actual request. e.g. `messages = [...messagesFromRag, messageFromUser]`. The default is to save the prompt and all output messages.

```
const result = await thread.generateText({ messages }, {
  storageOptions: {
    saveMessages: "all" | "none" | "promptAndOutput";
  },
});
```

## Message ordering[​](#message-ordering "Direct link to Message ordering")

Each message has `order` and `stepOrder` fields, which are incrementing integers specific to a thread.

When `saveMessage` or `generateText` is called, the message is added to the thread's next `order` with a `stepOrder` of 0.

As response message(s) are generated in response to that message, they are added at the same `order` with the next `stepOrder`.

To associate a response message with a previous message, you can pass in the `promptMessageId` to `generateText` and others.

Note: if the `promptMessageId` is not the latest message in the thread, the context for the message generation will not include any messages following the `promptMessageId`.

## Deleting messages[​](#deleting-messages "Direct link to Deleting messages")

You can delete messages by their `_id` (returned from `saveMessage` or `generateText`) or `order` / `stepOrder`.

By ID:

```
await agent.deleteMessage(ctx, { messageId });
// batch delete
await agent.deleteMessages(ctx, { messageIds });
```

By order (start is inclusive, end is exclusive):

```
// Delete all messages with the same order as a given message:
await agent.deleteMessageRange(ctx, {
  threadId,
  startOrder: message.order,
  endOrder: message.order + 1,
});
// Delete all messages with order 1 or 2.
await agent.deleteMessageRange(ctx, { threadId, startOrder: 1, endOrder: 3 });
// Delete all messages with order 1 and stepOrder 2-4
await agent.deleteMessageRange(ctx, {
  threadId,
  startOrder: 1,
  startStepOrder: 2,
  endOrder: 2,
  endStepOrder: 5,
});
```

## Other utilities:[​](#other-utilities "Direct link to Other utilities:")

```
import { ... } from "@convex-dev/agent";
```

* `serializeDataOrUrl` is a utility function that serializes an AI SDK `DataContent` or `URL` to a Convex-serializable format.
* `filterOutOrphanedToolMessages` is a utility function that filters out tool call messages that don't have a corresponding tool result message.
* `extractText` is a utility function that extracts text from a `ModelMessage`-like object.

### Validators and types[​](#validators-and-types "Direct link to Validators and types")

There are types to validate and provide types for various values

```
import { ... } from "@convex-dev/agent";
```

* `vMessage` is a validator for a `ModelMessage`-like object (with a `role` and `content` field e.g.).
* `MessageDoc` and `vMessageDoc` are the types for a message (which includes a `.message` field with the `vMessage` type).
* `Thread` is the type of a thread returned from `continueThread` or `createThread`.
* `ThreadDoc` and `vThreadDoc` are the types for thread metadata.
* `AgentComponent` is the type of the installed component (e.g. `components.agent`).
* `ToolCtx` is the `ctx` type for calls to `createTool` tools.

# Workflows

Agentic Workflows can be decomposed into two elements:

1. Prompting an LLM (including message history, context, etc.).
2. Deciding what to do with the LLM's response.

We generally call them workflows when there are multiple steps involved, they involve dynamically deciding what to do next, are long-lived, or have a mix of business logic and LLM calls.

Tool calls and MCP come into play when the LLM's response is a specific request for an action to take. The list of available tools and result of the calls are used in the prompt to the LLM.

One especially powerful form of Workflows are those that can be modeled as [durable functions](https://stack.convex.dev/durable-workflows-and-strong-guarantees) that can be long-lived, survive server restarts, and have strong guarantees around retrying, idempotency, and completing.

The simplest version of this could be doing a couple pre-defined steps, such as first getting the weather forecast, then getting fashion advice based on the weather. For a code example, see [workflows/chaining.ts](https://github.com/get-convex/agent/blob/main/example/convex/workflows/chaining.ts).

```
export const getAdvice = action({
  args: { location: v.string(), threadId: v.string() },
  handler: async (ctx, { location, threadId }) => {
    // This uses tool calls to get the weather forecast.
    await weatherAgent.generateText(
      ctx,
      { threadId },
      { prompt: `What is the weather in ${location}?` },
    );
    // This includes previous message history from the thread automatically and
    // uses tool calls to get user-specific fashion advice.
    await fashionAgent.generateText(
      ctx,
      { threadId },
      { prompt: `What should I wear based on the weather?` },
    );
    // We don't need to return anything, since the messages are saved
    // automatically and clients will get the response via subscriptions.
  },
});
```

## Building reliable workflows[​](#building-reliable-workflows "Direct link to Building reliable workflows")

One common pitfall when working with LLMs is their unreliability. API providers have outages, and LLMs can be flaky. To build reliable workflows, you often need three properties:

1. Reliable retries
2. Load balancing
3. Durability and idempotency for multi-step workflows

Thankfully there are Convex components to leverage for these properties.

### Retries[​](#retries "Direct link to Retries")

By default, Convex mutations have these properties by default. However, calling LLMs require side-effects and using the network calls, which necessitates using actions. If you are only worried about retries, you can use the [Action Retrier](https://convex.dev/components/retrier) component.

However, keep reading, as the [Workpool](https://convex.dev/components/workpool) and [Workflow](https://convex.dev/components/workflow) components provide more robust solutions, including retries.

### Load balancing[​](#load-balancing "Direct link to Load balancing")

With long-running actions in a serverless environment, you may consume a lot of resources. And with tasks like ingesting data for RAG or other spiky workloads, there's a risk of running out of resources. To mitigate this, you can use the [Workpool](https://convex.dev/components/workpool) component. You can set a limit on the number of concurrent workers and add work asynchronously, with configurable retries and a callback to handle eventual success / failure.

However, if you also want to manage multi-step workflows, you should use the [Workflow](https://convex.dev/components/workflow) component, which also provides retries and load balancing out of the box.

### Durability and idempotency for multi-step workflows[​](#durability-and-idempotency-for-multi-step-workflows "Direct link to Durability and idempotency for multi-step workflows")

When doing multi-step workflows that can fail mid-way, you need to ensure that the workflow can be resumed from where it left off, without duplicating work. The [Workflow](https://convex.dev/components/workflow) builds on the [Workpool](https://convex.dev/components/workpool) to provide durable execution of long running functions with retries and delays.

Each step in the workflow is run, with the result recorded. Even if the server fails mid-way, it will resume with the latest incomplete step, with configurable retry settings.

## Using the Workflow component for long-lived durable workflows[​](#using-the-workflow-component-for-long-lived-durable-workflows "Direct link to Using the Workflow component for long-lived durable workflows")

The [Workflow component](https://convex.dev/components/workflow) is a great way to build long-lived, durable workflows. It handles retries and guarantees of eventually completing, surviving server restarts, and more. Read more about durable workflows in [this Stack post](https://stack.convex.dev/durable-workflows-and-strong-guarantees).

To use the agent alongside workflows, you can run individual idempotent steps that the workflow can run, each with configurable retries, with guarantees that the workflow will eventually complete. Even if the server crashes mid-workflow, the workflow will pick up from where it left off and run the next step. If a step fails and isn't caught by the workflow, the workflow's onComplete handler will get the error result.

### Exposing the agent as Convex actions[​](#exposing-the-agent-as-convex-actions "Direct link to Exposing the agent as Convex actions")

You can expose the agent's capabilities as Convex functions to be used as steps in a workflow.

To create a thread as a standalone mutation, similar to `createThread`:

```
export const createThread = supportAgent.createThreadMutation();
```

For an action that generates text in a thread, similar to `thread.generateText`:

```
export const getSupport = supportAgent.asTextAction({
  stopWhen: stepCountIs(10),
});
```

You can also expose a standalone action that generates an object.

```
export const getStructuredSupport = supportAgent.asObjectAction({
  schema: z.object({
    analysis: z.string().describe("A detailed analysis of the user's request."),
    suggestion: z.string().describe("A suggested action to take."),
  }),
});
```

To save messages explicitly as a mutation, similar to `agent.saveMessages`:

```
export const saveMessages = supportAgent.asSaveMessagesMutation();
```

This is useful for idempotency, as you can first create the user's message, then generate a response in an unreliable action with retries, passing in the existing messageId instead of a prompt.

### Using the agent actions within a workflow[​](#using-the-agent-actions-within-a-workflow "Direct link to Using the agent actions within a workflow")

You can use the [Workflow component](https://convex.dev/components/workflow) to run agent flows. It handles retries and guarantees of eventually completing, surviving server restarts, and more. Read more about durable workflows [in this Stack post](https://stack.convex.dev/durable-workflows-and-strong-guarantees).

```
const workflow = new WorkflowManager(components.workflow);

export const supportAgentWorkflow = workflow.define({
  args: { prompt: v.string(), userId: v.string() },
  handler: async (step, { prompt, userId }) => {
    const { threadId } = await step.runMutation(internal.example.createThread, {
      userId,
      title: "Support Request",
    });
    const suggestion = await step.runAction(internal.example.getSupport, {
      threadId,
      userId,
      prompt,
    });
    const { object } = await step.runAction(
      internal.example.getStructuredSupport,
      {
        userId,
        message: suggestion,
      },
    );
    await step.runMutation(internal.example.sendUserMessage, {
      userId,
      message: object.suggestion,
    });
  },
});
```

See the code in [workflows/chaining.ts](https://github.com/get-convex/agent/blob/main/example/convex/workflows/chaining.ts).

## Complex workflow patterns[​](#complex-workflow-patterns "Direct link to Complex workflow patterns")

While there is only an example of a simple workflow here, there are many complex patterns that can be built with the Agent component:

* Dynamic routing to agents based on an LLM call or vector search
* Fanning out to LLM calls, then combining the results
* Orchestrating multiple agents
* Cycles of Reasoning and Acting (ReAct)
* Modeling a network of agents messaging each other
* Workflows that can be paused and resumed

<!-- -->

[Convex component](https://www.convex.dev/components/retrier)

### [Action Retrier](https://www.convex.dev/components/retrier)

[Add reliability to unreliable external service calls. Retry idempotent calls with exponential backoff until success.](https://www.convex.dev/components/retrier)

[Convex component](https://www.convex.dev/components/workpool)

### [Workpool](https://www.convex.dev/components/workpool)

[Builds on the Action Retrier to provide parallelism limits and retries to manage large numbers of external requests efficiently.](https://www.convex.dev/components/workpool)

[Convex component](https://www.convex.dev/components/workflow)

### [Workflow](https://www.convex.dev/components/workflow)

[Builds on the Workpool to provide durable execution of long running functions with retries and delays.](https://www.convex.dev/components/workflow)