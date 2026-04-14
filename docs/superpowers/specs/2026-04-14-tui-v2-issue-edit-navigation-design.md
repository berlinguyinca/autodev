# TUI v2 Follow-Up: Wider Detail Pane and Arrow Navigation for Loaded Issues

## Context

The current TUI already has a split main screen with a left issue form and a right issue table, plus a `VimProvider` that tracks normal/insert/command modes and a separate `pane` focus state. The next slice is a focused usability improvement for loaded issues: when an issue is opened for editing, the detail/editor area should have more horizontal room, and normal-mode arrow navigation should make it easy to move between the title and body fields exactly like the current issue-view editing flow expects.

This is a follow-up to the existing split-pane TUI work. It does not change the overall product shape, the command model, or the dual input mode design.

## Goal

Make loaded issues easier to edit in the TUI by combining two changes:

1. The loaded issue/editor view should use more of the available horizontal space so the title, repo, and field content are less truncated.
2. When an issue is loaded, arrow keys should let the user move focus between the title and body fields in normal mode, with insert mode still behaving like text entry.

## Scope

### In scope

- Weighted split-pane sizing so the detail/editor side is wider than the navigator side when an issue is loaded.
- Normal-mode `up/down` navigation between `Title` and `Body` within the loaded issue editor.
- `Enter` should continue to open the focused field for editing.
- Insert-mode editing should remain unchanged for text entry and cursor movement.
- Status/help text should reflect the current field focus and input mode.
- Regression tests for navigation, focus, and layout-sensitive rendering.

### Out of scope

- Replacing the split-pane layout entirely.
- Introducing a new issue-detail screen.
- Changing the issue table data model.
- Adding mouse support.
- Changing the command palette or `:w/:q/:wq` behavior.

## Design

### Layout

The main screen remains a split view, but the loaded issue/editor side gets more space than the table/navigation side. The intent is to keep the current two-pane mental model while making the active issue easier to read and edit.

Proposed behavior:

- Left side remains the issue navigator/table.
- Right side remains the loaded issue/editor view.
- The right side should be visibly wider than the left side when an issue is being edited.
- The editor should not be constrained to a nested half-width layout inside the right pane.

### Navigation

The loaded issue editor uses the existing modal keyboard model:

- In normal mode, `up/down` move focus between `Title` and `Body`.
- `Enter` enters insert mode for the currently focused field.
- `Tab` continues to move between panes or fields according to the existing TUI model.
- In insert mode, arrow keys remain text-editing behavior and are not intercepted for field switching.

This keeps the editor consistent with the current vim-style input model while making it easier to move between fields without leaving the loaded issue.

### State flow

The focus state for the loaded issue should remain explicit and testable:

- `pane` continues to describe whether the main interaction focus is on the form/editor or the table.
- `formField` continues to describe which field is active inside the issue editor.
- The status bar should reflect both the active pane and the current field-focused editing mode.

The main risk here is stale focus state when the TUI and the input provider both try to own the same state. The implementation should keep a single source of truth for pane and field focus.

## Acceptance Criteria

- [ ] Loading an issue into the editor makes the right side visibly wider than the left side.
- [ ] The loaded issue editor shows the issue title, repo metadata, and field content without unnecessary truncation.
- [ ] In normal mode, `up/down` moves focus between the title and body fields.
- [ ] In normal mode, `Enter` opens the focused field for editing.
- [ ] In insert mode, arrow keys still behave like text editing and do not change field focus.
- [ ] The current pane and field focus are reflected in the status/help hints.
- [ ] Existing create/edit commands still work: `:w`, `:q`, `:wq`, `:e`, and `:repo`.
- [ ] Existing TUI and provider tests continue to pass, with new regression coverage for the loaded-issue navigation path.

## Test Plan

Add or update tests to cover:

- Pane width-sensitive rendering for the loaded issue/editor view.
- Normal-mode arrow navigation between `Title` and `Body`.
- `Enter` entering insert mode from the focused field.
- Insert-mode protection against accidental field switching.
- Status bar hint text for the loaded issue editing state.

Then verify with the project test suite and build once implementation is complete.

## Files Likely Touched

- `src/cli/components/VimProvider.tsx`
- `src/cli/components/IssueForm.tsx`
- `src/cli/components/StatusBar.tsx`
- `src/cli/components/SplitPane.tsx`
- `src/cli/tui.tsx`
- `test/unit/cli/components/VimProvider.test.tsx`
- `test/unit/cli/components/StatusBar.test.tsx`
- `test/unit/cli/components/IssueForm.test.tsx`

