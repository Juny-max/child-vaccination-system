import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

/**
 * Lightweight health-check endpoint used by the CHW PWA
 * connectivity probe. Validates that Supabase is reachable.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async check() {
    try {
      // Quick lightweight query to verify Supabase connectivity
      const { error } = await this.db.supabase
        .from('users')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (error && error.message?.includes('fetch')) {
        throw new ServiceUnavailableException('Database unreachable');
      }

      return { status: 'ok', database: 'connected' };
    } catch (err: any) {
      // Return 503 when Supabase is down so frontend knows to go offline
      if (err.message?.includes('fetch') || err.code === 'ECONNREFUSED') {
        throw new ServiceUnavailableException('Database unreachable');
      }
      return { status: 'ok', database: 'connected' };
    }
  }
}
