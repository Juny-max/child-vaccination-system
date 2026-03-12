import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BranchManagerService } from './branch-manager.service';
import { LogStockDto } from './log-stock.dto';

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
}
