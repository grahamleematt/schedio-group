/**
 * One-time Egnyte refresh-token mint (Authorization Code flow).
 *
 *   yarn egnyte:mint-refresh-token
 *   yarn egnyte:mint-refresh-token --code=<AUTH_CODE>
 *
 * Requires EGNYTE_DOMAIN, EGNYTE_CLIENT_ID, and EGNYTE_CLIENT_SECRET in
 * `.env.local`. See docs/egnyte-setup.md §3.
 */

import { execSync } from 'node:child_process'
import { createInterface } from 'node:readline'

/** Egnyte rejects http:// redirect URIs; must match the API key exactly. */
const DEFAULT_REDIRECT_URI = 'https://localhost/callback'
const SCOPE = 'Egnyte.filesystem Egnyte.permissions'

function redirectUri(): string {
  const uri = process.env.EGNYTE_REDIRECT_URI?.trim() || DEFAULT_REDIRECT_URI
  if (!uri.startsWith('https://')) {
    console.error(
      `EGNYTE_REDIRECT_URI must be https (Egnyte rejects http). Got: ${uri}`,
    )
    process.exit(1)
  }
  return uri
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`Missing ${name} in .env.local`)
    process.exit(1)
  }
  return value
}

function authUrl(
  domain: string,
  clientId: string,
  redirect: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    scope: SCOPE,
    response_type: 'code',
    state: 'sg-dream',
  })
  return `https://${domain}.egnyte.com/puboauth/token?${params.toString()}`
}

async function verifyApiKeyRegistered(
  domain: string,
  clientId: string,
  redirect: string,
): Promise<void> {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    scope: SCOPE,
    response_type: 'code',
    state: 'sg-dream',
  })
  const response = await fetch(
    `https://${domain}.egnyte.com/puboauth/token?${params.toString()}`,
    { redirect: 'manual' },
  )
  const body = await response.text()
  if (
    response.status === 401 &&
    body.includes('No valid app info found for api key')
  ) {
    console.error(
      '\nEgnyte does not recognize EGNYTE_CLIENT_ID on this domain.\n' +
        `  Domain: ${domain}.egnyte.com\n` +
        `  Client ID: ${clientId.slice(0, 4)}…${clientId.slice(-4)} (${clientId.length} chars)\n\n` +
        'Fix:\n' +
        '  1. Sign in at https://' +
        domain +
        '.egnyte.com as an admin.\n' +
        '  2. Settings → Configuration → API Keys → open your SG DREAM app\n' +
        '     (or Add a new key with Authorization Code + Refresh Token).\n' +
        '  3. Copy Client ID and Client Secret fresh into .env.local.\n' +
        '  4. Set Redirect URI to exactly: ' +
        redirect +
        '\n' +
        '  5. Save the key, then re-run this script.\n\n' +
        'If the key was created at developers.egnyte.com instead, the app must\n' +
        'be registered for domain "' +
        domain +
        '" and approved by Egnyte before OAuth works.\n',
    )
    process.exit(1)
  }
}

function readCodeArg(): string | undefined {
  const prefix = '--code='
  const arg = process.argv.slice(2).find((a) => a.startsWith(prefix))
  return arg?.slice(prefix.length).trim() || undefined
}

async function promptForCode(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const code = await new Promise<string>((resolve) => {
    rl.question(
      '\nPaste the `code` from the redirect URL (localhost page may not load):\n> ',
      (answer) => {
        rl.close()
        resolve(answer.trim())
      },
    )
  })
  return code
}

async function exchangeCode(
  domain: string,
  clientId: string,
  clientSecret: string,
  redirect: string,
  code: string,
): Promise<{ refresh_token?: string; access_token?: string; error?: string }> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirect,
    code,
    grant_type: 'authorization_code',
  })

  const response = await fetch(`https://${domain}.egnyte.com/puboauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const json = (await response.json()) as {
    refresh_token?: string
    access_token?: string
    error?: string
    error_description?: string
  }

  if (!response.ok) {
    const detail = json.error_description ?? json.error ?? response.statusText
    console.error(`Token exchange failed (${response.status}): ${detail}`)
    process.exit(1)
  }

  return json
}

async function main(): Promise<void> {
  const domain = required('EGNYTE_DOMAIN')
  const clientId = required('EGNYTE_CLIENT_ID')
  const clientSecret = required('EGNYTE_CLIENT_SECRET')
  const redirect = redirectUri()

  console.log(`\nUsing redirect URI: ${redirect}`)
  console.log(
    '  (Must match Egnyte API key settings exactly. No local server required.)\n',
  )

  console.log('Checking API key on Egnyte…')
  await verifyApiKeyRegistered(domain, clientId, redirect)

  const url = authUrl(domain, clientId, redirect)
  console.log('1. Approve in the browser (opens automatically on macOS):\n')
  console.log(url)

  if (process.platform === 'darwin') {
    execSync(`open ${JSON.stringify(url)}`, { stdio: 'inherit' })
  }

  let code = readCodeArg()
  if (!code) {
    console.log(
      '\n2. After approving, Egnyte redirects to:\n' +
        `   ${redirect}?code=<AUTH_CODE>\n` +
        '   The page may not load — copy the code from the address bar only.',
    )
    code = await promptForCode()
  }

  if (!code) {
    console.error('No authorization code provided.')
    process.exit(1)
  }

  console.log('\n3. Exchanging code for tokens…')
  const tokens = await exchangeCode(
    domain,
    clientId,
    clientSecret,
    redirect,
    code,
  )

  if (!tokens.refresh_token) {
    console.error('Response did not include refresh_token:', tokens)
    process.exit(1)
  }

  console.log('\nSuccess. Add to `.env.local`:\n')
  console.log(`EGNYTE_REFRESH_TOKEN=${tokens.refresh_token}`)
  if (!process.env.EGNYTE_DOMAIN) {
    console.log(`EGNYTE_DOMAIN=${domain}`)
  }
  console.log('\n(access_token is short-lived; only refresh_token is stored.)')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
