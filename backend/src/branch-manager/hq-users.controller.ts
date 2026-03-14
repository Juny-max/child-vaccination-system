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
import {
  CreateHqUserDto,
  ResetHqUserPasswordDto,
  UpdateHqUserDto,
  UpdateHqUserStatusDto,
} from './hq-users.dto';

@Controller('hq-admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('hq-admin')
export class HqUsersController {
  constructor(private readonly branchManagerService: BranchManagerService) {}

  @Get()
  async listUsers() {
    return this.branchManagerService.getHqUsers();
  }

  @Post()
  async createUser(@Body() dto: CreateHqUserDto) {
    return this.branchManagerService.createHqUser(dto);
  }

  @Patch(':userId')
  async updateUser(@Param('userId') userId: string, @Body() dto: UpdateHqUserDto) {
    return this.branchManagerService.updateHqUser(userId, dto);
  }

  @Patch(':userId/status')
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body() dto: UpdateHqUserStatusDto,
  ) {
    return this.branchManagerService.updateHqUserStatus(userId, dto.status);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetHqUserPasswordDto) {
    return this.branchManagerService.resetHqUserPassword(dto.email);
  }
}
