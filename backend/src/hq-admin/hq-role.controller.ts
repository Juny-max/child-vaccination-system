import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HqRoleService } from './hq-role.service';

/**
 * HQ Admin Roles Controller
 * Endpoints for custom role and permission management
 */
@Controller('hq-admin/roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('hq-admin')
export class HqRoleController {
  constructor(private readonly roleService: HqRoleService) {}

  /**
   * GET /hq-admin/roles
   * Get all custom roles
   */
  @Get()
  async getRoles() {
    return this.roleService.getRoles();
  }

  /**
   * POST /hq-admin/roles
   * Create a new custom role
   */
  @Post()
  async createRole(
    @Body() roleData: { name: string; description: string; permissions: string[] },
    @CurrentUser() user: any,
  ) {
    return this.roleService.createRole(roleData, user);
  }

  /**
   * PUT /hq-admin/roles/:id
   * Update an existing role
   */
  @Put(':id')
  async updateRole(
    @Param('id') id: string,
    @Body() roleData: { name?: string; description?: string; permissions?: string[] },
    @CurrentUser() user: any,
  ) {
    return this.roleService.updateRole(id, roleData, user);
  }

  /**
   * DELETE /hq-admin/roles/:id
   * Delete a custom role
   */
  @Delete(':id')
  async deleteRole(@Param('id') id: string, @CurrentUser() user: any) {
    return this.roleService.deleteRole(id, user);
  }

  /**
   * GET /hq-admin/roles/permissions
   * Get list of all available permissions
   */
  @Get('permissions')
  async getAvailablePermissions() {
    return this.roleService.getAvailablePermissions();
  }
}
