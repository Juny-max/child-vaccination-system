import { apiRequest } from './config';

// ============================================
// Types
// ============================================

export interface LoginRequest {
  email: string;
  password: string;
  userType: 'parent' | 'hq-admin' | 'branch-manager' | 'facility-nurse' | 'chw';
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phoneNumber?: string;
  lastLogin?: string;
  createdAt?: string;
  branchId?: string;
}

export interface AuthResponse {
  accessToken?: string;
  tokenType?: string;
  expiresIn?: number;
  user: UserProfile;
  mustChangePassword?: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ============================================
// Auth API Functions
// ============================================

/**
 * Login with email and password
 * JWT token is now stored in HttpOnly cookie by the backend
 */
export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  // Clear any existing data before login
  if (typeof window !== 'undefined') {
    localStorage.clear();
    sessionStorage.clear();
  }
  
  const response = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }, true); // Skip auth redirect for login endpoint
  
  // Store non-sensitive user info for UI purposes only
  // JWT token is in HttpOnly cookie, not accessible to JavaScript
  if (typeof window !== 'undefined') {
    if (response.accessToken) {
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.removeItem('authToken');
    }
    localStorage.setItem('userRole', response.user.role);
    sessionStorage.setItem('userName', response.user.fullName);
    localStorage.removeItem('userName');
    localStorage.setItem('userId', response.user.id);
  }
  
  return response;
}

/**
 * Register a new parent account
 * JWT token is now stored in HttpOnly cookie by the backend
 */
export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  // Store non-sensitive user info for UI purposes only
  // JWT token is in HttpOnly cookie, not accessible to JavaScript
  if (typeof window !== 'undefined') {
    if (response.accessToken) {
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.removeItem('authToken');
    }
    localStorage.setItem('userRole', response.user.role);
    sessionStorage.setItem('userName', response.user.fullName);
    localStorage.removeItem('userName');
    localStorage.setItem('userId', response.user.id);
  }
  
  return response;
}

/**
 * Get current user profile
 */
export async function getProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/auth/profile');
}

/**
 * Verify if current token is valid
 */
export async function verifyToken(): Promise<{ valid: boolean; user: UserProfile }> {
  return apiRequest<{ valid: boolean; user: UserProfile }>('/auth/verify');
}

/**
 * Refresh JWT token
 * Token is automatically refreshed in HttpOnly cookie by backend
 */
export async function refreshToken(): Promise<{ accessToken?: string }> {
  const response = await apiRequest<{ accessToken?: string }>('/auth/refresh', {
    method: 'POST',
  });

  if (typeof window !== 'undefined' && response.accessToken) {
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.removeItem('authToken');
  }

  return response;
}

/**
 * Logout current user and clear all local data
 * Backend will clear the HttpOnly cookie
 */
export async function logout(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch {
    // Ignore errors on logout
  } finally {
    // Clear ALL local storage and session storage for security
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
      // Redirect to login page
      window.location.href = '/auth/login';
    }
  }
}

/**
 * Check if user is authenticated
 * Checks for user data in localStorage (cookie is HttpOnly)
 * For true authentication check, use verifyToken() API call
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  // Check if user data exists (indicates previous login)
  return !!localStorage.getItem('userId');
}

/**
 * Get current user role
 */
export function getCurrentRole(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('userRole');
}

/**
 * Change password (for forced password change after first login)
 */
export async function changePassword(data: ChangePasswordRequest): Promise<{ success: boolean; message: string }> {
  return apiRequest('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Request password reset with email
 */
export async function forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }, true); // Skip auth redirect for password reset endpoint
}

/**
 * Reset password using token
 */
export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  }, true); // Skip auth redirect for password reset endpoint
}
