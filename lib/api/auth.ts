import { apiRequest } from './config';

// ============================================
// Types
// ============================================

export interface LoginRequest {
  email: string;
  password: string;
  userType: 'parent' | 'hq-admin' | 'branch-manager' | 'facility-nurse' | 'chw' | 'data-officer' | 'pha';
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
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserProfile;
}

// ============================================
// Auth API Functions
// ============================================

/**
 * Login with email and password
 */
export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  // Clear any existing token before login to prevent 401 errors
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken');
  }
  
  const response = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }, true); // Skip auth redirect for login endpoint
  
  // Store auth data in localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', response.accessToken);
    localStorage.setItem('userRole', response.user.role);
    localStorage.setItem('userName', response.user.fullName);
    localStorage.setItem('userId', response.user.id);
  }
  
  return response;
}

/**
 * Register a new parent account
 */
export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  // Store auth data in localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', response.accessToken);
    localStorage.setItem('userRole', response.user.role);
    localStorage.setItem('userName', response.user.fullName);
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
 */
export async function refreshToken(): Promise<{ accessToken: string }> {
  const response = await apiRequest<{ accessToken: string }>('/auth/refresh', {
    method: 'POST',
  });
  
  if (typeof window !== 'undefined') {
    localStorage.setItem('authToken', response.accessToken);
  }
  
  return response;
}

/**
 * Logout current user
 */
export async function logout(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch {
    // Ignore errors on logout
  } finally {
    // Clear local storage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      localStorage.removeItem('userId');
    }
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('authToken');
}

/**
 * Get current user role
 */
export function getCurrentRole(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('userRole');
}
