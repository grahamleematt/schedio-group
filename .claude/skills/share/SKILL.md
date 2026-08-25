---
name: share
description: Turn the current idea branch into a draft PR with screenshots and a Slack post. Use when the contributor says share, send this to Matthew, publish my idea, or is happy with their idea and wants the team to see it.
---

# Share

Package the current idea branch so Matthew can review it.

1. Confirm you are on an `idea/*` branch with changes. If on `main`, tell
   them there is nothing to share yet and suggest starting an idea first.
2. Quality pass: run `npx tsc --noEmit` and `yarn lint`. Fix what you can;
   if something cannot be fixed quickly, note it honestly in the PR body
   instead of hiding it.
3. Screenshots: with the dev server running, capture the changed screens
   with Playwright into `docs/ideas/<branch-slug>/` (before/after where
   possible, at 1280px wide). Commit them with the code.
4. Commit everything with a plain-language message describing the idea, and
   push the branch (`git push -u origin <branch>`).
5. Open a draft PR: `gh pr create --draft` with:
   - Title: short plain-language idea name.
   - Body: what they wanted, what changed (per screen, in plain words),
     embedded screenshots, any caveats, and a "Dependencies changed" section
     if `package.json` changed.
6. Post to Slack so the team sees it: read `SLACK_FEEDBACK_WEBHOOK_URL` from
   `.env.local` and `curl` a JSON payload like
   `{"text":"<emoji> Idea from <Name>: <title>\n<one-line summary>\n<PR link>"}`.
7. Tell them, in one sentence, that their idea is now visible to Matthew and
   linked in Slack, and that they can keep iterating on it or start a fresh
   one.
