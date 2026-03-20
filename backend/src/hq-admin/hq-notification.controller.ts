import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HqNotificationService } from './hq-notification.service';

/**
 * HQ Admin Notification Controller
 * Endpoints for notification delivery tracking
 */
@Controller('hq-admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('hq-admin')
export class HqNotificationController {
  constructor(private readonly notificationService: HqNotificationService) {}

  /**
   * GET /hq-admin/notifications/delivery-status
   * Get notification delivery tracking records
   */
  @Get('delivery-status')
  async getDeliveryStatus(
    @Query('status') status?: 'sent' | 'failed' | 'pending',
    @Query('limit') limit: number = 50,
  ) {
    return this.notificationService.getDeliveryStatus(status, limit);
  }

  /**
   * POST /hq-admin/notifications/:id/retry
   * Retry a failed notification
   */
  @Post(':id/retry')
  async retryNotification(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationService.retryNotification(id, user);
  }

  /**
   * GET /hq-admin/notifications/stats
   * Get notification delivery statistics
   */
  @Get('stats')
  async getNotificationStats() {
    return this.notificationService.getNotificationStats();
  }
}
