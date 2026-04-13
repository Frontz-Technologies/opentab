# Phase 7 AI Assistant Design

## Goal

Build an AI assistant chat panel accessible from any authenticated page, with function-calling access to organisation-scoped financial data, guarded write actions with user confirmation, inline structured results, multi-language responses, and organisation-level AI settings backed by OpenRouter.

## Scope

Included in Phase 7:

- Global chat entry point and slide-over panel
- Session-scoped conversation history
- Streaming assistant responses
- Read tools for invoices, expenses, contacts, VAT, revenue, expenses, tax projection, and overdue invoices
- Write tools for draft invoice creation, expense creation, and email reminders with explicit confirmation
- Inline table and chart rendering for structured tool results
- AI settings page with enable toggle, API key storage, model selection, and connection test
- Encrypted API key storage in the database
- Role-based restrictions for AI write operations
- Automated tests for core AI flows

Excluded from Phase 7:

- Persistent chat history
- Thread management, titles, pinning, tagging, or transcript export
- File uploads, voice input, or image understanding
- Platform-managed AI credits or usage billing
- User-defined tools or prompt customization

## Final Architecture Decision

Phase 7 will keep the architecture proposed in `.research/phase7.md`, with three design refinements inspired by `wealthfolio`:

1. Use an explicit typed stream event model for assistant output and tool lifecycle updates.
2. Structure the system prompt as named sections with domain guardrails and tool-usage rules.
3. Render structured tool results through dedicated UI components instead of flattening everything into markdown.

Phase 7 will not adopt `wealthfolio`'s persistent thread system, custom runtime framework, or background persistence actor because those add complexity that conflicts with the MVP requirement of session-scoped chat history.

## Design Summary

### UI

The assistant is a right-side slide-over on desktop and a full-height bottom sheet on mobile. A floating action button is mounted in the authenticated app layout so the assistant is reachable from any page without changing navigation structure.

The chat UI is composed from focused components:

- `AiChatButton`
- `AiChatPanel`
- `AiChatHeader`
- `AiChatMessages`
- `AiMessage`
- `AiMarkdown`
- `AiToolResult`
- `AiChart`
- `AiConfirmation`
- `AiChatInput`

Assistant content is rendered in three parallel forms:

- markdown text for narrative answers
- structured cards for tool states and tool results
- inline charts for chart-capable tool output

Conversation history is session-scoped and held client-side in Zustand. The store tracks messages, streaming state, current thread identifier, pending confirmations, and recoverable UI errors. History is capped to avoid oversized context payloads.

### Backend

The backend uses a Next.js route handler at `POST /api/ai/chat` because the chat response must stream. The route authenticates with the existing session, loads organisation AI settings, decrypts the stored API key on the server, constructs the provider and tool registry, and starts a streaming completion.

The provider layer remains simple:

- OpenRouter is accessed through `@ai-sdk/openai`
- provider creation is request-scoped
- credentials never leave the server

AI-specific server code lives under `apps/web/lib/ai/`:

- `provider.ts`
- `encryption.ts`
- `system-prompt.ts`
- `rate-limiter.ts`
- `tools.ts`
- `tools/*`

### Streaming Contract

We will keep the Vercel AI SDK transport, but define an explicit app-level event shape for UI state transitions. The frontend should not infer everything from opaque streamed text. It should have a typed understanding of:

- stream started
- text delta received
- tool call started
- tool result available
- confirmation required
- stream completed
- stream failed

This is the main idea borrowed from `wealthfolio`: a stream is easier to render and test when tool lifecycle events are first-class, not implicit.

If the SDK's native event surface already exposes enough structured information, we will adapt it rather than wrapping it in a second bespoke protocol. If not, we will add the thinnest server-side translation layer needed to make the UI deterministic.

### Tools

All tools are organisation-scoped from the authenticated session. The model never chooses the organisation and never receives raw tenant identifiers as user-controlled inputs.

Read tools:

- `listInvoices`
- `listExpenses`
- `getContact`
- `getRevenueSummary`
- `getExpenseSummary`
- `getTaxProjection`
- `getVatSummary`
- `getOutstandingInvoices`

Write tools:

- `createDraftInvoice`
- `createExpense`
- `sendEmailReminder`

Presentation tool:

- `generateChart`

Tools follow these rules:

- input validation is defined with Zod
- outputs are bounded and structured
- list-style outputs enforce hard limits
- tools call existing business logic or thin wrappers around existing domain queries
- write tools never execute immediately on first invocation

### Confirmation Flow

Write actions follow a two-step flow:

1. The model requests a write tool.
2. The tool returns a confirmation payload with a human-readable summary.
3. The UI renders an approval card with `Approve` and `Cancel`.
4. A follow-up request carries the approval decision.
5. Only after approval does the server execute the underlying mutation.

This keeps the confirmation logic explicit in the UI and avoids hidden writes from model output.

### Prompt Design

The system prompt is generated per request from session and organisation context. It is organized into clear sections rather than one large paragraph:

- identity and role
- organisation context
- behavior rules
- tool usage rules
- safety rules
- country-specific tax context when applicable

This mirrors the strongest prompt-design idea from `wealthfolio`: prompts should be readable, testable, and easy to evolve section by section.

The assistant must:

- answer in the user's language when possible
- use exact figures from tools
- avoid fabricating data
- avoid revealing tool names or internal implementation details
- avoid acting as a legal or tax advisor beyond supported data and calculations

### Security Model

Security constraints are non-negotiable:

- `orgId` comes from the authenticated session only
- all queries remain org-scoped
- API keys are encrypted at rest using AES-256-GCM
- decrypted keys are only used inside server code at request time
- write tools are role-gated before they are exposed
- accountant users are read-only in the assistant
- rate limiting applies per user

### Settings

Phase 7 adds a dedicated AI settings page under `/settings/ai`.

It includes:

- master enable toggle
- masked OpenRouter API key input
- model selector with popular defaults plus custom model entry
- connection test action

These settings are stored in a new `ai_settings` table, one row per organisation.

### Data Model

`ai_settings` stores:

- `org_id`
- `enabled`
- `api_key_encrypted`
- `api_key_iv`
- `api_key_last4`
- `model`
- timestamps

No chat message or thread tables are added in Phase 7.

### Testing

Testing is split by responsibility:

- unit tests for encryption, prompt generation, rate limiting, and tool validation
- integration tests for settings CRUD, encrypted storage, org-scoped tool behavior, and confirmation flow
- API route tests for auth, configuration errors, rate limiting, and streaming behavior
- Playwright coverage for the chat panel and settings workflow

## Wealthfolio Findings Applied

`wealthfolio` is a useful reference, but not a template to copy wholesale.

Ideas adopted:

- typed stream event thinking
- structured prompt sections with explicit guardrails
- dedicated UI treatment for structured tool results

Ideas rejected for Phase 7:

- persistent conversation threads
- custom chat runtime stack
- background persistence actor
- thread metadata and management APIs

## Implementation Boundaries

Files are organized by responsibility:

- database schema stays in `packages/db`
- AI infrastructure stays in `apps/web/lib/ai`
- settings mutations stay in one AI settings action module
- UI components stay under `apps/web/components/ai`
- app integration touches only the authenticated layout and settings navigation

This keeps the change surgical while still delivering the full Phase 7 surface area.

## Risks And Mitigations

### Risk: Streaming event shape is more awkward than the spec implies

Mitigation:

- validate the current `ai` package capabilities first
- prefer adapting native SDK events over introducing a fully custom stream protocol

### Risk: Existing reports and invoicing code may not expose reusable query functions

Mitigation:

- add thin server-side wrappers in Phase 7 instead of refactoring earlier phases
- keep wrappers scoped to AI use cases only

### Risk: Tool output becomes too large for reliable model context

Mitigation:

- enforce limits
- return counts plus truncated slices
- render larger structured outputs in UI cards instead of pushing excessive raw text back into the model

### Risk: Confirmation flow becomes fragile if tied too tightly to client-only state

Mitigation:

- keep confirmations keyed by tool call identifiers
- make approval payloads explicit in the follow-up request contract

## Success Criteria

Phase 7 is complete when:

- the assistant opens from every authenticated page
- responses stream reliably
- read tools answer real financial questions accurately
- write tools require explicit approval before execution
- tool results render as structured cards and charts where appropriate
- AI settings work end-to-end with encrypted key storage
- role restrictions and org scoping are enforced
- automated tests cover the critical paths
