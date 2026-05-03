import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BranchManagerService } from './branch-manager.service';
import {
  AssignBranchCatchmentAreaDto,
  CreateBranchCatchmentAreaDto,
  UpdateBranchCatchmentAreaDto,
} from './catchment-areas.dto';
import { AssignChildFollowUpDto } from './child-management.dto';
import { LogStockDto, ResetExpiringStockDto } from './log-stock.dto';
import { RegisterStaffDto } from './register-staff.dto';
import { UpdateStaffDto, UpdateStaffStatusDto } from './update-staff.dto';

/**
 * Branch Manager Controller
 *
 * Security:
 *  - JwtAuthGuard: every request must carry a valid, non-expired JWT
 *  - RolesGuard + @Roles('branch-manager'): only branch managers may call these endpoints
 *  - All queries are scoped to the manager's own branchId from the JWT — no cross-branch access
 */
@Controller('branch-manager')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('branch-manager')
export class BranchManagerController {
  constructor(private readonly branchManagerService: BranchManagerService) {}

  /**
   * GET /api/branch-manager/dashboard
   *
   * Returns all data needed for the Branch Manager dashboard in a single request:
   *   - Branch metadata (name, region)
   *   - KPIs (children registered, vaccinations today, active CHWs, pending syncs)
   *   - Branch coverage rate + 7-day trend
   *   - Vaccine stock alerts
   *   - Overdue vaccinations, AEFI events, sync errors, notification failures
   *   - Staff roster + CHW productivity
   *   - Catchment coverage heatmap
   *   - Dropout analysis (Dose 1 vs Dose 3)
   */
  @Get('dashboard')
  async getDashboard(@CurrentUser() user: any) {
    const branchId = user.branchId;
    if (!branchId) {
      throw new ForbiddenException(
        'Your account is not assigned to a branch. Contact your HQ admin.',
      );
    }
    return this.branchManagerService.getDashboardData(branchId);
  }

  /**
   * GET /api/branch-manager/children/search?query=...
   * Search branch child records by name, phone, CVCC ID, or QR token.
   */
  @Get('children/search')
  async searchBranchChildren(
    @CurrentUser() user: any,
    @Query('query') query?: string,
  ) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Your account is not assigned to a branch. Contact your HQ admin.',
      );
    }

    return this.branchManagerService.searchBranchChildren(
      user.branchId,
      query ?? '',
    );
  }

  /**
   * GET /api/branch-manager/children/queues
   * Return action-first child management queues for branch managers.
   */
  @Get('children/queues')
  async getChildManagementQueues(@CurrentUser() user: any) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Your account is not assigned to a branch. Contact your HQ admin.',
      );
    }

    return this.branchManagerService.getChildManagementQueues(user.branchId);
  }

  /**
   * POST /api/branch-manager/children/follow-ups/assign
   * Assign a branch child follow-up to an active nurse/CHW in this branch.
   */
  @Post('children/follow-ups/assign')
  async assignChildFollowUp(
    @CurrentUser() user: any,
    @Body() dto: AssignChildFollowUpDto,
  ) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Your account is not assigned to a branch. Contact your HQ admin.',
      );
    }

    return this.branchManagerService.assignChildFollowUp(
      user.branchId,
      user.id,
      dto,
    );
  }

  /**
   * GET /api/branch-manager/vaccines
   * Returns the list of active vaccines for the stock delivery form dropdown.
   */
  @Get('vaccines')
  async getVaccines(@CurrentUser() user: any) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Your account is not assigned to a branch. Contact your HQ admin.',
      );
    }
    return this.branchManagerService.getVaccines();
  }

  /**
   * POST /api/branch-manager/stock
   * Logs a new vaccine shipment delivered to this branch.
   * The new row is inserted into stock_inventory with quantity_used = 0.
   */
  @Post('stock')
  async logStockDelivery(
    @CurrentUser() user: any,
    @Body() dto: LogStockDto,
  ) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Your account is not assigned to a branch. Contact your HQ admin.',
      );
    }
    return this.branchManagerService.logStockDelivery(
      user.branchId,
      user.id,
      dto,
    );
  }

  /**
   * POST /api/branch-manager/stock/reset-expiring
   * Clears quantity_remaining for expiring/expired stock so replacement stock starts fresh.
   */
  @Post('stock/reset-expiring')
  async resetExpiringStock(
    @CurrentUser() user: any,
    @Body() dto: ResetExpiringStockDto,
  ) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Your account is not assigned to a branch. Contact your HQ admin.',
      );
    }
    return this.branchManagerService.resetExpiringStock(
      user.branchId,
      dto,
    );
  }

  /**
   * POST /api/branch-manager/staff
   * Register a new staff member (nurse or CHW) at this branch.
    * Returns email delivery status and a one-time temporary password only if delivery fails.
   */
  @Post('staff')
  async registerStaff(
    @CurrentUser() user: any,
    @Body() dto: RegisterStaffDto,
  ) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Your account is not assigned to a branch. Contact your HQ admin.',
      );
    }
    return this.branchManagerService.registerStaff(user.branchId, dto);
  }

  /**
   * GET /api/branch-manager/staff
   * Get list of staff at this branch with optional filters.
   * Query params: role, status, search
   */
  @Get('staff')
  async getStaffList(
    @CurrentUser() user: any,
    @Query('role') role?: 'facility-nurse' | 'chw',
    @Query('status') status?: 'active' | 'suspended' | 'inactive',
    @Query('search') search?: string,
  ) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Your account is not assigned to a branch. Contact your HQ admin.',
      );
    }
    return this.branchManagerService.getStaffList(user.branchId, {
      role,
      status,
      search,
    });
  }

  /**
   * PATCH /api/branch-manager/staff/:id
   * Update staff details (partial update).
   */
  @Patch('staff/:id')
  async updateStaff(
    @CurrentUser() user: any,
    @Param('id') staffId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Your account is not assigned to a branch. Contact your HQ admin.',
      );
    }
    return this.branchManagerService.updateStaff(staffId, user.branchId, dto);
  }

  /**
   * PATCH /api/branch-manager/staff/:id/status
   * Update staff status (active, suspended, inactive).
   */
  @Patch('staff/:id/status')
  async updateStaffStatus(
    @CurrentUser() user: any,
    @Param('id') staffId: string,
    @Body() dto: UpdateStaffStatusDto,
  ) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Your account is not assigned to a branch. Contact your HQ admin.',
      );
    }
    return this.branchManagerService.updateStaffStatus(
      staffId,
      user.branchId,
      dto.status,
    );
  }

  /**
   * POST /api/branch-manager/catchment-areas
   * Save a new drawn catchment polygon for this manager's branch.
   */
  @Post('catchment-areas')
  async createCatchmentArea(
    @CurrentUser() user: any,
    @Body() dto: CreateBranchCatchmentAreaDto,
  ) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Your account is not assigned to a branch. Contact your HQ admin.',
      );
    }

    return this.branchManagerService.createBranchCatchmentArea(user.branchId, dto);
  }

  /**
   * GET /api/branch-manager/catchment-areas?branchId=...
   * Fetch all catchment zones for this manager's branch map.
   */
  @Get('catchment-areas')
  async getCatchmentAreas(
    @CurrentUser() user: any,
    @Query('branchId') branchId?: string,
  ) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Your account is not assigned to a branch. Contact your HQ admin.',
      );
    }

    if (branchId && branchId !== user.branchId) {
      throw new ForbiddenException('You can only access catchment areas for your own branch.');
    }

    return this.branchManagerService.getBranchCatchmentAreas(user.branchId);
  }

  /**
   * PATCH /api/branch-manager/catchment-areas/:id
   * Update catchment zone metadata and/or boundaries.
   */
  @Patch('catchment-areas/:id')
  async updateCatchmentArea(
    @CurrentUser() user: any,
    @Param('id', new ParseUUIDPipe()) catchmentAreaId: string,
    @Body() dto: UpdateBranchCatchmentAreaDto,
  ) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Your account is not assigned to a branch. Contact your HQ admin.',
      );
    }

    return this.branchManagerService.updateBranchCatchmentArea(
      user.branchId,
      catchmentAreaId,
      dto,
    );
  }

  /**
   * DELETE /api/branch-manager/catchment-areas/:id
   * Delete a catchment zone from this manager's branch.
   */
  @Delete('catchment-areas/:id')
  async deleteCatchmentArea(
    @CurrentUser() user: any,
    @Param('id', new ParseUUIDPipe()) catchmentAreaId: string,
  ) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Your account is not assigned to a branch. Contact your HQ admin.',
      );
    }

    return this.branchManagerService.deleteBranchCatchmentArea(
      user.branchId,
      catchmentAreaId,
    );
  }

  /**
   * PATCH /api/branch-manager/aefi/:id/review
   * Mark an AEFI report as under-review when the branch manager opens it.
   */
  @Patch('aefi/:id/review')
  async markAefiReviewed(
    @CurrentUser() user: any,
    @Param('id', new ParseUUIDPipe()) aefiId: string,
  ) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Your account is not assigned to a branch. Contact your HQ admin.',
      );
    }
    return this.branchManagerService.markAefiReviewed(aefiId, user.branchId);
  }

  /**
   * PATCH /api/branch-manager/catchment-areas/:id/assign
   * Assign a CHW to a catchment zone.
   */
  @Patch('catchment-areas/:id/assign')
  async assignCatchmentArea(
    @CurrentUser() user: any,
    @Param('id', new ParseUUIDPipe()) catchmentAreaId: string,
    @Body() dto: AssignBranchCatchmentAreaDto,
  ) {
    if (!user.branchId) {
      throw new ForbiddenException(
        'Your account is not assigned to a branch. Contact your HQ admin.',
      );
    }

    return this.branchManagerService.assignBranchCatchmentArea(
      user.branchId,
      catchmentAreaId,
      dto,
    );
  }
}
