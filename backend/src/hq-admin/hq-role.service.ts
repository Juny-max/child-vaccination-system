import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class HqRoleService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Get all custom roles
   */
  async getRoles() {
    try {
      const { data: roles } = await this.db.supabase
        .from('roles')
        .select('*')
        .order('created_at', { ascending: false });

      return (roles || []).map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions || [],
        createdAt: role.created_at,
        isSystem: role.is_system || false,
      }));
    } catch (error) {
      console.error('Failed to get roles:', error);
      return [];
    }
  }

  /**
   * Create a new custom role
   */
  async createRole(roleData: { name: string; description: string; permissions: string[] }, user: any) {
    try {
      const roleId = uuidv4();

      const { error: insertError } = await this.db.supabase.from('roles').insert({
        id: roleId,
        name: roleData.name,
        description: roleData.description,
        permissions: roleData.permissions,
        is_system: false,
        created_by: user.id,
        created_at: new Date().toISOString(),
      });

      if (insertError) {
        throw new InternalServerErrorException(`Failed to create role: ${insertError.message}`);
      }

      // Log the action
      await this.db.createAuditLog(user.id, 'insert', 'role', roleId, { after: { name: roleData.name } });

      return { success: true, roleId, message: `Role "${roleData.name}" created` };
    } catch (error) {
      console.error('Failed to create role:', error);
      throw error;
    }
  }

  /**
   * Update an existing role
   */
  async updateRole(id: string, roleData: { name?: string; description?: string; permissions?: string[] }, user: any) {
    try {
      const updatePayload: any = {};
      if (roleData.name) updatePayload.name = roleData.name;
      if (roleData.description) updatePayload.description = roleData.description;
      if (roleData.permissions) updatePayload.permissions = roleData.permissions;
      updatePayload.updated_at = new Date().toISOString();

      const { error: updateError } = await this.db.supabase.from('roles').update(updatePayload).eq('id', id);

      if (updateError) {
        throw new InternalServerErrorException(`Failed to update role: ${updateError.message}`);
      }

      // Log the action
      await this.db.createAuditLog(user.id, 'update', 'role', id, { after: updatePayload });

      return { success: true, message: 'Role updated' };
    } catch (error) {
      console.error('Failed to update role:', error);
      throw error;
    }
  }

  /**
   * Delete a custom role
   */
  async deleteRole(id: string, user: any) {
    try {
      const { error: deleteError } = await this.db.supabase.from('roles').delete().eq('id', id).eq('is_system', false);

      if (deleteError) {
        throw new InternalServerErrorException(`Failed to delete role: ${deleteError.message}`);
      }

      // Log the action
      await this.db.createAuditLog(user.id, 'delete', 'role', id);

      return { success: true, message: 'Role deleted' };
    } catch (error) {
      console.error('Failed to delete role:', error);
      throw error;
    }
  }

  /**
   * Get all available permissions
   */
  async getAvailablePermissions() {
    return [
      { id: 'p1', permission: 'create_user', category: 'users', description: 'Create new users' },
      { id: 'p2', permission: 'edit_user', category: 'users', description: 'Edit user profiles' },
      { id: 'p3', permission: 'delete_user', category: 'users', description: 'Delete users' },
      { id: 'p4', permission: 'manage_branches', category: 'branches', description: 'Manage branch settings' },
      { id: 'p5', permission: 'view_analytics', category: 'analytics', description: 'View analytics dashboards' },
      { id: 'p6', permission: 'trigger_backup', category: 'system', description: 'Trigger system backup' },
      { id: 'p7', permission: 'manage_vaccines', category: 'vaccines', description: 'Manage vaccine inventory' },
      { id: 'p8', permission: 'export_data', category: 'system', description: 'Export system data' },
      { id: 'p9', permission: 'view_audit_logs', category: 'system', description: 'View audit logs' },
      { id: 'p10', permission: 'manage_roles', category: 'system', description: 'Manage roles and permissions' },
    ];
  }
}
