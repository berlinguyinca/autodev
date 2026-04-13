# Dependency Graph

## Most Imported Files (change these carefully)

- `src/types/index.ts` — imported by **25** files
- `src/ai/errors.ts` — imported by **12** files
- `src/ai/router.ts` — imported by **10** files
- `src/github/client.ts` — imported by **10** files
- `src/config/state.ts` — imported by **9** files
- `src/git/operations.ts` — imported by **7** files
- `src/config/index.ts` — imported by **6** files
- `src/pipeline/issue-processor.ts` — imported by **5** files
- `src/pipeline/test-runner.ts` — imported by **5** files
- `src/git/index.ts` — imported by **5** files
- `src/ai/base-wrapper.ts` — imported by **4** files
- `src/ai/file-scanner.ts` — imported by **4** files
- `src/pipeline/merge-processor.ts` — imported by **4** files
- `src/pipeline/spec-cache.ts` — imported by **4** files
- `src/github/index.ts` — imported by **3** files
- `src/ai/index.ts` — imported by **3** files
- `src/pipeline/index.ts` — imported by **3** files
- `src/pipeline/runner.ts` — imported by **3** files
- `src/pipeline/prompts.ts` — imported by **3** files
- `src/ai/claude-wrapper.ts` — imported by **2** files

## Import Map (who imports what)

- `src/types/index.ts` ← `src/ai/claude-wrapper.ts`, `src/ai/codex-wrapper.ts`, `src/ai/map-wrapper.ts`, `src/ai/ollama-wrapper.ts`, `src/ai/router.ts` +20 more
- `src/ai/errors.ts` ← `src/ai/base-wrapper.ts`, `src/ai/claude-wrapper.ts`, `src/ai/codex-wrapper.ts`, `src/ai/index.ts`, `src/ai/map-wrapper.ts` +7 more
- `src/ai/router.ts` ← `src/ai/index.ts`, `src/pipeline/issue-processor.ts`, `src/pipeline/merge-processor.ts`, `src/pipeline/runner.ts`, `test/integration/ai/router.test.ts` +5 more
- `src/github/client.ts` ← `src/github/index.ts`, `src/github/index.ts`, `src/pipeline/issue-processor.ts`, `src/pipeline/merge-processor.ts`, `src/pipeline/runner.ts` +5 more
- `src/config/state.ts` ← `src/ai/router.ts`, `src/config/index.ts`, `src/pipeline/issue-processor.ts`, `src/pipeline/runner.ts`, `test/integration/ai/router.test.ts` +4 more
- `src/git/operations.ts` ← `src/git/index.ts`, `src/pipeline/issue-processor.ts`, `src/pipeline/merge-processor.ts`, `test/integration/git/operations.test.ts`, `test/unit/git/operations.test.ts` +2 more
- `src/config/index.ts` ← `src/index.ts`, `test/integration/pipeline/e2e.test.ts`, `test/unit/config/config-non-error.test.ts`, `test/unit/config/config.test.ts`, `test/unit/config/state.test.ts` +1 more
- `src/pipeline/issue-processor.ts` ← `src/pipeline/index.ts`, `src/pipeline/runner.ts`, `test/unit/pipeline/issue-processor.test.ts`, `test/unit/pipeline/runner-perf.test.ts`, `test/unit/pipeline/runner.test.ts`
- `src/pipeline/test-runner.ts` ← `src/pipeline/index.ts`, `src/pipeline/index.ts`, `src/pipeline/issue-processor.ts`, `test/unit/pipeline/issue-processor.test.ts`, `test/unit/pipeline/test-runner.test.ts`
- `src/git/index.ts` ← `src/pipeline/issue-processor.ts`, `src/pipeline/merge-processor.ts`, `src/pipeline/runner.ts`, `test/unit/pipeline/issue-processor.test.ts`, `test/unit/pipeline/merge-processor.test.ts`
