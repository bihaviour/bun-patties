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
# Remote branch keeps the feature name (e.g. feat/dev-island-bundler).
# Renaming the remote branch after PR creation causes GitHub to auto-close the PR.
# Only the LOCAL worktree directory uses the wt-<pr-number>-<repo-slug> format.
git worktree add -b <feature-branch> ../<feature-branch> main
```

After Step 5 creates the PR and you have the number, rename only the local
worktree directory — do NOT rename the remote branch:
```bash
git worktree move ../<feature-branch> ../wt-<n>-<repo-slug>
```

The worktree path will be `../wt-<n>-<repo-slug>`; the branch (local + remote)
stays `<feature-branch>`. Report both clearly.

### Step 3b — if issue = yes

Ask: **One issue per PR, or multiple issues rolled into this one PR?**
`one` / `multi`

- If `one`: derive one issue from the `<message>`.
- If `multi`: ask the user to list the issues (one line each), then derive each issue's title, labels, and body.

Auto-detect labels using the label rules in §Issue label taxonomy below.

### Step 4 — confirmation prompt

Before running any `gh` commands, call `AskUserQuestion` with a single question summarising what will be created:

- Show each issue: title + labels (one line each)
- Show the PR: title, branch, draft status
- Options: `Proceed` / `Cancel`

Only continue if the user selects `Proceed`.

### Step 5 — execute after approval

Issue creation command (run for each issue):
```bash
gh issue create \
  --title "<derived title>" \
  --body "<body with context>" \
  --label "<auto-detected labels>" \
  --assignee "@me"
```

Then create the PR:

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

> **Release model (read first).** This repo publishes through the changesets
> **Version Packages PR** flow (`changesets/action` in `release.yml`). Merging a
> *feature* PR does **not** publish — it only lands the feature's changeset on
> `master`. The action then opens/updates a single standing **"Version Packages"
> PR**; merging *that* PR is what runs `changeset publish` → npm + GitHub
> Release. So `pr-merge`'s job is: make sure the feature carries a changeset at
> the right level (or none, for a CI-only change), set the channel via pre mode
> if needed, merge, and clean up. It never bumps versions or publishes itself,
> and it never merges the Version Packages PR.

### Step 1 — gather context

```bash
gh pr view <n> --json title,state,mergeable,labels,headRefName,body
git log main..<head-branch> --oneline
gh pr diff <n> --name-only
```

Establish **two independent facts** — they are separate axes and both matter:

1. **Is there a changeset?** Look in the diff for files matching
   `.changeset/*.md` (excluding `README.md`), `CHANGELOG.md` edits, or
   `package.json` version changes. This tells you the *bump level* is already
   decided.
2. **What channel is the repo currently on?** Check pre mode directly — it is
   the only thing that decides stable vs prerelease, NOT the changeset:
   ```bash
   test -f .changeset/pre.json && cat .changeset/pre.json   # {"mode","tag",...} if in pre mode
   ```
   Record whether pre mode is active and, if so, its `tag`.

### Step 2 — ask about channel, bump, and cleanup

Ask all applicable questions in a **single message**.

**(a) Release channel — ALWAYS ask, even when a changeset already exists.**
A changeset records the bump level but never the channel; pre mode does. So
confirm it every time:

> **Release channel:** When this ships (via the next Version Packages PR), should it go to the stable `latest` tag, or as a prerelease?
> `stable` / `prerelease`

If `prerelease`, ask which pre tag in the same message: `next` / `beta` / `rc`.
The npm `latest` tag is reserved for stable releases (see §Release tags).

**(b) Version bump — ask ONLY when no changeset was detected in Step 1.**
If a changeset already exists, skip this; its bump level stands.

> **Version bump:** No changeset detected. How should this release be versioned?
> `patch` / `minor` / `major` / `skip`

`skip` authors no changeset — the merge is **release-neutral**: CI runs, nothing
publishes, and the Version Packages PR is untouched. This is the correct choice
for setup / CI / tooling / docs PRs that should not ship a new version.

**(c) Cleanup — always ask.**

> **Branch + worktree cleanup:** After merging, should I delete the remote branch and remove the local worktree (if one exists)?
> `yes` / `no`

Wait for answers.

### Step 2a — reconcile channel vs. pre-mode state

Compare the requested channel (Step 2, question a) against the actual pre-mode
state (Step 1, fact 2). Surface any mismatch explicitly — do **not** silently
proceed:

| Requested | Pre mode now | Action in Step 3 |
|---|---|---|
| `stable` | inactive | none — normal stable flow |
| `stable` | **active (`<tag>`)** | ⚠️ WARN: repo is in `<tag>` pre mode; publishing now ships under `<tag>`, not `latest`. Must `bunx changeset pre exit` first. |
| `prerelease <tag>` | inactive | `bunx changeset pre enter <tag>` before merge |
| `prerelease <tag>` | active, **same** tag | none — already correct |
| `prerelease <new>` | active, **different** `<old>` | ⚠️ WARN: in `<old>` pre mode, requested `<new>`. Must `pre exit` then `pre enter <new>`. |

If a changeset already exists **and** the requested channel is `prerelease`
while pre mode is inactive, the changeset is fine as-is — you only need to enter
pre mode. Call this out so the user knows the existing changeset is reused.

### Step 2b — confirmation prompt

Call `AskUserQuestion` with a summary of what will happen:

- Merge strategy: squash, PR #<n> "<title>"
- Release channel: `stable → latest` or `prerelease → <tag>`
- Version bump: <patch/minor/major/skip>, or "existing changeset" if one was found
- Pre-mode reconciliation: the action from the Step 2a table (e.g. "run `changeset pre enter next`", "run `changeset pre exit` — repo is in `next` pre mode", or "none")
- Branch cleanup: yes/no (worktree path if applicable)
- Options: `Proceed` / `Cancel`

If Step 2a flagged a ⚠️ mismatch, state it in the question text, not just the
summary line. Only continue if the user selects `Proceed`.

### Step 3 — apply channel + ensure changeset (if requested)

This repo versions through **changesets** — never hand-edit `package.json`
versions, and never run `changeset version` locally (the Version Packages PR
owns that, in CI). The bump level is expressed purely as a changeset that rides
to `master` with the merge; the actual version bump happens later, by the
action, inside the Version Packages PR. Do the reconciliation from Step 2a
**first**, then the changeset.

**3a — reconcile pre mode** (only if Step 2a flagged an action):

```bash
# stable requested but repo is in pre mode → leave pre mode:
bunx changeset pre exit

# prerelease requested but pre mode inactive → enter it:
bunx changeset pre enter <next|beta|rc>

# prerelease requested with a different tag than active → switch:
bunx changeset pre exit && bunx changeset pre enter <new-tag>
```

**3b — author the changeset** (only if Step 1 found none). The interactive
`bunx changeset` prompt isn't available here, so write the file directly:

```bash
cat > ".changeset/pr-<n>-<short-slug>.md" <<'EOF'
---
"patties": <patch|minor|major>
"create-patties": <patch|minor|major>
---

<one-line summary of the change>
EOF
```

List only the public packages actually affected, each at its chosen bump level.
If a changeset already exists, reuse it — do not author a second one.

**3c — commit** whatever 3a/3b changed:

```bash
git add .changeset
git commit -m "chore: <changeset / enter <tag> pre mode / exit pre mode> for #<n>"
```

The bump level (3b) and the channel (3a) are independent: a release candidate is
still a `patch`/`minor`/`major` changeset — pre mode is what routes it to the
pre tag instead of `latest`. `scripts/check-release-tag.ts` enforces that a
prerelease version can only publish while pre mode is active, so a stray
prerelease can never take `latest`. When the line stabilises, `bunx changeset
pre exit`.

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

### Step 6 — state the post-merge release path

After a successful merge, tell the user what happens next — do **not** wait for
or imply a publish from this merge:

- **If a changeset landed:** once it reaches `master` and CI passes, the
  changesets action opens or updates the **Version Packages PR**. Releasing is a
  separate, deliberate step: the user merges *that* PR to publish
  `<pkg>@<next version>` to `<latest|the pre tag>`. Never merge the Version
  Packages PR yourself as part of `pr-merge`.
- **If `skip` (no changeset):** no release — only CI runs, nothing publishes.

If pre mode was just entered/exited in Step 3, note that the channel change only
takes effect on the next Version Packages PR publish.

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

### Step 2 — confirmation prompt

Call `AskUserQuestion` showing:

- Title: <derived title>
- Labels: <label list>
- Body preview: first 3–4 lines of body
- Options: `Proceed` / `Cancel`

Only continue if the user selects `Proceed`.

### Step 3 — emit the issue

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

## Release tags

The npm `latest` dist-tag must only ever point at a stable release.

- Publishing is gated by the **Version Packages PR**: `release.yml` runs after CI
  succeeds on `master`, and the changesets action opens/updates that PR while
  changesets are pending. `changeset publish` only fires once that PR is merged
  (i.e. when no `.changeset/*.md` remain). Merging feature PRs never publishes.
- Releases publish via `changeset publish` in `.github/workflows/release.yml`.
  It tags everything `latest` **unless** the repo is in changesets pre mode
  (`.changeset/pre.json` present), in which case it publishes under that pre tag
  (`.changeset/pre.json` present), in which case it publishes under that pre tag
  (`next` / `beta` / `rc`) and leaves `latest` alone.
- Therefore prereleases ALWAYS go through `bunx changeset pre enter <tag>` first.
  Never produce a prerelease version outside pre mode.
- `scripts/check-release-tag.ts` enforces this (wired into `lint` and the publish
  step): it fails if any public package carries a prerelease version while pre
  mode is inactive.
- Consumers opt into prereleases explicitly: `bun add patties@next`. Plain
  `bun add patties` always resolves the latest stable.

## General rules

- `latest` is reserved for stable. Route prereleases through `changeset pre enter`; never hand-edit a version into a prerelease (see §Release tags).
- Never push to remote — that is always the user's decision.
- Never merge without explicit user confirmation.
- Always use `--assignee "@me"` on issues and PRs.
- Keep commit messages that accompany version bumps in `chore:` conventional-commit form.
- When running `gh` commands that create or mutate, show the exact command before running it so the user can see what is about to happen.
- If `gh auth status` fails, tell the user to run `gh auth login` and stop.
