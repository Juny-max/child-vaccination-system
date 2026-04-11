import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PhaService } from './pha.service';

/**
 * PHA (Public Health Authority) Controller
 *
 * Security:
 *  - JwtAuthGuard: every request must carry a valid, non-expired JWT
 *  - RolesGuard + @Roles('pha'): only users whose JWT role === 'pha' may call these endpoints
 *  - All responses contain only aggregated statistics — no PII, no individual records
 */
@Controller('pha')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('pha')
export class PhaController {
  constructor(private readonly phaService: PhaService) {}

  /**
   * GET /api/pha/dashboard
   *
   * Returns all data needed for the national PHA dashboard in a single request:
   *   - KPIs (children registered, doses, Penta3 coverage, dropout rate, zero-dose children)
   *   - AEFI summary (total, mild, moderate, severe)
   *   - Monthly coverage trend (default 12 months, configurable)
   *   - Regional coverage breakdown
   *
   * Query params:
   *   - months (optional, default 12): number of past months for the trend chart
   */
  @Get('dashboard')
  async getDashboard(
    @Query('months', new DefaultValuePipe(12), ParseIntPipe) months: number,
  ) {
    // Clamp to a safe range to prevent abuse (1 month – 24 months)
    const safeMonths = Math.min(Math.max(months, 1), 24);
    return this.phaService.getDashboardData(safeMonths);
  }

  /**
   * GET /api/pha/reports
   *
   * Returns tabular report data for the selected report type and filters.
   * Suitable for both live preview and CSV/PDF export on the frontend.
   *
   * Query params:
   *   - type   : report identifier (whitelisted against 8 allowed values)
   *   - region : 'All Regions' or a specific Ghana region name
   *   - from   : start date YYYY-MM-DD
   *   - to     : end date   YYYY-MM-DD
   *
   * Security: type/region/dates are fully validated before use.
   */
  @Get('reports')
  async getReports(
    @Query('type') type: string,
    @Query('region') region: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    // Whitelist allowed report types — reject anything unexpected
    const allowedTypes = new Set([
      'national-coverage',
      'regional-coverage',
      'dropout-analysis',
      'vaccine-stock',
      'aefi-surveillance',
      'facility-performance',
      'who-monthly',
      'certificate-issuance',
    ]);
    const safeType =
      typeof type === 'string' && allowedTypes.has(type)
        ? type
        : 'national-coverage';

    // Sanitise region (max 100 chars, default to All Regions)
    const safeRegion =
      typeof region === 'string' && region.length > 0
        ? region.slice(0, 100)
        : 'All Regions';

    // Validate date strings — YYYY-MM-DD only
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const now = new Date().toISOString().slice(0, 10);
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const safeFrom = typeof from === 'string' && dateRe.test(from) ? from : yearAgo;
    const safeTo   = typeof to   === 'string' && dateRe.test(to)   ? to   : now;

    return this.phaService.getReportData(safeType, safeRegion, safeFrom, safeTo);
  }

  /**
   * GET /api/pha/certificates/verify?id=CERT-GH-2025-001234
   *
   * Verifies a certificate by its ID.
    * Returns validity metadata and limited identity details for cross-checking:
    * child name and mother/guardian name, plus issued date, completion status,
    * vaccine names, issuing facility, and region.
   */
  @Get('certificates/verify')
  async verifyCertificate(@Query('id') id: string) {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new BadRequestException('Certificate ID is required');
    }
    // Sanitise: max 100 chars, alphanumeric + dashes only
    const safeId = id.trim().slice(0, 100).replace(/[^A-Za-z0-9\-]/g, '');
    return this.phaService.verifyCertificate(safeId);
  }
}
