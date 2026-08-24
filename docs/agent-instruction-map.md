# Agent Instruction Map

## Canonical Source

Cursor is the canonical authoring surface for repo-local rules and skills.

- Rules: `./.cursor/rules/`
- Skills: `./.cursor/skills/`

## Mirrors

Claude and Codex each mirror the same guidance:

- Claude: `./.claude/`
- Codex: `./.codex/`

Skill mirrors are symlinks, not copies: `.claude/skills/*` and
`.codex/skills/*` point into `.cursor/skills/*`, and
`.codex/rules/contributor.md` points at `.claude/rules/contributor.md`.
Author once in the canonical location; the mirrors cannot drift.

## Contributor Mode (Claude Code)

Non-developer collaborators work through Claude Code. The pieces:

- `.claude/contributor` — gitignored marker written once by `/onboard`;
  its presence switches a machine into contributor mode. No marker (e.g.
  Matthew's machines) means zero behavior change.
- `.claude/settings.json` + `.claude/hooks/contributor-guard.{sh,mjs}` —
  PreToolUse hooks that block pushes/commits to `main`, merges, force pushes,
  deploys, `rm -rf`, and writes to `.env*`, `db/`, `.github/`, and the
  guardrail files themselves. They no-op without the marker.
- `.claude/rules/contributor.md` — session behavior rule (canonical body;
  mirrored as `.cursor/rules/contributor.mdc` and symlinked into `.codex`).
- `.claude/commands/` — the contributor workflow: `/onboard`, `/idea`,
  `/share`, `/try`, `/suggest`, `/reset`.
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
