# Libraries

> **Navigation aid.** Library inventory extracted via AST. Read the source files listed here before modifying exported functions.

**15 library files** across 6 modules

## Ai (6 files)

- `src/ai/base-wrapper.ts` — invokeProcess, InvokeProcessOptions, InvokeProcessResult
- `src/ai/errors.ts` — AITimeoutError, AIBinaryNotFoundError, AIInvocationError
- `src/ai/claude-wrapper.ts` — ClaudeWrapper
- `src/ai/codex-wrapper.ts` — CodexWrapper
- `src/ai/ollama-wrapper.ts` — OllamaWrapper
- `src/ai/router.ts` — AIRouter

## Pipeline (4 files)

- `src/pipeline/prompts.ts` — buildSpecPrompt, buildImplementationPrompt, buildReviewPrompt, buildFollowUpPrompt
- `src/pipeline/test-runner.ts` — detectTestCommand, runTests, TestResult
- `src/pipeline/issue-processor.ts` — IssueProcessor
- `src/pipeline/runner.ts` — PipelineRunner

## Config (2 files)

- `src/config/config.ts` — loadConfig
- `src/config/state.ts` — StateManager

## Git (1 files)

- `src/git/operations.ts` — buildBranchName, createTempDir, cleanupTempDir, GitOperations

## Github (1 files)

- `src/github/client.ts` — GitHubClient, CreatePRParams, PRResult

## Index.ts (1 files)

- `src/index.ts` — run

---
_Back to [overview.md](./overview.md)_