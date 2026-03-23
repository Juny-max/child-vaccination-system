import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ChwService } from './chw.service';
import { AdvancedSearchDto, QuickSearchDto } from './dto/search.dto';

@Controller('children')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('chw')
export class ChildrenSearchController {
  constructor(private readonly chwService: ChwService) {}

  /**
   * GET /api/children/search?identifier=...
   * Primary fast search by exact child UUID OR exact mother phone number
   */
  @Get('search')
  async quickSearch(@Query() query: QuickSearchDto, @Request() req: any) {
    return this.chwService.searchByIdentifier(query.identifier, req.user.id);
  }

  /**
   * GET /api/children/advanced-search?childName=...&motherName=...&dob=...
   * Emergency fallback search when quick search fails.
   */
  @Get('advanced-search')
  async advancedSearch(@Query() query: AdvancedSearchDto, @Request() req: any) {
    return this.chwService.advancedSearch(
      query.childName,
      query.motherName,
      query.dob,
      req.user.id,
    );
  }
}