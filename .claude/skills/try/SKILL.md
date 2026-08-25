---
name: try
description: Look at another person's shared idea, running live on this machine. Use when the contributor says try, or wants to see, open, or react to someone else's idea or shared work.
---

# Try

They want to see someone else's idea running locally.

1. List open idea PRs: `gh pr list --state open --search "head:idea/"` and
   show them as a short plain-language menu (title, who, when). Ask which
   one to look at.
2. Protect their own work first: if there are uncommitted changes, commit
   them to their current idea branch with a clear message (tell them you
   saved their work).
3. Check out the chosen PR branch (`gh pr checkout <number>`), make sure
   `yarn dev` is running, and open `http://localhost:3000`.
4. Point out in one or two sentences what changed on which screens, with a
   screenshot.
5. If they have reactions, offer to post a comment on the PR in their words
   (`gh pr comment`).
6. When they are done, return them to their own branch (or `main` if they
   had none) and confirm everything is back to how it was.
