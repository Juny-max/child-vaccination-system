import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FacilityService } from './facility.service';
import { SearchChildDto } from './dto';

@Controller('facility')
@UseGuards(JwtAuthGuard)
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
}
