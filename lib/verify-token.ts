import { randomBytes } from 'crypto'

// Use globalThis to ensure persistence across module reloads
declare global {
  var _verifyTokenStore: Map<string, number> | undefined
  var _verifyTokenCleanup: boolean | undefined
}

// Initialize token store on globalThis
function getTokenStore(): Map<string, number> {
  if (!global._verifyTokenStore) {
    global._verifyTokenStore = new Map()
  }
  return global._verifyTokenStore
}

// Cleanup interval for expired tokens (every 2 minutes)
if (!global._verifyTokenCleanup) {
  global._verifyTokenCleanup = true
  setInterval(() => {
    const tokenStore = getTokenStore()
    const now = Date.now()
    for (const [token, expiresAt] of tokenStore.entries()) {
      if (now > expiresAt) {
        tokenStore.delete(token)
      }
    }
  }, 2 * 60 * 1000)
}

/**
 * Generate a verification token for the /verify page
 * Token is valid for 5 minutes and can only be used once
 */
export function generateVerificationToken(): { token: string; expiresIn: number } {
  const tokenStore = getTokenStore()
  const token = randomBytes(32).toString('hex')
  const expiresAt = Date.now() + 5 * 60 * 1000
  tokenStore.set(token, expiresAt)
  return { token, expiresIn: 300 }
}

/**
 * Verify if a token is valid and not expired
 */
export function isTokenValid(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false
  }

  const tokenStore = getTokenStore()
  const expiresAt = tokenStore.get(token)
  
  if (!expiresAt) {
    return false
  }

  if (Date.now() > expiresAt) {
    tokenStore.delete(token)
    return false
  }

  return true
}

/**
 * Consume a token after successful verification
 * Prevents token reuse
 */
export function consumeToken(token: string): void {
  const tokenStore = getTokenStore()
  tokenStore.delete(token)
}
