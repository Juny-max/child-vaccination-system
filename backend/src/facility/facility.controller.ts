import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FacilityService } from './facility.service';
import { SearchChildDto, AdministerVaccineDto, RecordGrowthMeasurementDto, RecordSessionNoteDto, UpdateGuardianDto, RegisterGuardianDto } from './dto';

@Controller('facility')
@UseGuards(AuthGuard('jwt'))
export class FacilityController {
  constructor(private readonly facilityService: FacilityService) {}

  /**
   * GET /api/facility/search
   * Search for children by name, CVCC ID, or guardian phone
   */
  @Get('search')
  async searchChildren(@Query('query') query: string, @Request() req: any) {
    if (!query || query.trim().length === 0) {
      return [];
    }
    return this.facilityService.searchChildren(query);
  }

  /**
   * GET /api/facility/children/:childId
   * Get detailed child profile
   */
  @Get('children/:childId')
  async getChildProfile(@Param('childId') childId: string) {
    return this.facilityService.getChildProfile(childId);
  }

  /**
   * GET /api/facility/children/:childId/vaccinations
   * Get vaccination history for a child
   */
  @Get('children/:childId/vaccinations')
  async getVaccinationHistory(@Param('childId') childId: string) {
    return this.facilityService.getVaccinationHistory(childId);
  }

  /**
   * GET /api/facility/children/:childId/scheduled
   * Get scheduled/upcoming vaccinations for a child
   */
  @Get('children/:childId/scheduled')
  async getScheduledVaccinations(
    @Param('childId') childId: string,
    @Query('dateOfBirth') dateOfBirth: string,
  ) {
    return this.facilityService.getScheduledVaccinations(
      childId,
      dateOfBirth,
    );
  }

  /**
   * POST /api/facility/children/:childId/vaccinations
   * Record a vaccination event (administer vaccine)
   */
  @Post('children/:childId/vaccinations')
  async administerVaccine(
    @Param('childId') childId: string,
    @Body() dto: AdministerVaccineDto,
    @Request() req: any,
  ) {
    return this.facilityService.administerVaccine(childId, dto, req.user.id);
  }

  /**
   * POST /api/facility/children/:childId/measurements
   * Record a growth monitoring measurement
   */
  @Post('children/:childId/measurements')
  async recordGrowthMeasurement(
    @Param('childId') childId: string,
    @Body() dto: RecordGrowthMeasurementDto,
    @Request() req: any,
  ) {
    return this.facilityService.recordGrowthMeasurement(
      childId,
      dto,
      req.user.id,
    );
  }

  /**
   * GET /api/facility/children/:childId/measurements
   * Get growth monitoring history for a child
   */
  @Get('children/:childId/measurements')
  async getGrowthMonitoringHistory(@Param('childId') childId: string) {
    return this.facilityService.getGrowthMonitoringHistory(childId);
  }

  /**
   * POST /api/facility/children/:childId/session-notes
   * Record a clinic session note
   */
  @Post('children/:childId/session-notes')
  async recordSessionNote(
    @Param('childId') childId: string,
    @Body() dto: RecordSessionNoteDto,
    @Request() req: any,
  ) {
    return this.facilityService.recordSessionNote(childId, dto, req.user.id);
  }

  /**
   * GET /api/facility/children/:childId/session-notes
   * Get clinic session notes for a child
   */
  @Get('children/:childId/session-notes')
  async getSessionNotes(@Param('childId') childId: string) {
    return this.facilityService.getSessionNotes(childId);
  }

  /**
   * GET /api/facility/children/:childId/guardian
   * Get guardian details for a child
   */
  @Get('children/:childId/guardian')
  async getGuardian(@Param('childId') childId: string) {
    return this.facilityService.getGuardianByChildId(childId);
  }

  /**
   * PUT /api/facility/guardians/:guardianId
   * Update guardian details
   */
  @Put('guardians/:guardianId')
  async updateGuardian(
    @Param('guardianId') guardianId: string,
    @Body() dto: UpdateGuardianDto,
  ) {
    return this.facilityService.updateGuardian(guardianId, dto);
  }

  /**
   * GET /api/facility/appointments/today
   * Get today's appointments for the facility
   */
  @Get('appointments/today')
  async getTodaysAppointments(@Query('facilityId') facilityId?: string) {
    return this.facilityService.getTodaysAppointments(facilityId);
  }

  /**
   * GET /api/facility/follow-ups/urgent
   * Get urgent follow-ups (children with overdue vaccinations)
   */
  @Get('follow-ups/urgent')
  async getUrgentFollowUps(@Query('facilityId') facilityId?: string) {
    return this.facilityService.getUrgentFollowUps(facilityId);
  }

  /**
   * POST /api/facility/guardians
   * Register a new guardian (mother/caregiver)
   */
  @Post('guardians')
  async registerGuardian(@Body() dto: RegisterGuardianDto) {
    return this.facilityService.registerGuardian(dto);
  }
}
