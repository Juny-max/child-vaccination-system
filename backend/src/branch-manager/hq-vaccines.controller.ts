import {
  Body,
  Controller,
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
import { CreateHqVaccineDto, UpdateHqVaccineDto } from './hq-vaccines.dto';

@Controller('hq-admin/vaccines')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('hq-admin')
export class HqVaccinesController {
  constructor(private readonly branchManagerService: BranchManagerService) {}

  @Get()
  async listVaccines() {
    return this.branchManagerService.getHqVaccines();
  }

  @Post()
  async createVaccine(@Body() dto: CreateHqVaccineDto) {
    return this.branchManagerService.createHqVaccine(dto);
  }

  @Patch(':vaccineId')
  async updateVaccine(
    @Param('vaccineId') vaccineId: string,
    @Body() dto: UpdateHqVaccineDto,
  ) {
    return this.branchManagerService.updateHqVaccine(vaccineId, dto);
  }
}
