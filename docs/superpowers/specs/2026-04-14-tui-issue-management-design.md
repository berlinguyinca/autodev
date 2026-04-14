# TUI Issue Management: Close, Comment, and View Comments

## Context

The TUI currently supports creating and editing issues (title + body) via the form pane. Users need to manage issues more fully without leaving the TUI: closing issues, viewing existing comments, and adding new comments. All operations target the currently loaded issue in the form pane.

## Goal

Add close, view comments, and add comment capabilities to the TUI, accessible via both vim-style commands and normal-mode keyboard shortcuts.

## Scope

### In scope

- Close an issue via `:close` command or `x` key in normal mode.
- View issue comments inline below the body field when an issue is loaded.
- Add a comment via a new "comment" form field, submitted with `:w`.
- Focus the comment field via `:comment` command or `c` key in normal mode.
- New `FormField` value `'comment'` with arrow navigation through title → body → comment.
- Blue `▶` arrow indicator on the comment field, matching title/body.
- Status bar shows `[Comment]` when the comment field is focused.
- Help overlay updated with new keybindings.
- Two new GitHubClient methods: `closeIssue`, `listIssueComments`.
- Wire existing `postIssueComment` + new methods into `TuiDeps`.

### Out of scope

- Editing or deleting existing comments.
- Reacting to comments (emoji reactions).
- Reopening closed issues.
- Inline comment threading or reply-to.
- Comment pagination (fetch first page only).

## Design

### GitHub Client Layer

Add to `GitHubClient` (`src/github/client.ts`):

- `closeIssue(owner: string, name: string, issueNumber: number): Promise<void>` — PATCH `/repos/{owner}/{name}/issues/{issueNumber}` with `{ state: 'closed' }`.
- `listIssueComments(owner: string, name: string, issueNumber: number): Promise<IssueComment[]>` — GET `/repos/{owner}/{name}/issues/{issueNumber}/comments`. Returns `{ author: string; body: string; createdAt: string }[]`. First page only (30 items default).

### Types

Add to `src/types/index.ts` or alongside existing types:

```typescript
interface IssueComment {
  author: string
  body: string
  createdAt: string
}
```

### TuiDeps Extension

Add to `TuiDeps` interface (`src/cli/hooks/useDeps.ts`):

- `closeIssue(owner: string, name: string, issueNumber: number): Promise<void>`
- `listIssueComments(owner: string, name: string, issueNumber: number): Promise<IssueComment[]>`
- `postIssueComment(owner: string, name: string, issueNumber: number, body: string): Promise<void>`

### FormField Extension

Change `FormField` type from `'title' | 'body'` to `'title' | 'body' | 'comment'`.

Navigation order cycles: title → body → comment → title. Arrow up/down, Tab/Shift+Tab in insert mode, and `j`/`k` in vim normal mode all follow this cycle.

### Form Pane Layout

When an issue is loaded and has comments, the IssueForm renders:

```
▶ Title: Fix the login bug
  Body: Users can't log in when...

  ── Comments (3) ──────────────
  @alice (2h ago): Looks like a race condition
  @bob (1h ago): Can confirm on staging
  ── New Comment ───────────────
  > [compose here]
```

- Comments section only appears when `editingIssue !== undefined`.
- Comments are read-only text, listed chronologically.
- Timestamps shown as relative time (e.g., "2h ago", "3d ago").
- The "New Comment" field is a `TextField` that appears below comments.
- The `▶` arrow indicator appears next to all three focusable fields.
- When no issue is loaded (create mode), the comment section is hidden and `FormField` cycles only between title and body.

### Keybindings

#### Normal mode (both basic and vim)

| Key | Action | Condition |
|-----|--------|-----------|
| `x` | Close the loaded issue | Only when `editingIssue !== undefined` |
| `c` | Focus comment field + enter insert mode | Only when `editingIssue !== undefined` |

If `x` or `c` is pressed without a loaded issue, show an error toast: "No issue loaded".

#### Commands

| Command | Action | Condition |
|---------|--------|-----------|
| `:close` | Close the loaded issue | Only when `editingIssue !== undefined` |
| `:comment` | Focus comment field + enter insert mode | Only when `editingIssue !== undefined` |

#### `:w` behavior change

`:w` is context-sensitive based on `formField`:
- `formField === 'title'` or `formField === 'body'`: save issue (existing behavior).
- `formField === 'comment'`: submit the comment text via `postIssueComment`, clear the comment field, refresh the comment list. Do NOT save the issue title/body.

### State Flow

When an issue is loaded (Enter from table):
1. Fetch issue detail (existing).
2. Fetch comments via `listIssueComments`.
3. Store comments in component state: `comments: IssueComment[]`.
4. `formField` defaults to `'title'`.

When `:close` or `x` is pressed:
1. Call `closeIssue`.
2. Show success toast.
3. Clear the form (same as `:e`).
4. Refresh the open issues list.

When a comment is submitted (`:w` on comment field):
1. Call `postIssueComment` with comment text.
2. Clear the comment field.
3. Re-fetch comments via `listIssueComments`.
4. Show success toast.
5. Stay on the current issue (don't clear form).

### Status Bar

`getHints` receives `formField` (already implemented). The `[Comment]` label appears naturally since:
```typescript
const fieldLabel = formField === 'title' ? 'Title' : formField === 'body' ? 'Body' : 'Comment'
```

### Help Overlay

Add to help overlay:
- `x` / `:close` — Close loaded issue
- `c` / `:comment` — Add comment to loaded issue

## Acceptance Criteria

- [ ] `:close` and `x` close the currently loaded issue and refresh the issue list.
- [ ] `:close` and `x` show an error when no issue is loaded.
- [ ] Comments appear inline below the body when an issue is loaded.
- [ ] Arrow navigation cycles through title → body → comment when an issue is loaded.
- [ ] Arrow navigation cycles through title → body only when creating a new issue.
- [ ] `c` and `:comment` focus the comment field and enter insert mode.
- [ ] `:w` on the comment field submits the comment and refreshes the comment list.
- [ ] `:w` on title/body still saves the issue as before.
- [ ] Status bar shows `[Comment]` when comment field is focused.
- [ ] Help overlay includes the new keybindings.
- [ ] Existing tests continue to pass.
- [ ] New tests cover: close flow, comment submission, comment display, field navigation with comment, `:w` context sensitivity.

## Test Plan

- GitHub client: `closeIssue` and `listIssueComments` methods.
- VimProvider: `x` and `c` keybindings fire correct actions; formField cycles through three values when issue is loaded.
- StatusBar: `[Comment]` label appears for comment field.
- IssueForm: comments render when provided; comment field appears only in edit mode.
- tui.tsx: `:close` command flow, `:w` context-sensitive behavior, `:comment` command.

## Files Likely Touched

- `src/types/index.ts` — `IssueComment` type
- `src/github/client.ts` — `closeIssue`, `listIssueComments` methods
- `src/cli/hooks/useDeps.ts` — `TuiDeps` interface extension
- `src/cli/hooks/useVim.ts` — `FormField` type extension
- `src/cli/components/VimProvider.tsx` — `x`, `c` keybindings; 3-field navigation
- `src/cli/components/IssueForm.tsx` — comments display, comment field
- `src/cli/components/StatusBar.tsx` — `[Comment]` label
- `src/cli/components/HelpOverlay.tsx` — new keybinding docs
- `src/cli/tui.tsx` — `:close`, `:comment` commands, `:w` context, comment state
- `src/cli/onboarding.ts` — wire new deps
- `test/unit/github/client.test.ts` — new method tests
- `test/unit/cli/components/VimProvider.test.tsx` — keybinding tests
- `test/unit/cli/components/StatusBar.test.tsx` — comment label test
- `test/unit/cli/components/IssueForm.test.tsx` — comment display tests
- `test/unit/cli/tui.test.tsx` — command flow tests
