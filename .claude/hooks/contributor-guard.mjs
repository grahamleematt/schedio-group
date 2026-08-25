// Contributor guardrail rules. Invoked by contributor-guard.sh only when the
// contributor marker exists; reads the PreToolUse event JSON from stdin.
// Exit 0 allows the tool call, exit 2 blocks it (stderr goes back to Claude).
import { execSync } from 'node:child_process'

const repoRoot = process.argv[2] ?? process.cwd()

const raw = await new Promise((resolve) => {
  let buf = ''
  process.stdin.on('data', (chunk) => {
    buf += chunk
  })
  process.stdin.on('end', () => resolve(buf))
})

let event
try {
  event = JSON.parse(raw)
} catch {
  process.exit(0)
}

const toolName = event.tool_name ?? ''
const input = event.tool_input ?? {}

function block(reason, instead) {
  process.stderr.write(
    `Contributor guardrail: ${reason}\n${instead}\n` +
      'These limits keep idea branches safe; Matthew reviews and merges everything.\n',
  )
  process.exit(2)
}

function currentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

if (toolName === 'Bash') {
  const cmd = String(input.command ?? '')

  if (/\bgit\s+push\b[^;&|]*(\s--force\b|\s-f\b|--force-with-lease)/.test(cmd)) {
    block(
      'force-pushing is not allowed.',
      'Push normally to your idea branch instead.',
    )
  }

  if (/\bgit\s+push\b/.test(cmd)) {
    const pushesMain = /\bgit\s+push\b[^;&|]*[\s:]main\b/.test(cmd)
    const bareOnMain =
      currentBranch() === 'main' &&
      !/\bgit\s+push\b[^;&|]*\bidea\//.test(cmd)
    if (pushesMain || bareOnMain) {
      block(
        'pushing to main is not allowed.',
        'Work on an idea branch (use the idea skill) and share it as a draft PR with the share skill.',
      )
    }
  }

  if (/\bgit\s+(commit|cherry-pick)\b/.test(cmd) && currentBranch() === 'main') {
    block(
      'committing directly on main is not allowed.',
      'Use the idea skill first — it creates a branch for you.',
    )
  }

  if (/\bgit\s+merge\b/.test(cmd) || /\bgh\s+pr\s+merge\b/.test(cmd)) {
    block(
      'merging is Matthew’s job.',
      'Open a draft PR with the share skill and he will review and merge it.',
    )
  }

  if (
    /\bgh\s+(secret|variable)\b/.test(cmd) ||
    /\bgh\s+repo\s+(delete|edit)\b/.test(cmd)
  ) {
    block(
      'changing repo secrets or settings is not allowed.',
      'Ask Matthew instead.',
    )
  }

  if (/\bvercel\b/.test(cmd) || /\bgh\s+release\b/.test(cmd)) {
    block(
      'deploy commands are not allowed.',
      'Matthew handles deploys after reviewing your draft PR.',
    )
  }

  if (/\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i.test(cmd)) {
    block(
      'recursive force-delete is not allowed.',
      'Delete specific files instead, or use the reset skill to get back to a clean state.',
    )
  }

  const touchesProtected =
    /(^|[\s"'=/])\.env[.\w-]*/.test(cmd) ||
    /(^|[\s"'=])(\.\/)?(db|\.github)\//.test(cmd) ||
    /\.claude\/(settings\.json|hooks)/.test(cmd)
  const writes = /(>|\brm\b|\bmv\b|\bcp\b|\bsed\s+-i|\btee\b|\btruncate\b)/.test(
    cmd,
  )
  if (touchesProtected && writes) {
    block(
      'that command writes to a protected file (.env*, db/, .github/, or the guardrails).',
      'Those stay as-is in contributor mode; ask Matthew if something there needs to change.',
    )
  }

  process.exit(0)
}

const paths = [
  input.file_path,
  input.notebook_path,
  ...(Array.isArray(input.edits) ? input.edits.map((e) => e?.file_path) : []),
].filter(Boolean)

for (const p of paths) {
  const abs = String(p)
  const rel = abs.startsWith(repoRoot) ? abs.slice(repoRoot.length + 1) : abs
  const isProtected =
    /(^|\/)\.env[^/]*$/.test(rel) ||
    /^db\//.test(rel) ||
    /^\.github\//.test(rel) ||
    rel === '.claude/settings.json' ||
    /^\.claude\/hooks\//.test(rel)
  if (isProtected) {
    block(
      `editing ${rel} is not allowed (protected: .env*, db/, .github/, guardrail files).`,
      'Everything else — routes, components, styles — is yours to change.',
    )
  }
}

process.exit(0)
