# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Type-check (tsc --noEmit); no emit step in dev
pnpm lint             # ESLint over src/ and test/
pnpm test             # Run all tests (unit + integration)
pnpm test:unit        # Run unit tests only (test/unit/**)
pnpm test:integration # Run integration tests only (test/integration/**)
pnpm test:coverage    # Run all tests with V8 coverage (80% threshold enforced)
```

Run a single test file:
```bash
pnpm vitest run test/unit/pipeline/runner.test.ts
```

The project is ESM-only (`"type": "module"`), uses NodeNext module resolution, and imports must include `.js` extensions (even for `.ts` source files).

## Architecture

This is a **CLI pipeline tool** — no server, no UI. Entry point: `src/index.ts` → `run()` which wires up dependencies and delegates to `PipelineRunner`.

### Core Data Flow

```
repos.json (config)  +  GITHUB_TOKEN (env)
        ↓
PipelineRunner.run()          — iterates repos × open issues up to maxIssuesPerRun
        ↓
IssueProcessor.processIssue() — per-issue orchestration (18 steps)
  ├─ StateManager              — skip if already processed; track quota
  ├─ GitHubClient              — fetch issues, create/manage branches and PRs
  ├─ GitOperations             — clone to tmpdir, branch, commit, push, cleanup
  └─ AIRouter                  — routes AI calls with quota-aware fallback chain
        ├─ ClaudeWrapper  (primary, quota-limited)
        ├─ CodexWrapper   (secondary, quota-limited)
        └─ OllamaWrapper  (tertiary, unlimited)
```

### Per-Issue Pipeline Steps (IssueProcessor)

Each issue goes through up to **4 AI calls** in order:
1. `invokeStructured` — generate spec from issue title + body
2. `invokeAgent` — implement spec (agentic, writes files in cloned tmpdir)
3. `invokeStructured` — review the PR diff, produce `ReviewComment[]`
4. `invokeAgent` — address review comments in-place

Steps 3 and 4 are non-fatal and skipped on AI failure. PR is created as **draft** if tests fail or AI failed; regular PR otherwise.

### AI Layer

`AIProvider` interface (`src/types/index.ts`):
- `invokeStructured<T>` — run the CLI with `--output-format json`, parse response against a JSON schema; returns `StructuredResult<T>`
- `invokeAgent` — run the CLI in agentic/autonomous mode in a working directory; returns `AgentResult`

`AIRouter` selects the first model in the chain `claude → codex → ollama` that has remaining quota. `AIBinaryNotFoundError` causes fallthrough; other errors (`AITimeoutError`, `AIInvocationError`) propagate immediately.

`invokeProcess` (`src/ai/base-wrapper.ts`) is the shared `spawn` wrapper used by all three CLI wrappers. It handles ENOENT → `AIBinaryNotFoundError`, timeout → `AITimeoutError`, non-zero exit → `AIInvocationError`.

### State File

`.pipeline-state.json` (written atomically via tmp-rename) persists:
- `processedIssues: Record<"owner/name", number[]>` — prevents duplicate processing
- `quota.claude` / `quota.codex` — monthly call counts with auto-reset at UTC month boundary

### Key Constraints

- **No build step for running tests** — Vitest imports TypeScript directly via the `tsconfig.test.json` (extends main tsconfig, includes test/).
- **TypeScript strictness** — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature` are all enabled.
- **Coverage thresholds** — 80% statements/branches/functions/lines. Index re-export files are excluded from coverage.
- **Git identity** — `GitOperations.clone()` sets `user.email` and `user.name` in each cloned repo for CI environments where git identity is unset.
