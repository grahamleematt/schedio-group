# Vibe Coding — Prototyping the Portal Without Being a Developer

This is the cheat sheet for trying your own ideas on the SG DREAM portal
using Claude Code. You describe what you want in plain English; Claude makes
the change and shows it to you running live on your machine. Nothing you do
here can affect the real portal — Matthew reviews everything before it ships.

## One-time setup (about 10 minutes)

1. Create a GitHub account (github.com) and accept the repo invite Matthew
   sends you.
2. Install **Claude Code on your own computer** (Mac or Windows — download
   from `https://claude.com/product/claude-code`). Important: do **not** use
   the "Code" tab on the claude.ai website — that runs in the cloud, can't
   reach the sandbox, and nothing it sets up survives. It must be installed
   on your machine.
3. Open Claude Code and paste:

   > Set me up on the Schedio portal project: clone
   > github.com/grahamleematt/schedio-group and onboard me

   Claude walks you through the rest. It will ask you to paste the "sandbox
   key block" — Matthew DMs that to you on Slack.

## The daily loop

Just say what you want — these are skills Claude picks up from plain
English (they also appear in the slash menu, e.g. `/idea`):

| Say something like | What happens |
| --- | --- |
| "new idea: bigger upload button" | Starts a fresh idea. Claude branches off the latest app, builds what you describe, and shows you screenshots as it goes. Say what to change until it looks right. |
| "share this" | Packages the idea: screenshots, a draft pull request for Matthew, and a post in #sg-dream so everyone sees it. |
| "let me try Tim's idea" | Loads the other person's shared idea on your machine so you can react to it. |
| "suggest: export to Excel" | For ideas you don't want to build — files it straight to Matthew's queue and posts to Slack. |
| "reset everything" | Bail out. Throws away the experiment and puts you back on the current app, clean. |

## What you're working with

- The app runs at `http://localhost:3000` on your machine, signed in
  automatically — no login needed.
- Your data is a **sandbox copy** of the real portal data. Break it, reset
  it, upload junk to it — nothing touches production.
- Uploads work end-to-end, but document reading is **simulated** in the
  sandbox (real AI extraction only runs on the live portal).
- Guardrails are on: Claude cannot push to the live app, merge anything,
  or touch configuration. If it refuses something, that's why.

## How ideas become real features

1. You share an idea → draft PR + Slack post.
2. Matthew reviews it, polishes or rebuilds as needed, and merges.
3. It deploys to the live portal, and the PR closes with a note about what
   shipped.

Nothing is wasted: even rough ideas show intent better than a description.

## For Matthew: refreshing the sandbox

The sandbox is the `vibe_sandbox` database on the same Neon project. To
re-copy current prod data into it:

```bash
PG=/usr/local/opt/libpq/bin   # Postgres 17+ client tools (brew install libpq)
ADMIN="postgresql://<user>:<password>@<unpooled-host>"   # from .env.local, minus the /neondb
$PG/pg_dump --no-owner --no-privileges "$ADMIN/neondb?sslmode=require" > /tmp/prod-dump.sql
psql "$ADMIN/vibe_sandbox?sslmode=require" -c "drop schema public cascade; create schema public;"
psql "$ADMIN/vibe_sandbox?sslmode=require" -q -f /tmp/prod-dump.sql
```

Contributor guardrails live in `.claude/settings.json` +
`.claude/hooks/contributor-guard.mjs`; they only activate on machines
with the gitignored `.claude/contributor` marker. See
`docs/agent-instruction-map.md` for the full instruction layout.
