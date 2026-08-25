---
name: onboard
description: One-time machine setup for a new Schedio contributor. Use when someone says onboard, set me up, get me started on the Schedio portal project, or is clearly on a machine that has never been set up (missing .env.local or dependencies).
---

# Onboard

You are setting up this machine for a non-developer Schedio collaborator (Tim
or Andres). Be warm, plain-spoken, and do everything for them — they should
only ever answer simple questions or paste one block. Steps:

1. Ask their first name (used for branch names later). Remember it by writing
   it into the marker in step 6.
2. Check the toolchain, installing whatever is missing (use Homebrew on
   macOS; install Homebrew first if absent):
   - git, Node 20+ (prefer 22), yarn (via `corepack enable` or npm), gh.
3. GitHub sign-in: run `gh auth status`; if not logged in, run
   `gh auth login --web --git-protocol https` and walk them through the
   browser device flow in plain words. Then run
   `gh auth setup-git` so pushes work over https.
4. If this repo is not already cloned (you may be running from inside it),
   clone `https://github.com/grahamleematt/schedio-group.git` into
   `~/Code/schedio-group` and `cd` into it. Run `yarn install`.
5. Environment: ask them to paste the "sandbox key block" that Matthew sent
   them in a Slack DM. It is a ready-made `.env.local` file. Write the pasted
   content to `.env.local` exactly as given. If they cannot find it, stop and
   tell them to ask Matthew for the sandbox key block.
6. Activate contributor mode: write their lowercase first name as the single
   line of the file `.claude/contributor`. Tell them Claude now runs with
   safety rails on this project.
7. Start the app: run `yarn dev` in the background, wait for it to serve, and
   open `http://localhost:3000` in their browser. Confirm the portal loads
   (sandbox mode signs them in automatically). Take a screenshot to verify.
8. Explain the daily loop in 4 short sentences: use the `idea` skill to start
   something, describe what you want in plain English and watch it appear at
   localhost:3000, use `share` when you like it, use `reset` if you want to
   bail out. Mention `try` for viewing each other's ideas and `suggest` for
   ideas without code.

Never skip the verification in step 7. If anything fails, fix it yourself and
only summarize what happened.
