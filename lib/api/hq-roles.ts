import { apiRequest } from './config';

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  createdAt: string;
  isSystem: boolean;
}

export interface RolePermission {
  id: string;
  permission: string;
  category: 'users' | 'branches' | 'vaccines' | 'analytics' | 'system';
  description: string;
}

/**
 * Get all custom roles
 */
export async function getCustomRoles(): Promise<CustomRole[]> {
  return apiRequest<CustomRole[]>('/hq-admin/roles');
}

/**
 * Create a new custom role
 */
export async function createCustomRole(roleData: {
  name: string;
  description: string;
  permissions: string[];
}): Promise<{ success: boolean; roleId: string; message: string }> {
  return apiRequest('/hq-admin/roles', {
    method: 'POST',
    body: JSON.stringify(roleData),
  });
}

/**
 * Update an existing role
 */
export async function updateCustomRole(
  roleId: string,
  roleData: { name?: string; description?: string; permissions?: string[] },
): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/hq-admin/roles/${roleId}`, {
    method: 'PUT',
    body: JSON.stringify(roleData),
  });
}

/**
 * Delete a custom role
 */
export async function deleteCustomRole(roleId: string): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/hq-admin/roles/${roleId}`, {
    method: 'DELETE',
  });
}

/**
 * Get all available permissions
 */
export async function getAvailablePermissions(): Promise<RolePermission[]> {
  return apiRequest<RolePermission[]>('/hq-admin/roles/permissions');
}
