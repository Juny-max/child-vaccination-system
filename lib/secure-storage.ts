/**
 * Secure Storage Utility
 * Provides encryption/decryption for sensitive data using Web Crypto API
 * For storing sensitive health data with encryption
 */

/**
 * Generate an encryption key from a user-specific password or session ID
 * In production, this should be derived from the user's session
 */
async function deriveKey(userPassword: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('cvcc-salt-v1'), // In production, use unique salt per user
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data using AES-GCM
 * @param data - The data to encrypt (will be JSON stringified)
 * @param userKey - User-specific key (e.g., userId)
 * @returns Base64 encoded encrypted string with IV prepended
 */
export async function encryptData(data: any, userKey: string): Promise<string> {
  try {
    const key = await deriveKey(userKey);
    const encoder = new TextEncoder();
    const dataString = JSON.stringify(data);
    const dataBuffer = encoder.encode(dataString);

    // Generate a random IV (Initialization Vector)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the data
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      dataBuffer
    );

    // Combine IV and encrypted data
    const encryptedArray = new Uint8Array(encryptedBuffer);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv, 0);
    combined.set(encryptedArray, iv.length);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data using AES-GCM
 * @param encryptedData - Base64 encoded encrypted string
 * @param userKey - User-specific key (e.g., userId)
 * @returns Decrypted data (parsed from JSON)
 */
export async function decryptData<T = any>(encryptedData: string, userKey: string): Promise<T> {
  try {
    const key = await deriveKey(userKey);
    
    // Convert from base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedArray = combined.slice(12);

    // Decrypt the data
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encryptedArray
    );

    // Convert back to string and parse JSON
    const decoder = new TextDecoder();
    const decryptedString = decoder.decode(decryptedBuffer);
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Secure storage wrapper for localStorage with encryption
 */
export const secureStorage = {
  /**
   * Store encrypted data in localStorage
   */
  async setItem(key: string, value: any, userKey: string): Promise<void> {
    if (typeof window === 'undefined') return;
    
    const encrypted = await encryptData(value, userKey);
    localStorage.setItem(key, encrypted);
  },

  /**
   * Retrieve and decrypt data from localStorage
   */
  async getItem<T = any>(key: string, userKey: string): Promise<T | null> {
    if (typeof window === 'undefined') return null;
    
    const encrypted = localStorage.getItem(key);
    if (!encrypted) return null;

    try {
      return await decryptData<T>(encrypted, userKey);
    } catch {
      // If decryption fails, remove the corrupted data
      localStorage.removeItem(key);
      return null;
    }
  },

  /**
   * Remove item from localStorage
   */
  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  },

  /**
   * Clear all items from localStorage
   */
  clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.clear();
  },
};

/**
 * Check if sensitive data should be encrypted
 * For CHW vaccination records with GPS coordinates
 */
export function shouldEncrypt(data: any): boolean {
  if (!data) return false;
  
  // Check if data contains sensitive health information
  const hasSensitiveData = 
    data.latitude !== undefined ||
    data.longitude !== undefined ||
    data.childName !== undefined ||
    data.motherName !== undefined ||
    data.phoneNumber !== undefined ||
    data.vaccineName !== undefined;

  return hasSensitiveData;
}
