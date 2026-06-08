import { apiRequest } from './config';

export interface HqUser {
  id: string;
  name: string;
  email: string;
  role: string;
  branch?: string;
  status: 'active' | 'inactive';
  mustChangePassword?: boolean;
  lastLoginAt?: string | null;
}

export interface HqUserCreateResponse extends HqUser {
  emailSent: boolean;
  message: string;
  reason?: string | null;
  temporaryPassword?: string;
}

export interface CreateHqUserPayload {
  fullName: string;
  email: string;
  role: string;
  branch?: string;
}

export interface UpdateHqUserPayload {
  fullName: string;
  email: string;
  role?: string;
  branch?: string;
}

export interface HqResetPasswordResponse {
  emailSent: boolean;
  message: string;
  reason?: string | null;
}

export interface TransferHqUserPayload {
  targetBranch: string;
  replacementManagerId?: string;
}

export async function getHqUsers(): Promise<HqUser[]> {
  return apiRequest<HqUser[]>('/hq-admin/users');
}

export async function createHqUser(payload: CreateHqUserPayload): Promise<HqUserCreateResponse> {
  return apiRequest<HqUserCreateResponse>('/hq-admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateHqUser(userId: string, payload: UpdateHqUserPayload): Promise<HqUser> {
  return apiRequest<HqUser>(`/hq-admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function updateHqUserStatus(userId: string, status: 'active' | 'inactive'): Promise<HqUser> {
  return apiRequest<HqUser>(`/hq-admin/users/${encodeURIComponent(userId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function transferHqUser(userId: string, payload: TransferHqUserPayload): Promise<HqUser> {
  return apiRequest<HqUser>(`/hq-admin/users/${encodeURIComponent(userId)}/transfer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resetHqUserPassword(email: string): Promise<HqResetPasswordResponse> {
  return apiRequest<HqResetPasswordResponse>('/hq-admin/users/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}
