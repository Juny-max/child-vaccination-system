import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  Put,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ChwService } from './chw.service';
import { SyncCHWVaccinationsDto, TransferOutDto, TransferInDto, TransferPullDto } from './dto';

@Controller('chw')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('chw')
export class ChwController {
  constructor(private readonly chwService: ChwService) {}

  @Get('debug/me')
  async debugMe(@Request() req: any) {
    return {
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role,
      fullName: req.user.fullName,
    };
  }

  @Get('dashboard/summary')
  async getDashboardSummary(@Request() req: any) {
    return this.chwService.getDashboardSummary(req.user.id);
  }

  @Get('children/search')
  async searchChildren(@Query('query') query: string, @Request() req: any) {
    return this.chwService.searchChildren(query, req.user.id);
  }

  /**
   * GET /api/chw/children/search-all
   * Search all children without catchment restriction (for online mode)
   * Used when CHW is online and can help children from any area
   */
  @Get('children/search-all')
  async searchAllChildren(@Query('query') query: string, @Request() req: any) {
    return this.chwService.searchAllChildren(query, req.user.id);
  }

  /**
   * GET /api/chw/mothers/search
   * Search existing mothers/guardians by name or phone
   */
  @Get('mothers/search')
  async searchMothers(@Query('query') query: string) {
    return this.chwService.searchMothers(query);
  }

  @Get('children/:childId/chart')
  async getChildChart(@Param('childId') childId: string, @Request() req: any) {
    return this.chwService.getChildChart(childId, req.user.id);
  }

  /**
   * GET /api/chw/children/:childId/chart-all
   * Get child chart without catchment restriction (for online mode)
   * Used when CHW is online and can help children from any area
   */
  @Get('children/:childId/chart-all')
  async getChildChartAll(@Param('childId') childId: string, @Request() req: any) {
    return this.chwService.getChildChartAll(childId, req.user.id);
  }

  /**
   * GET /api/chw/catchment/:catchmentAreaId/children
   * Prefetch all children in the CHW's assigned catchment area for offline use.
   */
  @Get('catchment/:catchmentAreaId/children')
  async getChildrenByCatchmentArea(
    @Param('catchmentAreaId') catchmentAreaId: string,
    @Request() req: any,
  ) {
    return this.chwService.getChildrenByAssignedCatchmentArea(
      catchmentAreaId,
      req.user.id,
    );
  }

  @Post('offline-registrations')
  async queueOfflineRegistration(@Body() payload: any, @Request() req: any) {
    return this.chwService.queueOfflineRegistration(req.user.id, payload);
  }

  /**
   * POST /api/chw/vaccinations/sync
   * Sync offline CHW vaccinations to the database
   * Accepts batch vaccinations recorded in the field with GPS coordinates
   */
  @Post('vaccinations/sync')
  async syncOfflineVaccinations(
    @Body() dto: SyncCHWVaccinationsDto,
    @Request() req: any,
  ) {
    return this.chwService.syncOfflineVaccinations(dto, req.user.id);
  }

  /**
   * GET /api/chw/register
   * Get CHW's local register (all children in their assigned catchment area)
   * Uses child's direct catchment_area_id for accurate tracking
   */
  @Get('register')
  async getLocalRegister(@Request() req: any) {
    return this.chwService.getLocalRegister(req.user.id);
  }

  /**
   * POST /api/chw/children/:childId/transfer-out
   * Transfer Out: Remove child from CHW's catchment area
   * Used when mother/child leaves the area
   */
  @Post('children/:childId/transfer-out')
  async transferOut(
    @Param('childId') childId: string,
    @Body() dto: TransferOutDto,
    @Request() req: any,
  ) {
    return this.chwService.transferOut(childId, req.user.id, dto.reason);
  }

  /**
   * POST /api/chw/children/:childId/transfer-in
   * Transfer In: Add child to CHW's catchment area
   * Used when CHW finds a child via global search and wants to add to local register
   */
  @Post('children/:childId/transfer-in')
  async transferIn(
    @Param('childId') childId: string,
    @Body() dto: TransferInDto,
    @Request() req: any,
  ) {
    return this.chwService.transferIn(childId, req.user.id, dto.notes);
  }

  /**
   * POST /api/chw/children/:childId/transfer-pull
   * Transfer Pull (Pull Mechanism): Forcefully pull a child from another catchment area
   *
   * This endpoint allows a CHW to "pull" a child's record from another CHW's
   * catchment area, even if the old CHW hasn't manually transferred them out.
   *
   * Creates dual audit logs:
   * - transfer_out for the OLD catchment/branch (+1 Transfer Out)
   * - transfer_in for the NEW catchment/branch (+1 Transfer In)
   *
   * Use case: Mother moves to a new area but old CHW hasn't released the child.
   * New CHW can forcefully pull the child to their register.
   */
  @Post('children/:childId/transfer-pull')
  async transferPull(
    @Param('childId') childId: string,
    @Body() dto: TransferPullDto,
    @Request() req: any,
  ) {
    return this.chwService.transferPull(childId, req.user.id, dto.notes);
  }
}
