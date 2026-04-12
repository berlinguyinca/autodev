# gh-issue-pipeline

An autonomous pipeline that fetches open GitHub issues, generates a specification, implements changes using an AI coding assistant (Claude, Codex, or Ollama), runs the project's test suite, opens a pull request, and posts a self-review with follow-up fixes — all without human intervention.

Safe to run on a cron schedule: tracks processed issues and monthly AI quota usage in a local state file to prevent duplicate work.

## Prerequisites

- [Node.js 22+](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation)
- At least one AI provider CLI:
  - [claude](https://docs.anthropic.com/en/docs/claude-code) — primary
  - [codex](https://github.com/openai/codex) — secondary fallback
  - [ollama](https://ollama.com/) with a code model (e.g., `qwen2.5-coder:latest`) — tertiary fallback, no quota limit

## Installation

```bash
git clone https://github.com/your-org/gh-issue-pipeline.git
cd gh-issue-pipeline
pnpm install
pnpm build
```

## Configuration

Create a `repos.json` file in the working directory (or copy the included example):

```json
{
  "repos": [
    {
      "owner": "your-org",
      "name": "your-repo",
      "defaultBranch": "main",
      "testCommand": "npm test"
    }
  ],
  "ollamaModel": "qwen2.5-coder:latest",
  "maxIssuesPerRun": 10,
  "quotaLimits": {
    "claude": 100,
    "codex": 50
  }
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `repos` | array | yes | — | Repositories to process |
| `repos[].owner` | string | yes | — | GitHub organisation or user |
| `repos[].name` | string | yes | — | Repository name |
| `repos[].defaultBranch` | string | no | `main` | Base branch for PRs |
| `repos[].testCommand` | string | no | auto-detected | Command to run tests |
| `repos[].cloneUrl` | string | no | GitHub HTTPS | Override clone URL (useful for local testing) |
| `ollamaModel` | string | no | `qwen2.5-coder:latest` | Ollama model name |
| `maxIssuesPerRun` | number | no | `10` | Max issues to process per invocation |
| `quotaLimits.claude` | number | no | `100` | Monthly call limit for claude |
| `quotaLimits.codex` | number | no | `50` | Monthly call limit for codex |

## Environment

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | yes | Personal access token with `repo` scope |

## Running

```bash
GITHUB_TOKEN=ghp_... pnpm start
```

To use a custom config path:

```bash
GITHUB_TOKEN=ghp_... node dist/index.js --config /path/to/repos.json
```

### Cron example (every 4 hours)

```cron
0 */4 * * * cd /path/to/gh-issue-pipeline && GITHUB_TOKEN=ghp_... node dist/index.js >> /var/log/gh-pipeline.log 2>&1
```

## How It Works

For each open issue across the configured repositories, the pipeline executes up to four AI calls:

```
Issue fetched
  │
  ├─ 1. Generate spec      invokeStructured  →  spec document (goal, files, approach, tests)
  │
  ├─ 2. Implement          invokeAgent       →  AI writes/modifies files in a local clone
  │
  ├─ 3. Review diff        invokeStructured  →  list of ReviewComment (file, line, body)
  │
  └─ 4. Address review     invokeAgent       →  AI applies fixes, commits, pushes
```

After implementation:
- Tests are detected and run automatically (see [Test Detection](#test-detection))
- A **draft PR** is opened if tests fail or an AI call failed; a **regular PR** otherwise
- The run stops before PR creation if the AI produced no commit or the branch could not be pushed
- The PR is labelled `ai-generated` (and `ai-failed` on error)
- A summary comment is posted on the original issue

### Test Detection

If `testCommand` is not set in `repos.json`, the pipeline auto-detects based on lock files and build manifests:

| Signal | Command |
|---|---|
| `pnpm-lock.yaml` | `pnpm test` |
| `package-lock.json` | `npm test` |
| `yarn.lock` | `yarn test` |
| `Makefile` with `test:` target | `make test` |
| `go.mod` | `go test ./...` |
| `Cargo.toml` | `cargo test` |
| `pom.xml` | `mvn test` |

### AI Model Selection

Models are tried in order based on remaining monthly quota:

1. **claude** — used first, up to `quotaLimits.claude` calls/month
2. **codex** — fallback when claude quota is exhausted, up to `quotaLimits.codex` calls/month
3. **ollama** — final fallback, unlimited

If a CLI binary is missing (`ENOENT`), the pipeline falls through to the next provider automatically. Timeout or invocation errors propagate immediately.

### Branch Naming

Branches are created as `ai/<issue-number>-<slugified-title>` (max 50 chars for the slug). If a branch already exists without an open PR, it is deleted and recreated.

## State File

`.pipeline-state.json` is written automatically in the working directory. Writes are atomic (write to `.tmp`, then rename) to prevent corruption.

```json
{
  "processedIssues": {
    "owner/repo": [12, 34, 56]
  },
  "quota": {
    "claude": { "used": 3, "limit": 100, "resetMonth": "2026-04" },
    "codex":  { "used": 0, "limit": 50,  "resetMonth": "2026-04" }
  }
}
```

- **`processedIssues`** — prevents the pipeline from creating duplicate PRs for already-handled issues across runs
- **`quota`** — monthly call counts for `claude` and `codex`; counters reset automatically at the first invocation of a new UTC month

Do not delete this file between runs unless you want the pipeline to re-process already-handled issues.

## Troubleshooting

**Binary not found (`claude` / `codex` / `ollama`)**
Install the missing CLI. The pipeline falls through to the next available provider. If none are reachable, the run fails with `AIBinaryNotFoundError`.

**Quota exhausted**
All three providers are at their monthly limit. Wait for the UTC month boundary (counts reset on the first run of the new month) or increase `quotaLimits` in `repos.json`.

**`GITHUB_TOKEN` missing or invalid**
Set `GITHUB_TOKEN` to a token with `repo` scope. Tokens with only `public_repo` scope cannot push branches to private repositories. The pipeline surfaces HTTP 401/403 with a clear error message.

**Config file not found**
The pipeline looks for `./repos.json` in the working directory by default. Pass `--config <path>` to specify a different location.

**Tests always fail**
Set `testCommand` explicitly in `repos.json` if the auto-detection does not pick the right command, or if the test suite requires environment setup that the pipeline cannot provide.
