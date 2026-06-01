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

> **Release model (read first).** This repo is **stable-only** — every release
> goes to the npm `latest` tag. There is no prerelease/pre-mode flow. Publishing
> goes through the changesets **Version Packages PR** (`changesets/action` in
> `release.yml`): merging a *feature* PR does **not** publish — it only lands the
> feature's changeset on `master`. The action then opens/updates a single
> standing **"Version Packages" PR**; merging *that* PR is what runs
> `changeset publish` → npm `latest` + GitHub Release. So `pr-merge`'s only
> release job is: make sure the feature carries a changeset at the right bump
> level (or none, for a release-neutral change), merge, and clean up. It never
> bumps versions, never enters/exits pre mode, never publishes, and never merges
> the Version Packages PR. **"Ship as latest, or not?" reduces to "has a
> changeset, or not?"**

### Step 1 — gather context

```bash
gh pr view <n> --json title,state,mergeable,isDraft,labels,headRefName,body
git log master..<head-branch> --oneline
gh pr diff <n> --name-only
```

Establish one fact: **is there a changeset?** Look in the diff for a
`.changeset/*.md` file (excluding `README.md`). If present, the bump level is
already decided and rides into `master` with the merge. If absent, you'll ask
for one (Step 2). There is no channel/pre-mode axis to check anymore.

### Step 2 — ask about bump and cleanup

Ask both applicable questions in a **single message**.

**(a) Version bump — ask ONLY when no changeset was detected in Step 1.**
If a changeset already exists, skip this; its bump level stands.

> **Version bump:** No changeset detected. How should this be versioned?
> `patch` / `minor` / `major` / `skip`

`skip` authors no changeset — the merge is **release-neutral**: CI runs, nothing
publishes, the Version Packages PR is untouched. Correct for setup / CI /
tooling / docs PRs that should not ship a new version. Anything else authors a
changeset, so the change will be part of the next `latest` release.

**(b) Cleanup — always ask.**

> **Branch + worktree cleanup:** After merging, should I delete the remote branch and remove the local worktree (if one exists)?
> `yes` / `no`

Wait for answers.

### Step 2a — confirmation prompt

Call `AskUserQuestion` with a summary of what will happen:

- Merge strategy: squash, PR #<n> "<title>"
- Version bump: <patch/minor/major/skip>, or "existing changeset" if one was found → ships to `latest` on the next Version Packages release (or "no release" for `skip`)
- Branch cleanup: yes/no (worktree path if applicable)
- Options: `Proceed` / `Cancel`

Only continue if the user selects `Proceed`.

### Step 3 — ensure a changeset (only if Step 2 chose a bump)

This repo versions through **changesets** — never hand-edit `package.json`
versions, and never run `changeset version` locally (the Version Packages PR
owns that, in CI). The bump level is expressed purely as a changeset that rides
to `master` with the merge.

**3a — author the changeset** (only if Step 1 found none and the user didn't
pick `skip`). The interactive `bunx changeset` prompt isn't available here, so
write the file directly:

```bash
cat > ".changeset/pr-<n>-<short-slug>.md" <<'EOF'
---
"patties": <patch|minor|major>
EOF
# add more lines like   "create-patties": <patch|minor|major>   for each
# additional public package this PR actually changes, then close the front
# matter and add the summary:
cat >> ".changeset/pr-<n>-<short-slug>.md" <<'EOF'
---

<one-line summary of the change>
EOF
```

List only the public packages actually affected (`patties`, `create-patties`,
`patties-ui`), each at its chosen bump level. If a changeset already exists,
reuse it — do not author a second one.

**3b — commit** the changeset to the PR branch:

```bash
git add .changeset
git commit -m "chore: add changeset for #<n>"
```

**3c — push the changeset to the PR branch.** `gh pr merge` squashes the
**remote** branch, so a locally-committed changeset is invisible to the merge
unless it's pushed first. Pushing is the user's call (see §General rules) —
confirm, then:

```bash
git push origin <head-branch>
```

If the user declines the push, stop: merging now would ship the feature with
**no changeset**, so it would never reach `latest`. Say so plainly.

### Step 4 — merge

If the PR is a draft (`isDraft: true` from Step 1), mark it ready first:

```bash
gh pr ready <n>
gh pr merge <n> \
  --squash \
  --subject "<PR title>" \
  --body "<condensed from PR body, keep Closes #N lines>" \
  --delete-branch
```

### Step 5 — worktree cleanup (if requested)

```bash
# detect worktree path from branch name — wt-<n> dir names do NOT always match
# their branch, so verify with the plain listing before removing.
git worktree list
git worktree remove <path> --force
```

Report what was cleaned up.

### Step 6 — state the post-merge release path

After a successful merge, tell the user what happens next — do **not** wait for
or imply a publish from this merge:

- **If a changeset landed:** once it reaches `master` and CI passes, the
  changesets action opens or updates the **Version Packages PR**. Releasing is a
  separate, deliberate step the user takes: they merge *that* PR to publish
  `<pkg>@<next version>` to `latest`. Never merge the Version Packages PR
  yourself as part of `pr-merge`. ⚠️ The Version Packages PR is committed by
  `github-actions[bot]`, so merging it does **not** reliably trigger the Release
  workflow. If a publish doesn't appear within a couple of minutes, the user
  (or you, on request) runs the **manual Release fallback** — see §Release tags.
- **If `skip` (no changeset):** no release — only CI runs, nothing publishes.

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

This repo is **stable-only**: every release publishes to the npm `latest` tag.
There is no prerelease channel and no changesets pre mode — do not run
`changeset pre enter` / `pre exit`, and never hand-write a prerelease (`-next`,
`-beta`, …) version. `scripts/check-release-tag.ts` (wired into `lint` + the
publish step) backstops this: it fails if any public package carries a
prerelease version, since nothing should ever produce one.

**How a release happens:**

1. Feature PRs merge with a changeset (via `pr-merge`). Merging them never
   publishes.
2. The changesets action keeps a single **Version Packages PR** open that bumps
   versions + rewrites `CHANGELOG.md` from the pending changesets.
3. **The user merges the Version Packages PR** to release. That's the one
   button: it runs `changeset publish` → npm `latest` + git tags + GitHub
   Releases.

**Manual Release fallback (important).** The Version Packages PR is committed by
`github-actions[bot]`, and GitHub does not reliably spawn a downstream `push` CI
run for a bot-authored merge — so the auto `workflow_run`-triggered Release can
silently never fire. `release.yml` therefore also accepts a **manual trigger**.
If a publish doesn't show up shortly after merging the Version Packages PR, run:

```bash
gh workflow run Release --ref master
```

Then watch it and verify on the registry (a green run is not proof of publish):

```bash
gh run list --workflow Release --limit 1
npm view patties dist-tags          # latest should be the new version
```

`changeset publish` is idempotent — it only publishes packages whose version is
ahead of npm — so a manual run with nothing to release is a safe no-op.

## General rules

- `latest` is the only tag this repo publishes; there are no prereleases (see §Release tags).
- Never push to remote on your own initiative — that is always the user's decision. The one place `pr-merge` needs a push (a changeset commit onto the PR branch, Step 3c) is gated behind an explicit confirmation.
- A **green CI / Release run is not proof of a publish.** Always verify the new version directly on `registry.npmjs.org` (`npm view <pkg> dist-tags`) after a release.
- Never merge without explicit user confirmation.
- Always use `--assignee "@me"` on issues and PRs.
- Keep commit messages that accompany version bumps in `chore:` conventional-commit form.
- When running `gh` commands that create or mutate, show the exact command before running it so the user can see what is about to happen.
- If `gh auth status` fails, tell the user to run `gh auth login` and stop.
