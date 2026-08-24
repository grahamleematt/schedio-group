---
description: File an idea or feedback for Matthew without writing any code
argument-hint: the idea, in plain English
---

They have an idea but do not want to build it now: $ARGUMENTS

1. Ask one or two clarifying questions at most, only if the idea is unclear.
   Restate it back in one crisp paragraph and confirm.
2. File it: `gh issue create --label idea` with a short title and a body
   containing their idea (their words), the screens it affects, and who
   suggested it (name from `.claude/contributor`).
3. Post to Slack: read `SLACK_FEEDBACK_WEBHOOK_URL` from `.env.local` and
   `curl` a payload like
   `{"text":"<emoji> Suggestion from <Name>: <title>\n<issue link>"}`.
4. Confirm to them in one sentence that Matthew will see it.

If the `idea` label does not exist yet, create the issue without the label
rather than failing.
