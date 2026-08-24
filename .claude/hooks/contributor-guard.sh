#!/usr/bin/env bash
# Contributor guardrails for Claude Code (PreToolUse hook).
#
# Enforced ONLY when the gitignored marker file `.claude/contributor` exists —
# it is written once by the /onboard command on a contributor's machine.
# Without the marker (e.g. Matthew's environment) this script exits 0
# immediately and changes nothing.
#
# Exit codes: 0 = allow, 2 = block (stderr is shown to Claude so it can
# explain and pick a safer path).
set -uo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[ -f "$repo_root/.claude/contributor" ] || exit 0

exec node "$repo_root/.claude/hooks/contributor-guard.mjs" "$repo_root"
