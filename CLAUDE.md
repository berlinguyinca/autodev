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
pnpm test:coverage    # Run all tests with V8 coverage (100% threshold enforced)
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
config.yaml (YAML config)  +  GITHUB_TOKEN (env)
        ↓
PipelineRunner.run()          — iterates repos �� open issues up to maxIssuesPerRun
        ↓
IssueProcessor.processIssue() — per-issue orchestration
  ├��� StateManager              — skip if already processed; track quota
  ├─ GitHubClient              — fetch issues, create/manage branches and PRs
  ├─ GitOperations             — clone to tmpdir, branch, commit, push, cleanup
  └─ AIRouter                  — routes AI calls with configurable provider chain
        ├─ MAPWrapper    (full pipeline: spec→review→execute with TDD)
        ��─ ClaudeWrapper (quota-limited)
        ���─ CodexWrapper  (quota-limited)
        └─ OllamaWrapper (unlimited, no agent support)
```

Provider chain order is configurable via `providerChain` in `config.yaml`. Falls back to `repos.json` (JSON) if `config.yaml` is absent. See `config.yaml.example` for all options.

### Per-Issue Pipeline Steps (IssueProcessor)

Each issue goes through AI calls in order:
1. `invokeStructuredThenAgent` — combined spec generation + implementation. For standard providers (Claude/Codex): generates spec via `invokeStructured`, then implements via `invokeAgent`. For full-pipeline providers (MAP): runs the entire spec→review→execute cycle in a single `invokeAgent` call.
2. `invokeStructured` — review the PR diff, produce `ReviewComment[]`
3. `invokeAgent` — address review comments in-place

Steps 2 and 3 are non-fatal and skipped on AI failure. PR is created as **draft** if tests fail or AI failed; regular PR otherwise.

### AI Layer

`AIProvider` interface (`src/types/index.ts`):
- `invokeStructured<T>` — run the CLI with `--output-format json`, parse response against a JSON schema; returns `StructuredResult<T>`
- `invokeAgent` — run the CLI in agentic/autonomous mode in a working directory; returns `AgentResult`

`AIRouter` iterates through the configurable `providerChain` (default: `[claude, codex, ollama]`), selecting the first provider with remaining quota via `StateManager.hasQuota()`. `AIBinaryNotFoundError` causes fallthrough; other errors propagate immediately. Providers with `handlesFullPipeline: true` (e.g., MAPWrapper) skip `invokeStructured` and handle spec+implementation atomically.

`MAPWrapper` spawns `map --headless` as a CLI subprocess, which runs the multi-agent-pipeline's full spec→review→execute cycle with TDD internally.

`invokeProcess` (`src/ai/base-wrapper.ts`) is the shared `spawn` wrapper used by all four CLI wrappers. It handles ENOENT → `AIBinaryNotFoundError`, timeout → `AITimeoutError`, non-zero exit → `AIInvocationError`.

### State File

`.pipeline-state.json` (written atomically via tmp-rename) persists:
- `processedIssues: Record<"owner/name", number[]>` — prevents duplicate processing
- `quota: Record<string, QuotaState>` — per-provider monthly call counts with auto-reset at UTC month boundary (extensible to any provider)

### Key Constraints

- **No build step for running tests** — Vitest imports TypeScript directly via the `tsconfig.test.json` (extends main tsconfig, includes test/).
- **TypeScript strictness** — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature` are all enabled.
- **Coverage thresholds** — 100% statements/branches/functions/lines. Entry point (`src/index.ts`) and type definitions (`src/types/index.ts`) are excluded from coverage.
- **Git identity** — `GitOperations.clone()` sets `user.email` and `user.name` in each cloned repo for CI environments where git identity is unset.
