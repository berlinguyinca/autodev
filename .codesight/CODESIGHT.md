# gh-issue-pipeline — AI Context Map

> **Stack:** raw-http | none | react | typescript

> 2 routes (2 inferred) | 0 models | 0 components | 17 lib files | 1 env vars | 0 middleware | 5 events | 100% test coverage
> **Token savings:** this file is ~1,700 tokens. Without it, AI exploration would cost ~15,100 tokens. **Saves ~13,500 tokens per conversation.**
> **Last scanned:** 2026-04-13 20:30 — re-run after significant changes

---

# Routes

- `POST` `/repos/local/test-repo/pulls` [auth, ai] `[inferred]` ✓
- `POST` `/repos/local/test-repo/issues/1/comments` [auth, ai] `[inferred]` ✓

---

# Libraries

- `src/ai/base-wrapper.ts`
  - function invokeProcess: (options) => Promise<InvokeProcessResult>
  - interface InvokeProcessOptions
  - interface InvokeProcessResult
- `src/ai/claude-wrapper.ts` — class ClaudeWrapper
- `src/ai/codex-wrapper.ts` — class CodexWrapper
- `src/ai/errors.ts`
  - class AITimeoutError
  - class AIBinaryNotFoundError
  - class AIInvocationError
- `src/ai/ollama-wrapper.ts` — class OllamaWrapper
- `src/ai/router.ts` — class AIRouter
- `src/config/config.ts` — function loadConfig: (configPath) => PipelineConfig
- `src/config/state.ts` — class StateManager
- `src/git/operations.ts`
  - function buildBranchName: (issueNumber, title) => string
  - function createTempDir: () => string
  - function cleanupTempDir: (dirPath) => void
  - class GitOperations
- `src/github/client.ts`
  - class GitHubClient
  - interface CreatePRParams
  - interface PRResult
- `src/index.ts` — function run: (argv) => void
- `src/pipeline/issue-processor.ts` — class IssueProcessor
- `src/pipeline/prompts.ts`
  - function buildSpecPrompt: (issue) => string
  - function buildImplementationPrompt: (spec, repoName) => string
  - function buildReviewPrompt: (diff) => string
  - function buildFollowUpPrompt: (comments) => string
- `src/pipeline/runner.ts` — class PipelineRunner
- `src/pipeline/test-runner.ts`
  - function detectTestCommand: (dir, repoConfig) => string | null
  - function runTests: (dir, command) => TestResult
  - interface TestResult
- `src/tui/renderer.ts` — function startTUI: (tracker, onQuit) => void, interface TUIHandle
- `src/tui/task-tracker.ts`
  - class TaskTracker
  - interface TaskStartOptions
  - type TaskEvent

---

# Config

## Environment Variables

- `GITHUB_TOKEN` **required** — src/github/client.ts

## Config Files

- `tsconfig.json`

## Key Dependencies

- react: ^19.2.5
- zod: ^3.23.0

---

# Dependency Graph

## Most Imported Files (change these carefully)

- `src/types/index.ts` — imported by **22** files
- `src/ai/errors.ts` — imported by **10** files
- `src/config/state.ts` — imported by **9** files
- `src/ai/router.ts` — imported by **8** files
- `src/github/client.ts` — imported by **8** files
- `src/tui/task-tracker.ts` — imported by **7** files
- `src/git/operations.ts` — imported by **5** files
- `src/config/index.ts` — imported by **5** files
- `src/pipeline/issue-processor.ts` — imported by **5** files
- `src/pipeline/test-runner.ts` — imported by **5** files
- `src/ai/base-wrapper.ts` — imported by **4** files
- `src/github/index.ts` — imported by **3** files
- `src/ai/index.ts` — imported by **3** files
- `src/pipeline/index.ts` — imported by **3** files
- `src/pipeline/runner.ts` — imported by **3** files
- `src/git/index.ts` — imported by **3** files
- `src/ai/claude-wrapper.ts` — imported by **2** files
- `src/ai/codex-wrapper.ts` — imported by **2** files
- `src/ai/ollama-wrapper.ts` — imported by **2** files
- `src/pipeline/prompts.ts` — imported by **2** files

## Import Map (who imports what)

- `src/types/index.ts` ← `src/ai/claude-wrapper.ts`, `src/ai/codex-wrapper.ts`, `src/ai/ollama-wrapper.ts`, `src/ai/router.ts`, `src/config/config.ts` +17 more
- `src/ai/errors.ts` ← `src/ai/base-wrapper.ts`, `src/ai/claude-wrapper.ts`, `src/ai/codex-wrapper.ts`, `src/ai/index.ts`, `src/ai/ollama-wrapper.ts` +5 more
- `src/config/state.ts` ← `src/ai/router.ts`, `src/config/index.ts`, `src/pipeline/issue-processor.ts`, `src/pipeline/runner.ts`, `test/integration/ai/router.test.ts` +4 more
- `src/ai/router.ts` ← `src/ai/index.ts`, `src/pipeline/issue-processor.ts`, `src/pipeline/runner.ts`, `test/integration/ai/router.test.ts`, `test/unit/ai/router.test.ts` +3 more
- `src/github/client.ts` ← `src/github/index.ts`, `src/github/index.ts`, `src/pipeline/issue-processor.ts`, `src/pipeline/runner.ts`, `test/unit/github/client.test.ts` +3 more
- `src/tui/task-tracker.ts` ← `src/pipeline/issue-processor.ts`, `src/pipeline/runner.ts`, `src/tui/index.ts`, `src/tui/index.ts`, `src/tui/renderer.ts` +2 more
- `src/git/operations.ts` ← `src/git/index.ts`, `src/pipeline/issue-processor.ts`, `test/integration/git/operations.test.ts`, `test/unit/git/operations.test.ts`, `test/unit/pipeline/issue-processor.test.ts`
- `src/config/index.ts` ← `src/index.ts`, `test/integration/pipeline/e2e.test.ts`, `test/unit/config/config.test.ts`, `test/unit/config/state.test.ts`, `test/unit/index.test.ts`
- `src/pipeline/issue-processor.ts` ← `src/pipeline/index.ts`, `src/pipeline/runner.ts`, `test/unit/pipeline/issue-processor.test.ts`, `test/unit/pipeline/runner-perf.test.ts`, `test/unit/pipeline/runner.test.ts`
- `src/pipeline/test-runner.ts` ← `src/pipeline/index.ts`, `src/pipeline/index.ts`, `src/pipeline/issue-processor.ts`, `test/unit/pipeline/issue-processor.test.ts`, `test/unit/pipeline/test-runner.test.ts`

---

# Events & Queues

- `task:start` [event] — `src/tui/task-tracker.ts`
- `task:activity` [event] — `src/tui/task-tracker.ts`
- `task:complete` [event] — `src/tui/task-tracker.ts`
- `task:fail` [event] — `src/tui/task-tracker.ts`
- `task:killed` [event] — `src/tui/task-tracker.ts`

---

# Test Coverage

> **100%** of routes and models are covered by tests
> 17 test files found

## Covered Routes

- POST:/repos/local/test-repo/pulls
- POST:/repos/local/test-repo/issues/1/comments

---

_Generated by [codesight](https://github.com/Houseofmvps/codesight) — see your codebase clearly_