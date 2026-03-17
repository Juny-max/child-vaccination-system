import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BranchManagerService } from './branch-manager.service';
import {
  CreateHqCatchmentAreaDto,
  UpdateHqCatchmentAreaDto,
} from './hq-catchment-areas.dto';

@Controller('hq-admin/catchment-areas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('hq-admin')
export class HqCatchmentAreasController {
  constructor(private readonly branchManagerService: BranchManagerService) {}

  @Get()
  async listCatchmentAreas() {
    return this.branchManagerService.getHqCatchmentAreas();
  }

  @Post()
  async createCatchmentArea(@Body() dto: CreateHqCatchmentAreaDto) {
    return this.branchManagerService.createHqCatchmentArea(dto);
  }

  @Patch(':catchmentId')
  async updateCatchmentArea(
    @Param('catchmentId') catchmentId: string,
    @Body() dto: UpdateHqCatchmentAreaDto,
  ) {
    return this.branchManagerService.updateHqCatchmentArea(catchmentId, dto);
  }

  @Delete(':catchmentId')
  async deleteCatchmentArea(@Param('catchmentId') catchmentId: string) {
    return this.branchManagerService.deleteHqCatchmentArea(catchmentId);
  }
}
