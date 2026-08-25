# Agent Instruction Map

## Canonical Source

Cursor is the canonical authoring surface for repo-local rules and skills.

- Rules: `./.cursor/rules/`
- Skills: `./.cursor/skills/`

## Mirrors

Claude and Codex each mirror the same guidance:

- Claude: `./.claude/`
- Codex: `./.codex/`

Skill mirrors are symlinks, not copies: the five project skills in
`.claude/skills/` and `.codex/skills/` point into `.cursor/skills/`, and
`.codex/rules/contributor.md` points at `.claude/rules/contributor.md`.
Author once in the canonical location; the mirrors cannot drift. (The six
contributor workflow skills are the exception — they live only in
`.claude/skills/`; see Contributor Mode below.)

## Contributor Mode (Claude Code)

Non-developer collaborators work through Claude Code. The pieces:

- `.claude/contributor` — gitignored marker written once by the `onboard`
  skill;
  its presence switches a machine into contributor mode. No marker (e.g.
  Matthew's machines) means zero behavior change.
- `.claude/settings.json` + `.claude/hooks/contributor-guard.{sh,mjs}` —
  PreToolUse hooks that block pushes/commits to `main`, merges, force pushes,
  deploys, `rm -rf`, and writes to `.env*`, `db/`, `.github/`, and the
  guardrail files themselves. They no-op without the marker.
- `.claude/rules/contributor.md` — session behavior rule (canonical body;
  mirrored as `.cursor/rules/contributor.mdc` and symlinked into `.codex`).
- `.claude/skills/{onboard,idea,share,try,suggest,reset}/` — the contributor
  workflow skills. Claude triggers them from plain-English intent (each
  SKILL.md description carries the trigger phrases); they also show in the
  slash menu. These are Claude-native and are not mirrored to
  `.cursor`/`.codex` — the contributor surface is Claude Code only.
- `docs/vibe-coding.md` — the human-facing cheat sheet.

Root entrypoints:

- `./CLAUDE.md`
- `./AGENTS.md`

## Sync Rule

When instructions change:

1. Update `.cursor` first.
2. Mirror the equivalent changes into `.claude` and `.codex`.
3. Keep the three systems functionally aligned even if syntax differs slightly by tool.

## Repo Expectation

This repo should be usable by Cursor, Claude, and Codex without relying on private memory or external habits. The instruction folders are part of the project, not an afterthought.
