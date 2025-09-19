## Multi-Model Workflow: Architecture & Design Example

This document analyzes the multi-model generation workflow implemented in this codebase. It is intended as a reusable reference for designing new workflows with Convex, Convex Agent, and UI streaming.

Referenced files:
- `convex/schema.ts`
- `convex/workflows.ts`
- `convex/agent.ts`
- `convex/chat.ts`
- `components/MultiResponseMessage.tsx`

---

### Goals & Capabilities
- Run multiple LLMs in parallel on a user prompt (master + up to 2 secondary models).
- Capture each model’s initial answer, then a “debate” refinement pass informed by other models.
- Produce a final synthesized answer on the master thread and a structured run summary for rich UI.
- Persist run state, statuses, and prompt message anchors for deep-link UI navigation.
- Stream assistant responses to the UI as they generate, with activity tracking.

---

## Data Model & Indexing

Defined in `convex/schema.ts`.

- `multiModelRuns` table
  - Core document tying together a master user message and all per-model runs.
  - Fields:
    - `masterMessageId: string` – the ID of the original user message on the master thread.
    - `masterThreadId: string` – thread where the user initiated the multi-model run.
    - `masterModelId: MODEL_ID_SCHEMA` – the model used for the final synthesis step.
    - `runSummary?: string` – optional narrative summary.
    - `runSummaryStructured?: RUN_SUMMARY_STRUCTURED` – structured summary for rich UI rendering.
    - `allRuns: Array<{ modelId, threadId, isMaster, status, initialPromptMessageId?, debatePromptMessageId?, errorMessage? }>` – per-model state.
  - Indexes:
    - `by_master_message(masterMessageId)` – fetch the run by the initiating message.
    - `by_master_thread(masterThreadId)` – fetch the latest run for a thread.

- `threadActivities` table
  - Drives global “is generating” indicators per thread and user.
  - Fields: `threadId, userId, activeCount, isGenerating, updatedAt`.
  - Indexes:
    - `by_threadId(threadId)` – unique upsert and lookups.
    - `by_userId_and_isGenerating(userId, isGenerating)` – query all generating threads for a user.

Notes on indexing:
- Queries use `withIndex` in the index order defined by schema (see Convex’s requirement to query indexes in-order).
- We prefer `.unique()` when expecting exactly one `multiModelRuns` doc per `masterMessageId` to hard-fail on duplicates.

---

## Status Model & State Transitions

Status enum: `"initial" | "debate" | "complete" | "error"`.
- Declared in both `schema.ts` and `workflows.ts` for type/validation parity.

Per-model run transitions:
1. `initial` – after saving the model’s initial user prompt message and streaming its first response.
2. `debate` – after the first response finishes and before/while generating a debate-round response.
3. `complete` – after finishing the debate-round response.
4. `error` – upon any failure; we also capture `errorMessage`.

Anchors recorded per stage:
- `initialPromptMessageId` – message id saved when the model first receives the user prompt.
- `debatePromptMessageId` – message id saved when the debate prompt is sent to the model.

All status updates funnel through `internal.workflows.updateRunStatus`, which loads the run (by `masterMessageId`), patches the correct `allRuns[...]` entry, and persists.

---

## Orchestration: Workflow Engine

Implemented in `convex/workflows.ts` using `WorkflowManager`.

Workflow: `multiModelGeneration` with args `{ masterThreadId, masterMessageId, prompt, masterModelId, secondaryModelIds, userId, fileIds? }`.

High-level steps:
1. Create sub-threads for each model (master + secondaries) in parallel via `components.agent.threads.createThread`.
2. Insert a `multiModelRuns` document capturing all sub-threads and initial status = `initial`.
3. Round 1 (Initial): for each model, in parallel, run `internal.workflows.generateModelResponse`.
   - Saves the initial prompt message (with files if provided) to the model’s sub-thread.
   - Streams the model response and then advances status to `debate`.
   - Returns final text for the initial stage.
4. Round 2 (Debate): for each model, in parallel, run `internal.workflows.generateDebateResponse`.
   - Constructs a debate prompt summarizing other models’ initial answers.
   - Streams the refined model response and marks status `complete`.
5. Finalization (parallel):
   - `internal.workflows.generateSynthesisResponse`
     - Runs on the master thread/model.
     - Saves a hidden prompt (see Hidden Prompt Pattern below), streams the final synthesis.
   - `internal.workflows.generateRunSummary`
     - Uses a separate `summaryAgent` and an ephemeral thread to generate a structured JSON summary validated by `zod`.
     - Persists via `internal.workflows.setRunSummaryStructured`.

Concurrency:
- Most sub-steps fan out with `Promise.all`, enabling parallel work per model and per phase.
- Synthesis and summary also run in parallel, independent of per-model completion (after refined texts are available).

Error handling:
- Both generation actions catch and log, transition the run to `error`, and attach `errorMessage`.
- The synthesis action best-effort decrements thread activity in a `finally` block.

Rate limits:
- `rateLimiter.limit(ctx, "globalLLMRequests", { throws: true })` guards all LLM actions.

---

## Convex Agent Integration

Defined in `convex/agent.ts`.

- `AVAILABLE_MODELS` & `MODEL_ID_SCHEMA`
  - Canonicalize supported models, providers, display names, file support, and chat model factories.

- `createAgentWithModel(modelId)`
  - Returns an `Agent` from `@convex-dev/agent` configured with the selected chat model and a `usageHandler`.
  - `usageHandler` computes a best-effort cost estimate using pricing tables, extracts `reasoningTokens` from provider metadata, and records usage via `internal.usage.recordEvent`.

- `masterPromptAgent` – default agent for the app.
- `summaryAgent` – an inexpensive OSS model used for titles and structured summaries.

Message I/O primitives (from `@convex-dev/agent`):
- `saveMessage(ctx, components.agent, { threadId, userId, prompt | message, metadata? })`
  - Persists a user or assistant message; returns `{ messageId }`.
- `thread.streamText({ promptMessageId }, { saveStreamDeltas })`
  - Streams the assistant’s response (saves deltas for live UI).
- `getFile` / `storeFile`
  - Fetch and attach file/image parts to messages. We track attached `fileIds` in message metadata.

Hidden Prompt Pattern:
- Synthesis uses a hidden prefix: `"[HIDDEN_SYNTHESIS_PROMPT]::"` so UI can filter out the system-like synthesis prompt while still streaming assistant output on the same thread (see UI section).

---

## API Surface & Guards (chat.ts)

- `createThread` (action)
  - Creates a new thread and stores preferred model in `summary` for easy later retrieval.
  - Optionally schedules `generateThreadTitle` via `summaryAgent`.

- `sendMessage` (mutation)
  - Auth + rate-limit + budget checks (via `internal.usage.getBudgetStatusInternal`).
  - Optionally updates the thread’s preferred model in its metadata (`summary`).
  - Saves the user message (with file parts if any), bumps `threadActivities`, then schedules `generateResponseStreamingAsync`.

- `startMultiModelGeneration` (action)
  - Auth + rate-limit + budget checks.
  - Validates file support on the master model.
  - Saves the master user message and bumps `threadActivities` for the master thread.
  - Starts the `multiModelGeneration` workflow.

- `generateResponseStreamingAsync` (internalAction)
  - Continues the thread using the thread-local agent and streams text for single-model sends.
  - Decrements `threadActivities` in `finally`.

- `getThreadModel` / `getThreadModelInternal`
  - Reads the model preference from the thread’s `summary`.

- `listThreadMessages` (query)
  - Streams messages and deltas.
  - Filters out messages whose text starts with the hidden synthesis prefix.

- `listSecondaryThreadMessages` (query)
  - Streams sub-thread messages (no auth by design since sub-threads are ephemeral and used only for this workflow’s UI).

- `updateThreadActivity` (internalMutation) & `getGeneratingThreadIds` (query)
  - Maintain and expose per-thread activity counts for global UI indicators.

Security:
- `authorizeThreadAccess` ensures only the owning user can read/write a thread.
- Secondary threads are temporary and read-only to the user; the workflow UI accesses them without `authorizeThreadAccess`.

---

## UI Wiring (MultiResponseMessage.tsx)

Component: `MultiResponseMessage`
- `useQuery(api.chat.getMultiModelRun, { masterMessageId })` drives run status and metadata.
- Renders two grids of per-model `RunStatusCard`s, one for Initial and one for Debate, reflecting `allRuns[].status`.
- Each card has an “Open Thread” button that opens `RunDetailsModal`.
- `RunDetailsModal` loads live messages for the selected sub-thread via `useThreadMessages(api.chat.listSecondaryThreadMessages, ...)` and renders them using shared `MessageBubble` UI.
- Final summary section shows either a compact overview or a full table from `runSummaryStructured`, with a fallback to narrative `runSummary` text when not yet available.

Visual signaling:
- Status icons map 1:1 to the state machine.
- Errors render inline from `errorMessage` attached in workflow actions.
- Model/provider logos are derived from `convex/agent.ts` for consistent theming.

Hidden prompt filtering:
- Synthesis prompt is saved in the master thread but filtered out by `listThreadMessages` so users only see assistant outputs.

Accessibility & UX:
- Collapsible sections, skeletons/spinners while generating, and an explicit two-phase layout make progress legible.

---

## Files & Attachments

- Uploads
  - `generateUploadUrl` (mutation) returns a signed URL for direct storage uploads.
  - `registerUploadedFile` and `uploadFile` validate that the selected model supports files and store metadata in Convex Agent’s file system.

- Message composition
  - For file-backed messages, we construct an array mixing `{ type: "text" }` and file/image parts from `getFile`.
  - We record `{ fileIds }` in message metadata for later auditing.

- Enforcement
  - Both `sendMessage` and `startMultiModelGeneration` block uploads when the chosen model has `fileSupport: false`.

---

## Budgeting, Usage & Pricing

- `usageHandler` on every agent aggregates token usage per request (including provider-specific `reasoningTokens` when reported), estimates cost using `MODEL_PRICING_USD_PER_MTOKEN`, and records usage via `internal.usage.recordEvent`.
- Chat entrypoints check `internal.usage.getBudgetStatusInternal` before initiating expensive LLM work.
- Weekly budgets and re-ups are modeled in schema (`weeklyUsage`, `usageReups`) and powered by indexes for fast lookups.

---

## End-to-End Flows

Single-model send (simplified):
1. Client calls `sendMessage(threadId, prompt, modelId?, fileIds?)`.
2. Server validates auth, rate limit, budget, and file support.
3. Save user message; increment `threadActivities`.
4. Schedule `generateResponseStreamingAsync` which streams assistant output and then decrements `threadActivities`.

Multi-model workflow:
1. Client calls `startMultiModelGeneration(threadId, prompt, masterModelId, secondaryModelIds, fileIds?)`.
2. Server validates auth, rate limit, budget, file support; saves user message on master thread; increments `threadActivities`.
3. Workflow engine:
   - Create sub-threads for master + secondary models.
   - Insert `multiModelRuns` document.
   - Round 1: For each sub-thread, save prompt -> stream -> set status `debate`.
   - Round 2: For each sub-thread, save debate prompt -> stream -> set status `complete`.
   - Parallel: Master synthesis (hidden prompt) and structured run summary generation.
4. UI polls `getMultiModelRun(masterMessageId)` and renders per-model status and final summary as they arrive.

---

## Design Trade-offs & Rationale

- Parallelism vs determinism
  - Running models in parallel minimizes latency but requires robust status tracking and idempotent updates. We store prompt anchors and statuses to reconstitute UI state.

- Hidden prompts
  - Using a sentinel prefix lets us keep synthesis on the same master thread (for continuity, provenance, and audit) without confusing the user with system-like prompts.

- Ephemeral summary threads
  - Prevent polluting the master conversation with summary prompts and ensure all summary messages are discardable if the step is re-run.

- Secondary thread authorization
  - Omitted by design to simplify view access from the workflow component since sub-threads are temporary and contain only generated content for the same user session.

- Status source of truth
  - Centralizing transitions in `updateRunStatus` avoids race conditions and ensures consistent UI reads.

---

## Extending This Pattern

- Add more stages
  - Introduce new enums in `RUN_STATUS` and augment `updateRunStatus` + UI cards. For stages with distinct prompts, record additional `...PromptMessageId` fields.

- Add more models
  - Update `AVAILABLE_MODELS` and `MODEL_ID_SCHEMA`. Enforce `fileSupport` where needed. UI renders new model combinations automatically from `allRuns`.

- Change summary format
  - Update the Zod schema used by `generateRunSummary`; mirror the validator in `schema.ts` for persisted structure typing.

- Cost/budget policies
  - Adjust `MODEL_PRICING_USD_PER_MTOKEN` or budget checks. Consider per-model rate limits in addition to global gates.

- Observability
  - Expand usage logging, annotate `allRuns` with more metadata (latency, token counts per stage), and expose these in the UI.

---

## Implementation Notes & Pitfalls

- Always use Convex’s new function syntax and validators for `args` and `returns` across queries, mutations, and actions.
- When saving messages that include files, ensure that the selected model supports files; otherwise throw early.
- Use `withIndex` and `.unique()` or `.take(1)` with sort to avoid table scans and to force correctness assumptions.
- Keep `updateThreadActivity` increments/decrements in `try/finally` blocks where possible to avoid stuck spinners.
- When streaming, call `await result.consumeStream()` to flush all deltas before considering a stage complete.
- Never call `ctx.db` from actions other than through `ctx.run*` method calls; actions don’t have direct DB access.
- Names in `AVAILABLE_MODELS` must stay consistent with `MODEL_ID_SCHEMA`.

---

## Quick Reference: Key Functions

- Workflow
  - `multiModelGeneration(step, args)` – orchestrates per-model initial + debate, then synthesis + summary.
  - `generateModelResponse` – save initial prompt, stream response, status -> `debate`.
  - `generateDebateResponse` – save debate prompt, stream response, status -> `complete`.
  - `generateSynthesisResponse` – hidden prompt + streaming on master thread.
  - `generateRunSummary` – structured summary via `summaryAgent` + Zod, persisted by `setRunSummaryStructured`.

- Chat
  - `startMultiModelGeneration` – entrypoint to start the workflow from the UI.
  - `getMultiModelRun` / `getLatestMultiModelRunForThread` – run lookups for rendering.
  - `getRunStepInfo` – anchor to a stage’s `promptMessageId` for deep links.
  - `listSecondaryThreadMessages` – stream sub-thread content for per-model modals.

- Agent
  - `createAgentWithModel` – per-model agent factory with cost recording.
  - `summaryAgent` – low-cost agent for titles/summaries.

---

This pattern demonstrates a scalable, observable approach to multi-model orchestration with first-class UI streaming. It keeps state transitions explicit, persists anchors for navigation, separates synthesis/system prompts from user-visible content, and cleanly composes Convex Agent primitives for messaging, files, and streaming.
