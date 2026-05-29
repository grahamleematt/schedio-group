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
  IS_VERCEL: boolean
}

export type DatabaseEnv = {
  DATABASE_URL: string
  DATABASE_SSL: boolean
}

export type EgnyteEnv = {
  EGNYTE_DOMAIN: string
  EGNYTE_CLIENT_ID: string
  EGNYTE_CLIENT_SECRET: string
  EGNYTE_REFRESH_TOKEN: string
  EGNYTE_ROOT_PATH: string
}

export type WorkOsEnv = {
  WORKOS_API_KEY: string
  WORKOS_CLIENT_ID: string
  WORKOS_COOKIE_PASSWORD: string
  WORKOS_REDIRECT_URI: string
}

export type AiEnv = {
  OPENAI_API_KEY: string
  OPENAI_EMBEDDING_MODEL: string
  OPENAI_REASONING_MODEL: string
}

let cached: Env | null = null
let databaseCached: DatabaseEnv | null = null
let egnyteCached: EgnyteEnv | null = null
let workOsCached: WorkOsEnv | null = null
let aiCached: AiEnv | null = null

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

/**
 * DocuPipe admin/runtime credentials. Deliberately does NOT include the webhook
 * signing secret so setup/sync commands and the document-posting client can run
 * before the webhook endpoint (and its secret) exist. The webhook route reads
 * the secret separately via {@link getDocupipeWebhookSecret}.
 */
export function getEnv(): Env {
  if (cached) return cached
  cached = {
    DOCUPIPE_API_KEY: read('DOCUPIPE_API_KEY'),
    DOCUPIPE_BASE_URL: read('DOCUPIPE_BASE_URL', 'https://app.docupipe.ai'),
    DOCUPIPE_WORKFLOW_ID: read('DOCUPIPE_WORKFLOW_ID'),
    IS_VERCEL: Boolean(process.env.VERCEL),
  }
  return cached
}

/** Webhook signing secret, required only by the DocuPipe webhook route. */
export function getDocupipeWebhookSecret(): string {
  return read('DOCUPIPE_WEBHOOK_SECRET')
}

export function getDatabaseEnv(): DatabaseEnv {
  if (databaseCached) return databaseCached
  databaseCached = {
    DATABASE_URL: read('DATABASE_URL'),
    DATABASE_SSL: read('DATABASE_SSL', 'true') !== 'false',
  }
  return databaseCached
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

export function getWorkOsEnv(): WorkOsEnv {
  if (workOsCached) return workOsCached
  workOsCached = {
    WORKOS_API_KEY: read('WORKOS_API_KEY'),
    WORKOS_CLIENT_ID: read('WORKOS_CLIENT_ID'),
    WORKOS_COOKIE_PASSWORD: read('WORKOS_COOKIE_PASSWORD'),
    WORKOS_REDIRECT_URI: read('WORKOS_REDIRECT_URI'),
  }
  return workOsCached
}

export function getAiEnv(): AiEnv {
  if (aiCached) return aiCached
  aiCached = {
    OPENAI_API_KEY: read('OPENAI_API_KEY'),
    OPENAI_EMBEDDING_MODEL: read(
      'OPENAI_EMBEDDING_MODEL',
      'text-embedding-3-large',
    ),
    OPENAI_REASONING_MODEL: read('OPENAI_REASONING_MODEL', 'gpt-5.2'),
  }
  return aiCached
}

/**
 * True when Egnyte credentials are configured. The /api/uploads route and
 * webhook check this so the app still runs in environments without Egnyte
 * (e.g. CI or a local review build with only DocuPipe wired in).
 */
export function isEgnyteConfigured(): boolean {
  return Boolean(
    readOptional('EGNYTE_DOMAIN') &&
    readOptional('EGNYTE_CLIENT_ID') &&
    readOptional('EGNYTE_CLIENT_SECRET') &&
    readOptional('EGNYTE_REFRESH_TOKEN'),
  )
}

export function isDatabaseConfigured(): boolean {
  return Boolean(readOptional('DATABASE_URL'))
}

export function isWorkOsConfigured(): boolean {
  return Boolean(
    readOptional('WORKOS_API_KEY') &&
    readOptional('WORKOS_CLIENT_ID') &&
    readOptional('WORKOS_COOKIE_PASSWORD') &&
    readOptional('WORKOS_REDIRECT_URI'),
  )
}

export function isAiConfigured(): boolean {
  return Boolean(readOptional('OPENAI_API_KEY'))
}

export function isKvConfigured(): boolean {
  return Boolean(
    readOptional('KV_REST_API_URL') && readOptional('KV_REST_API_TOKEN'),
  )
}

export function isVercel(): boolean {
  return Boolean(process.env.VERCEL)
}

/**
 * Strict staging/production posture. When on, the app fails closed instead of
 * silently falling back to dev conveniences: Postgres is required (no KV/memory/
 * JSON fallback), WorkOS auth is required (no static Tim fallback), and Egnyte
 * imports are locked to the resolved entity intake folder.
 */
export function isStrictMode(): boolean {
  return readOptional('SG_DREAM_STRICT_MODE') === 'true'
}

/**
 * Master switch for the real intake pipeline. Off by default so setup and
 * preflight never create a DocuPipe extraction by accident; flip to `true` for
 * an intentional real upload/import test.
 */
export function isIntakePipelineEnabled(): boolean {
  return readOptional('INTAKE_PIPELINE_ENABLED') === 'true'
}

/**
 * Gates the unfinished Intelligence + Determinations surfaces. Off by default,
 * including in staging/production, so those routes can't read the local source
 * zip or expose half-built workbenches during the intake demo. Set
 * `INTELLIGENCE_PREVIEW_ENABLED=true` locally to work on them.
 */
export function isIntelligencePreviewEnabled(): boolean {
  return readOptional('INTELLIGENCE_PREVIEW_ENABLED') === 'true'
}
