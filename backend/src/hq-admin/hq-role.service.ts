import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';

/**
 * Roles in this system are fixed enums defined in the database schema.
 * Custom role creation/deletion is not supported.
 * This service exposes the role catalog and their associated permissions.
 */
@Injectable()
export class HqRoleService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Get all system roles with their descriptions and permissions.
   * Roles are enum-based in the schema — this returns the static catalog.
   */
  async getRoles() {
    return [
      {
        id: 'hq-admin',
        name: 'HQ Admin',
        description: 'National headquarters administrator with full system access',
        permissions: [
          'create_user', 'edit_user', 'delete_user',
          'manage_branches', 'view_analytics', 'trigger_backup',
          'manage_vaccines', 'export_data', 'view_audit_logs', 'manage_roles',
        ],
        isSystem: true,
        createdAt: null,
      },
      {
        id: 'branch-manager',
        name: 'Branch Manager',
        description: 'Manages branch-level operations, staff assignments, and reporting',
        permissions: ['view_analytics', 'manage_branches', 'export_data'],
        isSystem: true,
        createdAt: null,
      },
      {
        id: 'facility-nurse',
        name: 'Facility Nurse',
        description: 'Records vaccinations and manages child registrations at the facility',
        permissions: ['manage_vaccines'],
        isSystem: true,
        createdAt: null,
      },
      {
        id: 'chw',
        name: 'Community Health Worker',
        description: 'Door-to-door outreach and offline vaccination recording',
        permissions: ['manage_vaccines'],
        isSystem: true,
        createdAt: null,
      },
      {
        id: 'data-officer',
        name: 'Data Officer',
        description: 'Manages data quality, resolves duplicates and sync conflicts',
        permissions: ['view_audit_logs', 'export_data'],
        isSystem: true,
        createdAt: null,
      },
      {
        id: 'pha',
        name: 'Public Health Authority',
        description: 'Read-only oversight of analytics, dashboards, and national reports',
        permissions: ['view_analytics', 'export_data'],
        isSystem: true,
        createdAt: null,
      },
      {
        id: 'parent',
        name: 'Parent / Guardian',
        description: 'Views child vaccination records, certificates, and appointments',
        permissions: [],
        isSystem: true,
        createdAt: null,
      },
    ];
  }

  /**
   * Custom role creation is not supported — roles are enum-based in the schema.
   */
  async createRole(_roleData: { name: string; description: string; permissions: string[] }, _user: any) {
    throw new BadRequestException(
      'Custom roles are not supported. This system uses predefined system roles.',
    );
  }

  /**
   * System roles cannot be modified.
   */
  async updateRole(_id: string, _roleData: { name?: string; description?: string; permissions?: string[] }, _user: any) {
    throw new BadRequestException(
      'System roles cannot be modified.',
    );
  }

  /**
   * System roles cannot be deleted.
   */
  async deleteRole(_id: string, _user: any) {
    throw new BadRequestException(
      'System roles cannot be deleted.',
    );
  }

  /**
   * Get list of all available permissions
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
      { id: 'p10', permission: 'manage_roles', category: 'system', description: 'View role catalog' },
    ];
  }
}
