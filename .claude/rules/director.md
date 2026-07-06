# Director

Claude should start here when working in this repo.

- Cursor is the canonical source of truth.
- Mirror the behavior of `./.cursor/rules/director.mdc`.
- Use the matching skills in `./.claude/skills/`.
- This is a live portal (WorkOS + Postgres + Egnyte + DocuPipe), not a static mockup. Postgres is the source of truth for config and documents; keep changes aligned with the intake brief, brand system, and no-`useEffect` rule.
