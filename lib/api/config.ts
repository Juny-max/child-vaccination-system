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
  
  return response.json();
}

/**
 * API request helper
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  skipAuthRedirect = false
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
    credentials: 'include', // CRITICAL: Send HttpOnly cookies with every request
  });
  
  return handleResponse<T>(response, skipAuthRedirect);
}
