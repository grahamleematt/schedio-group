/**
 * Typed, server-only env reader. Imported ONLY from code under
 * `src/server/**` or server routes / server functions. Never from a
 * component, a client loader, or any module that ends up in the browser
 * bundle.
 *
 * Reads at first access so that imports in isomorphic files (types only)
 * don't throw during the client build.
 */

type Env = {
  DOCUPIPE_API_KEY: string
  DOCUPIPE_BASE_URL: string
  DOCUPIPE_WORKFLOW_ID: string
  DOCUPIPE_WEBHOOK_SECRET: string
  IS_VERCEL: boolean
}

export type EgnyteEnv = {
  EGNYTE_DOMAIN: string
  EGNYTE_CLIENT_ID: string
  EGNYTE_CLIENT_SECRET: string
  EGNYTE_REFRESH_TOKEN: string
  EGNYTE_ROOT_PATH: string
}

let cached: Env | null = null
let egnyteCached: EgnyteEnv | null = null

function read(name: string, fallback?: string): string {
  const v = process.env[name]
  if (v && v.length > 0) return v
  if (fallback !== undefined) return fallback
  throw new Error(
    `Missing required env var ${name}. See docs/docupipe-setup.md for how to generate it.`,
  )
}

function readOptional(name: string): string | undefined {
  const v = process.env[name]
  return v && v.length > 0 ? v : undefined
}

export function getEnv(): Env {
  if (cached) return cached
  cached = {
    DOCUPIPE_API_KEY: read('DOCUPIPE_API_KEY'),
    DOCUPIPE_BASE_URL: read('DOCUPIPE_BASE_URL', 'https://app.docupipe.ai'),
    DOCUPIPE_WORKFLOW_ID: read('DOCUPIPE_WORKFLOW_ID'),
    DOCUPIPE_WEBHOOK_SECRET: read('DOCUPIPE_WEBHOOK_SECRET'),
    IS_VERCEL: Boolean(process.env.VERCEL),
  }
  return cached
}

/**
 * Egnyte env lookup. Called from `src/server/egnyte.ts` only. Throws on
 * missing keys the same way `getEnv` does; `docs/egnyte-setup.md` explains
 * how to generate each value.
 */
export function getEgnyteEnv(): EgnyteEnv {
  if (egnyteCached) return egnyteCached
  egnyteCached = {
    EGNYTE_DOMAIN: read('EGNYTE_DOMAIN'),
    EGNYTE_CLIENT_ID: read('EGNYTE_CLIENT_ID'),
    EGNYTE_CLIENT_SECRET: read('EGNYTE_CLIENT_SECRET'),
    EGNYTE_REFRESH_TOKEN: read('EGNYTE_REFRESH_TOKEN'),
    EGNYTE_ROOT_PATH: read('EGNYTE_ROOT_PATH', '/Shared/Clients'),
  }
  return egnyteCached
}

/**
 * True when Egnyte credentials are configured. The /api/uploads route and
 * webhook check this so the app still runs in environments without Egnyte
 * (e.g. CI or a local demo with only DocuPipe wired in).
 */
export function isEgnyteConfigured(): boolean {
  return Boolean(
    readOptional('EGNYTE_DOMAIN') &&
      readOptional('EGNYTE_CLIENT_ID') &&
      readOptional('EGNYTE_CLIENT_SECRET') &&
      readOptional('EGNYTE_REFRESH_TOKEN'),
  )
}

export function isVercel(): boolean {
  return Boolean(process.env.VERCEL)
}
