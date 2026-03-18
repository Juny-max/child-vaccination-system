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
  CreateHqBranchDto,
  UpdateHqBranchChwsDto,
  UpdateHqBranchDto,
  UpdateHqBranchStatusDto,
} from './hq-branches.dto';

@Controller('hq-admin/branches')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('hq-admin')
export class HqBranchesController {
  constructor(private readonly branchManagerService: BranchManagerService) {}

  @Get()
  async listBranches() {
    return this.branchManagerService.getHqBranches();
  }

  @Post()
  async createBranch(@Body() dto: CreateHqBranchDto) {
    return this.branchManagerService.createHqBranch(dto);
  }

  @Patch(':code')
  async updateBranch(
    @Param('code') code: string,
    @Body() dto: UpdateHqBranchDto,
  ) {
    return this.branchManagerService.updateHqBranch(code, dto);
  }

  @Patch(':code/status')
  async updateStatus(
    @Param('code') code: string,
    @Body() dto: UpdateHqBranchStatusDto,
  ) {
    return this.branchManagerService.updateHqBranchStatus(code, dto.status);
  }

  @Patch(':code/chws')
  async updateChws(
    @Param('code') code: string,
    @Body() dto: UpdateHqBranchChwsDto,
  ) {
    return this.branchManagerService.updateHqBranchChws(code, dto.assignedChws);
  }

  @Delete(':code')
  async deleteBranch(@Param('code') code: string) {
    return this.branchManagerService.deleteHqBranch(code);
  }
}
