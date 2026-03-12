/**
 * API Configuration
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/**
 * Get authorization headers (cookies sent automatically)
 */
export function getAuthHeaders(): HeadersInit {
  let authorizationHeader: string | undefined;

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      authorizationHeader = `Bearer ${token}`;
    }
  }

  return {
    'Content-Type': 'application/json',
    ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
  };
}

/**
 * Handle API response errors
 */
export async function handleResponse<T>(response: Response, skipAuthRedirect = false): Promise<T> {
  if (!response.ok) {
    if (response.status === 401 && !skipAuthRedirect) {
      // Token expired or invalid - redirect to login
      if (typeof window !== 'undefined') {
        // Clear all localStorage for security
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/auth/login';
      }
      throw new Error('Session expired. Please login again.');
    }
    
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
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
