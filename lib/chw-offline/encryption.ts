/**
 * IndexedDB Encryption Layer for CHW Offline Storage
 * Encrypts sensitive health data before storing in IndexedDB
 * Uses Web Crypto API with AES-GCM encryption
 */

import { encryptData, decryptData } from "@/lib/secure-storage"

const ENCRYPTION_KEY_STORAGE = "chw_encryption_key"
const STABLE_ENCRYPTION_KEY_PREFIX = "chw_encryption_stable_key:"

/**
 * Get or generate encryption key for current session
 * Key is derived from userId + sessionId for security
 */
function getEncryptionKey(): string {
  if (typeof window === "undefined") {
    throw new Error("Encryption only available in browser")
  }

  // Try to get existing key from sessionStorage (cleared on browser close)
  let key = sessionStorage.getItem(ENCRYPTION_KEY_STORAGE)
  if (key) {
    return key
  }

  const userId = localStorage.getItem("userId")
  if (!userId) {
    throw new Error("Cannot generate encryption key - user not authenticated")
  }

  const stableKeyStorageName = `${STABLE_ENCRYPTION_KEY_PREFIX}${userId}`
  const stableKey = localStorage.getItem(stableKeyStorageName)
  if (stableKey) {
    sessionStorage.setItem(ENCRYPTION_KEY_STORAGE, stableKey)
    return stableKey
  }

  if (!key) {
    // Keep backward compatibility with previously encrypted records by seeding
    // the stable key using the same legacy token-derived format when possible.
    const token = localStorage.getItem("accessToken") || localStorage.getItem("authToken")

    if (token) {
      key = `${userId}:${token.substring(0, 32)}`
    } else {
      key = `${userId}:cvcc-offline`
    }

    localStorage.setItem(stableKeyStorageName, key)
    sessionStorage.setItem(ENCRYPTION_KEY_STORAGE, key)
  }

  return key
}

/**
 * Encrypt sensitive field in an object
 */
export async function encryptField<T>(data: T, field: keyof T): Promise<T> {
  if (!data || typeof data !== "object") {
    return data
  }

  const value = data[field]
  if (value === null || value === undefined) {
    return data
  }

  try {
    const key = getEncryptionKey()
    const encrypted = await encryptData(value, key)

    return {
      ...data,
      [field]: encrypted,
    }
  } catch (error) {
    console.error(`Failed to encrypt field ${String(field)}:`, error)
    // Return original data if encryption fails (degraded mode)
    return data
  }
}

/**
 * Decrypt sensitive field in an object
 */
export async function decryptField<T>(data: T, field: keyof T): Promise<T> {
  if (!data || typeof data !== "object") {
    return data
  }

  const value = data[field]
  if (typeof value !== "string") {
    return data
  }

  // Check if field is encrypted (encrypted data is base64)
  if (!value.match(/^[A-Za-z0-9+/=]+$/)) {
    // Not encrypted, return as-is
    return data
  }

  try {
    const key = getEncryptionKey()
    const decrypted = await decryptData(value, key)

    return {
      ...data,
      [field]: decrypted,
    }
  } catch (error) {
    console.warn(`Failed to decrypt field ${String(field)}:`, error)
    // Return encrypted data if decryption fails
    return data
  }
}

/**
 * Encrypt an entire object's sensitive fields
 */
export async function encryptObject<T extends Record<string, any>>(
  data: T,
  sensitiveFields: (keyof T)[],
): Promise<T> {
  let encrypted = { ...data }

  for (const field of sensitiveFields) {
    encrypted = await encryptField(encrypted, field)
  }

  return encrypted
}

/**
 * Decrypt an entire object's sensitive fields
 */
export async function decryptObject<T extends Record<string, any>>(
  data: T,
  sensitiveFields: (keyof T)[],
): Promise<T> {
  let decrypted = { ...data }

  for (const field of sensitiveFields) {
    decrypted = await decryptField(decrypted, field)
  }

  return decrypted
}

/**
 * Clear encryption key on logout
 */
export function clearEncryptionKey(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(ENCRYPTION_KEY_STORAGE)
  }
}
