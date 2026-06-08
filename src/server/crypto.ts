/**
 * Authenticated symmetric encryption for secrets stored at rest (currently the
 * per-user Egnyte refresh token). AES-256-GCM with a random 12-byte IV per
 * payload; the 32-byte key is derived from {@link getTokenEncryptionSecret} via
 * scrypt with a fixed application salt so the same secret always yields the
 * same key.
 *
 * Wire format (single base64 string): `iv(12) | authTag(16) | ciphertext`.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto'

import { getTokenEncryptionSecret } from './env'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16
/** Fixed, non-secret salt — the secret itself supplies the entropy. */
const KEY_SALT = 'sg-dream::egnyte-token::v1'

let cachedKey: Buffer | null = null

function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey
  cachedKey = scryptSync(getTokenEncryptionSecret(), KEY_SALT, 32)
  return cachedKey
}

/** Encrypt UTF-8 plaintext, returning a self-describing base64 payload. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

/** Decrypt a payload produced by {@link encryptSecret}. Throws if tampered. */
export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, 'base64')
  if (buf.length <= IV_BYTES + TAG_BYTES) {
    throw new Error('Encrypted secret payload is malformed')
  }
  const iv = buf.subarray(0, IV_BYTES)
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES)
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8')
}
