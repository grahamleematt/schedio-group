---
name: reset
description: Bail out — discard local changes and return to a clean, current app. Use when the contributor says reset, start over, undo everything, or things feel broken or confusing and they want a clean slate.
---

# Reset

They want a clean slate.

1. Show them, in plain words, what would be lost: name the idea branch and
   summarize any uncommitted or unpushed work in one or two sentences.
2. Ask once: "Save this to your idea branch first, or throw it away?"
   - Save: commit and push the idea branch, then continue.
   - Throw away: continue without pushing.
3. Return to a clean current state: `git checkout main && git pull`, discard
   leftover changes to tracked files (`git checkout -- .`), and remove
   stray untracked source files created during the session — but NEVER
   touch `.env.local`, `.claude/contributor`, `node_modules`, or `.data`.
4. Restart `yarn dev` if needed and confirm `http://localhost:3000` loads.
5. Tell them they are back on the latest version of the app and starting a
   new idea is one sentence away.
