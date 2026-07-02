/**
 * API Configuration
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Get request headers. Auth is carried by the backend's HttpOnly cookie.
 */
export function getAuthHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
  };
}

/**
 * Handle API response errors
 */
export async function handleResponse<T>(response: Response, skipAuthRedirect = false): Promise<T> {
  if (!response.ok) {
    const errorPayload = await response
      .json()
      .catch(() => ({ message: 'An error occurred', code: undefined, details: undefined }));

    const payloadMessage = Array.isArray(errorPayload?.message)
      ? errorPayload.message.join(', ')
      : errorPayload?.message;
    const message = payloadMessage || `HTTP error! status: ${response.status}`;
    const code = errorPayload?.code;

    if (response.status === 401 && !skipAuthRedirect) {
      if (typeof window !== 'undefined') {
        // Remove auth tokens only — stable encryption keys (chw_encryption_stable_key:*)
        // must survive so the CHW can still decrypt their IndexedDB data after re-login
        // on the same device.
        ;["authToken", "accessToken", "userId", "userRole", "userRoleDetail",
          "userName", "chw-last-background-sync", "chw_last_data_access",
        ].forEach((k) => localStorage.removeItem(k))
        sessionStorage.clear();
        window.location.href = '/auth/login';
      }
      throw new ApiError('Session expired. Please login again.', 401, code || 'SESSION_EXPIRED', errorPayload);
    }

    throw new ApiError(message, response.status, code, errorPayload);
  }
  
  // Check if response has content before trying to parse JSON
  const contentType = response.headers.get('content-type');
  const contentLength = response.headers.get('content-length');
  
  // If no content or empty response (common for DELETE operations)
  if (response.status === 204 || contentLength === '0' || !contentType?.includes('application/json')) {
    return undefined as T;
  }
  
  // Check if response body is empty
  const text = await response.text();
  if (!text || text.trim() === '') {
    return undefined as T;
  }
  
  return JSON.parse(text);
}

/**
 * API request helper
 * Includes a 20-second AbortController timeout so requests never hang
 * indefinitely (e.g. when the Render backend is waking up from sleep).
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  skipAuthRedirect = false
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
      credentials: 'include', // CRITICAL: Send HttpOnly cookies with every request
    });
    clearTimeout(timeoutId);
    return handleResponse<T>(response, skipAuthRedirect);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. The server may be starting up — please try again in a moment.');
    }
    throw error;
  }
}
