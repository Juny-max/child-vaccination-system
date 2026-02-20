import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ChwService } from './chw.service';

@Controller('chw')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('chw')
export class ChwController {
  constructor(private readonly chwService: ChwService) {}

  @Get('dashboard/summary')
  async getDashboardSummary(@Request() req: any) {
    return this.chwService.getDashboardSummary(req.user.id);
  }

  @Get('children/search')
  async searchChildren(@Query('query') query: string, @Request() req: any) {
    return this.chwService.searchChildren(query, req.user.id);
  }

  @Get('children/:childId/chart')
  async getChildChart(@Param('childId') childId: string, @Request() req: any) {
    return this.chwService.getChildChart(childId, req.user.id);
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
}
