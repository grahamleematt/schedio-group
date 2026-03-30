# Agent Instruction Map

## Canonical Source

Cursor is the canonical authoring surface for repo-local rules and skills.

- Rules: `./.cursor/rules/`
- Skills: `./.cursor/skills/`

## Mirrors

Claude and Codex each mirror the same guidance:

- Claude: `./.claude/`
- Codex: `./.codex/`

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
