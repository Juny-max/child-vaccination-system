import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ParentService } from './parent.service';
import {
  UpdateMotherDetailsDto,
  RequestEmailChangeDto,
  VerifyEmailChangeDto,
  CreateAppointmentDto,
  CancelAppointmentDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Request as ExpressRequest } from 'express';

/**
 * Parent Portal Controller
 *
 * All endpoints require authentication and 'parent' role.
 * The authenticated user's ID is used to fetch their guardian profile
 * and their children's data.
 *
 * Base path: /api/parent
 */
@Controller('parent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('parent')
export class ParentController {
  constructor(private readonly parentService: ParentService) {}

  // =========================================================================
  // DASHBOARD
  // =========================================================================

  /**
   * GET /api/parent/dashboard
   * Get parent dashboard summary with children, appointments, and notifications
   */
  @Get('dashboard')
  async getDashboard(@Request() req: any) {
    return this.parentService.getDashboard(req.user.id);
  }

  // =========================================================================
  // MOTHER/GUARDIAN PROFILE
  // =========================================================================

  /**
   * GET /api/parent/profile
   * Get the authenticated parent's (mother's) profile
   */
  @Get('profile')
  async getProfile(@Request() req: any) {
    return this.parentService.getGuardianProfile(req.user.id);
  }

  /**
   * PUT /api/parent/profile
   * Update parent profile (contact info, address, etc.)
   */
  @Put('profile')
  async updateProfile(
    @Request() req: any,
    @Body() updates: UpdateMotherDetailsDto,
  ) {
    return this.parentService.updateGuardianProfile(req.user.id, updates);
  }

  /**
   * POST /api/parent/profile/email-change/request
   * Send verification link to a new email before applying the change
   */
  @Post('profile/email-change/request')
  @HttpCode(HttpStatus.OK)
  async requestEmailChange(
    @Request() req: any & ExpressRequest,
    @Body() requestDto: RequestEmailChangeDto,
  ) {
    const baseUrl =
      (req.headers.origin as string) ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000';
    return this.parentService.requestGuardianEmailChange(
      req.user.id,
      requestDto,
      baseUrl,
    );
  }

  /**
   * POST /api/parent/profile/email-change/verify
   * Verify email change token and persist the new email
   */
  @Post('profile/email-change/verify')
  @Public()
  @Roles()
  @HttpCode(HttpStatus.OK)
  async verifyEmailChange(@Body() verifyDto: VerifyEmailChangeDto) {
    return this.parentService.verifyGuardianEmailChangeByToken(verifyDto);
  }

  // =========================================================================
  // CHILDREN
  // =========================================================================

  /**
   * GET /api/parent/children
   * Get all children for the authenticated parent
   */
  @Get('children')
  async getChildren(@Request() req: any) {
    return this.parentService.getChildren(req.user.id);
  }

  /**
   * GET /api/parent/children/:childId
   * Get details of a specific child
   */
  @Get('children/:childId')
  async getChildDetails(
    @Request() req: any,
    @Param('childId') childId: string,
  ) {
    return this.parentService.getChildDetails(req.user.id, childId);
  }

  // =========================================================================
  // VACCINATIONS
  // =========================================================================

  /**
   * GET /api/parent/children/:childId/vaccinations
   * Get vaccination history for a child
   */
  @Get('children/:childId/vaccinations')
  async getVaccinationHistory(
    @Request() req: any,
    @Param('childId') childId: string,
  ) {
    return this.parentService.getVaccinationHistory(req.user.id, childId);
  }

  /**
   * GET /api/parent/children/:childId/vaccinations/upcoming
   * Get upcoming vaccinations for a child
   */
  @Get('children/:childId/vaccinations/upcoming')
  async getUpcomingVaccinations(
    @Request() req: any,
    @Param('childId') childId: string,
  ) {
    return this.parentService.getUpcomingVaccinations(req.user.id, childId);
  }

  /**
   * GET /api/parent/missed-vaccinations
   * Get all missed vaccinations across all children
   */
  @Get('missed-vaccinations')
  async getMissedVaccinations(@Request() req: any) {
    return this.parentService.getMissedVaccinations(req.user.id);
  }

  // =========================================================================
  // CERTIFICATES
  // =========================================================================

  /**
   * GET /api/parent/certificates
   * Get all certificates for all children
   */
  @Get('certificates')
  async getAllCertificates(@Request() req: any) {
    return this.parentService.getAllCertificates(req.user.id);
  }

  /**
   * GET /api/parent/children/:childId/certificates
   * Get certificates for a specific child
   */
  @Get('children/:childId/certificates')
  async getCertificates(
    @Request() req: any,
    @Param('childId') childId: string,
  ) {
    return this.parentService.getCertificates(req.user.id, childId);
  }

  // =========================================================================
  // APPOINTMENTS
  // =========================================================================

  /**
   * GET /api/parent/appointments
   * Get all appointments for the parent's children
   */
  @Get('appointments')
  async getAppointments(@Request() req: any) {
    return this.parentService.getAppointments(req.user.id);
  }

  /**
   * POST /api/parent/appointments
   * Request a new appointment
   */
  @Post('appointments')
  @HttpCode(HttpStatus.CREATED)
  async createAppointment(
    @Request() req: any,
    @Body() createDto: CreateAppointmentDto,
  ) {
    return this.parentService.createAppointment(req.user.id, createDto);
  }

  /**
   * DELETE /api/parent/appointments/:appointmentId
   * Cancel an appointment
   */
  @Delete('appointments/:appointmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelAppointment(
    @Request() req: any,
    @Param('appointmentId') appointmentId: string,
    @Body() cancelDto: CancelAppointmentDto,
  ) {
    await this.parentService.cancelAppointment(
      req.user.id,
      appointmentId,
      cancelDto.reason,
    );
  }

  // =========================================================================
  // NOTIFICATIONS
  // =========================================================================

  /**
   * GET /api/parent/notifications
   * Get notifications for the parent
   */
  @Get('notifications')
  async getNotifications(@Request() req: any) {
    return this.parentService.getNotifications(req.user.id);
  }
}
