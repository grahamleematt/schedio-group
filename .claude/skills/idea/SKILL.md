---
name: idea
description: Start a new idea branch and iterate on it live. Use when the contributor says idea, or wants to try, change, build, prototype, or experiment with anything on the portal (a screen, a button, a flow, wording, layout).
---

# Idea

The collaborator described something they want to try on the portal.

1. If there are uncommitted changes from a previous idea, ask whether to
   save them to their current idea branch (commit with a plain-language
   message) or discard them. Never carry changes across ideas silently.
2. Get the latest starting point: `git checkout main && git pull`.
3. Create a branch named `idea/<firstname>/<short-slug>` — first name from
   `.claude/contributor`, slug 2-4 words from their description.
4. Make sure `yarn dev` is running (start it in the background if not) and
   the app answers at `http://localhost:3000`.
5. Build the idea in small visible steps. After each step:
   - check the browser yourself (screenshot with Playwright),
   - show them the screenshot,
   - describe the change in one plain sentence and ask if it matches what
     they pictured.
6. Keep iterating until they are happy. Then remind them: "say share when
   you want Matthew and the team to see this."

Rules: never work on `main`, never touch `.env*` / `db/` / `.github/`, keep
each idea branch about one idea.
