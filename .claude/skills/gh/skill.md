---
name: gh
description: GitHub workflow skill for this repo. Use when the user types /gh open-pr, /gh pr-merge, or /gh add-issue. Handles PR creation with optional worktree and issue linking, PR merging with cleanup and version bumping, and draft issue creation with auto-tagged metadata.
license: MIT
metadata:
  author: baita-artotel
  version: "1.0"
---

# /gh — GitHub Workflow Skill

Handles three subcommands. Parse the args to determine which one is active, then follow its protocol exactly.

---

## Subcommand dispatch

| Input pattern | Subcommand |
|---|---|
| `/gh open-pr <message>` | → **Open PR** |
| `/gh pr-merge #<n> <message>` | → **PR Merge** |
| `/gh add-issue <message>` | → **Draft Issue** |

If the subcommand is unrecognised, list the three valid ones and stop.

---

## 1. `open-pr` — Open a Pull Request

### Step 1 — gather context (run in parallel before asking anything)

```bash
git status --short
git log main..HEAD --oneline
git diff main..HEAD --stat
gh pr list --state open --limit 20
```

### Step 2 — ask two questions in one message (do not split across turns)

Ask **both** of the following in a single response:

> **Worktree:** Should I also create a git worktree for this PR so development stays isolated?
> `yes` / `no`
>
> **Issue tracking:** Should a GitHub issue be opened to track this development?
> `yes` / `no`

Wait for the user's answers before proceeding.

### Step 3a — if worktree = yes

```bash
# derive branch name from the message (kebab-case, max 40 chars)
git worktree add -b <branch> ../<repo-slug>-<branch> main
```

Report the worktree path and branch name.

### Step 3b — if issue = yes

Ask: **One issue per PR, or multiple issues rolled into this one PR?**
`one` / `multi`

- If `one`: create one issue from the `<message>`, link it in the PR body.
- If `multi`: ask the user to list the issues (one line each), create each with `gh issue create`, then link all of them in the PR body.

Issue creation command (run for each issue):
```bash
gh issue create \
  --title "<derived title>" \
  --body "<body with context>" \
  --label "<auto-detected labels>" \
  --assignee "@me"
```

Auto-detect labels using the label rules in §Issue label taxonomy below.

### Step 4 — create the PR

```bash
gh pr create \
  --title "<message — keep under 72 chars>" \
  --body "$(cat <<'EOF'
## Summary
<bullet points derived from git diff --stat and commit log>

## Linked issues
<Closes #N for each linked issue, or "None">

## Test plan
<brief checklist derived from changed files>

🤖 Generated with [Claude Code](https://claude.ai/code)
EOF
)" \
  --draft \
  --assignee "@me"
```

- Default to `--draft`. Only omit `--draft` if the user's message explicitly says "ready for review".
- After creation, print the PR URL.

---

## 2. `pr-merge` — Merge a Pull Request

### Step 1 — gather context

```bash
gh pr view <n> --json title,state,mergeable,labels,headRefName,body
git log main..<head-branch> --oneline
gh pr diff <n> --name-only
```

Check for a changeset (version bump file). The check depends on the repo's release tool:
- Look for files matching `**/changesets/*.md`, `CHANGELOG.md` edits, or `package.json` version changes in the diff.

### Step 2 — ask about cleanup

Single message with the following:

> **Branch + worktree cleanup:** After merging, should I delete the remote branch and remove the local worktree (if one exists)?
> `yes` / `no`

If no changeset is detected, add in the **same message**:

> **Version bump:** No changeset detected. Do you want to bump the version?
> `patch` / `minor` / `major` / `skip`

Wait for answers.

### Step 3 — version bump (if requested)

Detect the version field location (`package.json` root, `packages/*/package.json`, or a dedicated version file). Apply the bump with:

```bash
# example for a single package.json
bun x npm-version <patch|minor|major> --no-git-tag-version
git add package.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
```

For a Bun workspace monorepo, bump each public package's `package.json` individually and commit once.

### Step 4 — merge

```bash
gh pr merge <n> \
  --squash \
  --subject "<PR title>" \
  --body "<condensed from PR body, keep Closes #N lines>" \
  --delete-branch
```

### Step 5 — worktree cleanup (if requested)

```bash
# detect worktree path from branch name
git worktree list --porcelain | grep -A1 "<head-branch>"
git worktree remove <path> --force
```

Report what was cleaned up.

---

## 3. `add-issue` — Draft a GitHub Issue

### Step 1 — analyse the message

From `<message>` alone, derive:

| Field | Derivation rule |
|---|---|
| **Title** | Max 72 chars. Start with an imperative verb. Drop filler. |
| **Type label** | See §Issue label taxonomy |
| **Scope label** | Infer from nouns in message (package name, subsystem, CLI surface) |
| **Priority label** | Default `priority: normal`; escalate if message contains "urgent", "broken", "crash", "security", "regression" |
| **Body sections** | See §Issue body template |

Also run:
```bash
gh label list --limit 100
git log --oneline -20
```

Cross-check auto-detected labels against the repo's actual label list. Only use labels that exist; if a label is missing, note it.

### Step 2 — emit the issue

```bash
gh issue create \
  --title "<title>" \
  --body "$(cat <<'EOF'
<body — see template below>
EOF
)" \
  --label "<comma-separated labels>" \
  --assignee "@me"
```

Print the issue URL after creation.

---

## Issue body template

```markdown
## Context
<!-- one sentence: what situation led to this issue -->

## Problem / Goal
<!-- what is broken or what needs to exist -->

## Acceptance criteria
- [ ] <measurable outcome 1>
- [ ] <measurable outcome 2>

## Notes
<!-- edge cases, prior art, related issues — omit section if empty -->

## References
<!-- links, spec file paths, PR numbers — omit section if empty -->

---
*Auto-drafted via /gh add-issue*
```

Populate every non-empty section from the user's message. Omit "Notes" and "References" only if there is nothing to put there.

---

## Issue label taxonomy

Apply one label from each applicable category. Match by keyword in the message.

### Type (required — pick exactly one)

| Label | When to apply |
|---|---|
| `type: bug` | something is broken, regression, crash, not working |
| `type: feature` | new capability, "add", "implement", "support" |
| `type: chore` | tooling, CI, deps, housekeeping, version bumps |
| `type: docs` | documentation, README, spec, CLAUDE.md |
| `type: refactor` | restructure without behaviour change |
| `type: perf` | performance, latency, bundle size |
| `type: security` | auth, credentials, vulnerability |
| `type: dx` | developer experience, CLI ergonomics, error messages |

### Priority (required — pick exactly one)

| Label | When to apply |
|---|---|
| `priority: critical` | production broken, security issue, data loss |
| `priority: high` | blocks a release or another team member |
| `priority: normal` | default |
| `priority: low` | nice to have, no deadline |

### Scope (optional — one or more if applicable)

Derive from the message. Common scopes for this repo:

| Label | Applies to |
|---|---|
| `scope: framework` | `packages/patties` core |
| `scope: ui` | `packages/patties-ui` component catalog |
| `scope: cli` | `patties` CLI, `create-patties` |
| `scope: build` | build system, bundler, adapters |
| `scope: dev-server` | HMR, dev mode, file watching |
| `scope: ai` | `src/ai/`, agents-md, optional AI deps |
| `scope: docs` | `bun-patties-docs`, spec files |

---

## General rules

- Never push to remote — that is always the user's decision.
- Never merge without explicit user confirmation.
- Always use `--assignee "@me"` on issues and PRs.
- Keep commit messages that accompany version bumps in `chore:` conventional-commit form.
- When running `gh` commands that create or mutate, show the exact command before running it so the user can see what is about to happen.
- If `gh auth status` fails, tell the user to run `gh auth login` and stop.
