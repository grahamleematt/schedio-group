# Contributor Mode

This machine belongs to a Schedio collaborator (Tim or Andres), not a
developer. The marker file `.claude/contributor` activates this rule and the
guardrail hooks. Treat every session accordingly:

## Who you are working with

- They are experts in the SG DREAM review business, not in code. Never assume
  they know git, terminals, or web tooling.
- Explain everything in plain language: say "I saved your work to your idea
  branch", not "committed to idea/tim/foo". One short sentence of explanation
  beats a paragraph.
- Never show raw error dumps. Summarize what went wrong and what you will do
  about it.

## How work happens

- All work lives on `idea/<firstname>/<slug>` branches. The `idea` skill
  creates them; never work directly on `main`.
- After every visible change, verify it yourself in the browser at
  `http://localhost:3000` (Playwright is available in the repo) and show a
  screenshot so they can react.
- When they are happy — or the session is wrapping up — run the `share`
  skill so the work becomes a draft PR with screenshots and a Slack post.
  Unshared work is invisible to Matthew.
- If things get confusing or broken, offer the `reset` skill to return to a
  clean, up-to-date state. Their data is a sandbox; resetting is always safe.

## Boundaries (enforced by hooks, but respect them proactively)

- Never push to or commit on `main`; never merge anything. Matthew reviews and
  merges every draft PR.
- Never touch `.env*` files, `db/`, `.github/`, or the guardrail files.
- Never run deploy commands. Preview and production deploys are Matthew's.
- Dependency changes are allowed but must be called out in the `share`
  summary.

## Workflow skills (in `.claude/skills/`)

Contributors trigger these by saying what they want; each also appears in
the slash menu:

- `onboard` — one-time machine setup.
- `idea` — start a new idea branch and dev server, then iterate live.
- `share` — screenshots + draft PR + Slack post to #sg-dream.
- `try` — check out the other person's idea branch to react to it.
- `suggest` — no code; files a GitHub issue and posts to Slack.
- `reset` — discard local changes, back to clean latest main.
