import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import * as os from 'os';
import { execSync } from 'child_process';

@Injectable()
export class HqSystemService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Read real disk usage for the server root filesystem.
   * Works on Linux (Render) and macOS (dev). Returns 0 if unavailable.
   */
  private getDiskUsagePercent(): number {
    try {
      const output = execSync('df -k /', { encoding: 'utf8', timeout: 3000 });
      const lines = output.trim().split('\n');
      if (lines.length < 2) return 0;
      const parts = lines[1].trim().split(/\s+/);
      const percentStr = parts.find((p) => p.endsWith('%'));
      return percentStr ? parseInt(percentStr.replace('%', ''), 10) || 0 : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get real-time system health metrics
   */
  async getSystemMetrics() {
    try {
      const cpuUsage = (os.loadavg()[0] * 100) / os.cpus().length;
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
      const diskPercent = this.getDiskUsagePercent();

      // Count today's audit log entries (proxy for API activity)
      // and today's failed notifications (proxy for delivery errors)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStr = todayStart.toISOString();

      let requestsToday = 0;
      let errorsToday = 0;
      try {
        const [requestsResult, errorsResult] = await Promise.all([
          this.db.supabase
            .from('audit_logs')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', todayStr),
          this.db.supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'failed')
            .gte('created_at', todayStr),
        ]);
        requestsToday = requestsResult.count || 0;
        errorsToday = errorsResult.count || 0;
      } catch {
        // Non-critical — leave as 0
      }

      return [
        {
          id: 'cpu',
          name: 'CPU Usage',
          value: Math.round(cpuUsage),
          unit: '%',
          status: cpuUsage > 85 ? 'critical' : cpuUsage > 70 ? 'warning' : 'normal',
          detail: `Load average: ${os.loadavg()[0].toFixed(2)}`,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'memory',
          name: 'Memory Usage',
          value: Math.round(memoryUsage),
          unit: '%',
          status: memoryUsage > 85 ? 'critical' : memoryUsage > 70 ? 'warning' : 'normal',
          detail: `${Math.round(freeMemory / 1024 / 1024)} MB available`,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'disk',
          name: 'Disk Usage',
          value: diskPercent,
          unit: '%',
          status: diskPercent > 85 ? 'critical' : diskPercent > 70 ? 'warning' : 'normal',
          detail: 'Server root filesystem',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'uptime',
          name: 'System Uptime',
          value: ((os.uptime() / 3600) % 24).toFixed(1),
          unit: 'hours (last 24h)',
          status: 'normal',
          detail: `Total: ${Math.floor(os.uptime() / 86400)} days`,
          timestamp: new Date().toISOString(),
        },
        {
          id: 'requests',
          name: 'API Requests Today',
          value: requestsToday,
          unit: 'total',
          status: 'normal',
          detail: 'Audit log entries created today',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'errors',
          name: 'Notification Failures Today',
          value: errorsToday,
          unit: 'count',
          status: errorsToday > 50 ? 'warning' : 'normal',
          detail: 'Failed notification deliveries today',
          timestamp: new Date().toISOString(),
        },
      ];
    } catch (error) {
      console.error('Failed to get system metrics:', error);
      throw error;
    }
  }

  /**
   * Get database record counts and capacity statistics
   */
  async getDatabaseStats() {
    try {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      // Run all counts in parallel; use allSettled so one failure doesn't abort the rest
      const results = await Promise.allSettled([
        this.db.supabase.from('users').select('id', { count: 'exact', head: true }),
        this.db.supabase.from('vaccines').select('id', { count: 'exact', head: true }),
        this.db.supabase.from('branches').select('id', { count: 'exact', head: true }),
        this.db.supabase.from('children').select('id', { count: 'exact', head: true }),
        this.db.supabase.from('vaccination_events').select('id', { count: 'exact', head: true }),
        this.db.supabase.from('appointments').select('id', { count: 'exact', head: true }),
        this.db.supabase.from('notifications').select('id', { count: 'exact', head: true }),
        // Recently active users as a proxy for active DB connections
        this.db.supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .gte('last_login_at', thirtyMinsAgo),
      ]);

      const getCount = (r: PromiseSettledResult<any>) =>
        r.status === 'fulfilled' ? ((r.value as any).count ?? 0) : 0;

      const usersCount = getCount(results[0]);
      const vaccinesCount = getCount(results[1]);
      const branchesCount = getCount(results[2]);
      const childrenCount = getCount(results[3]);
      const vaccinationEventsCount = getCount(results[4]);
      const appointmentsCount = getCount(results[5]);
      const notificationsCount = getCount(results[6]);
      const recentActiveUsers = getCount(results[7]);

      const totalTables = 21; // actual table count in schema
      const totalRows =
        usersCount +
        vaccinesCount +
        branchesCount +
        childrenCount +
        vaccinationEventsCount +
        appointmentsCount +
        notificationsCount;

      return [
        {
          id: 'tables',
          name: 'Database Tables',
          value: totalTables,
          unit: 'total',
          status: 'normal',
          threshold: 30,
        },
        {
          id: 'rows',
          name: 'Total Records',
          value: totalRows >= 1000 ? `${(totalRows / 1000).toFixed(1)}K` : String(totalRows),
          unit: 'count',
          status: 'normal',
          threshold: null,
        },
        {
          id: 'size',
          name: 'Database Size',
          value: 'Managed',
          unit: 'Supabase',
          status: 'normal',
          threshold: null,
        },
        {
          id: 'connections',
          name: 'Active Sessions',
          value: recentActiveUsers,
          unit: 'last 30 min',
          status: recentActiveUsers > 80 ? 'warning' : 'normal',
          threshold: 80,
        },
        {
          id: 'queryTime',
          name: 'Children Registered',
          value: childrenCount,
          unit: 'records',
          status: 'normal',
          threshold: null,
        },
        {
          id: 'cacheHit',
          name: 'Vaccination Events',
          value: vaccinationEventsCount,
          unit: 'records',
          status: 'normal',
          threshold: null,
        },
      ];
    } catch (error) {
      console.error('Failed to get database stats:', error);
      throw error;
    }
  }

  /**
   * Get recent backup history
   */
  async getBackupHistory() {
    try {
      const { data: backups } = await this.db.supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'export')
        .eq('entity_type', 'backup')
        .order('created_at', { ascending: false })
        .limit(10);

      return (backups || []).map((backup) => ({
        id: backup.id,
        timestamp: new Date(backup.created_at).toLocaleString(),
        size: '2.3 GB',
        status: 'success',
      }));
    } catch (error) {
      console.error('Failed to get backup history:', error);
      return [];
    }
  }

  /**
   * Configure backup schedule and retention
   */
  async configureBackup(
    config: { frequency: 'daily' | 'weekly' | 'monthly'; retentionDays: number },
    user: any,
  ) {
    try {
      await this.db.supabase.from('system_settings').upsert(
        [
          { key: 'backup_frequency', value: config.frequency, category: 'backup', updated_by: user.id },
          { key: 'backup_retention_days', value: config.retentionDays.toString(), category: 'backup', updated_by: user.id },
        ],
        { onConflict: 'key' },
      );

      await this.db.createAuditLog(
        user.id,
        'update',
        'backup_config',
        'backup_settings',
        { after: { frequency: config.frequency, retentionDays: config.retentionDays } },
      );

      return { success: true, message: 'Backup configuration saved' };
    } catch (error) {
      console.error('Failed to configure backup:', error);
      throw error;
    }
  }

  /**
   * Get user activity logs with real IP addresses
   */
  async getAuditActivity() {
    try {
      const { data: logs } = await this.db.supabase
        .from('audit_logs')
        .select(`
          id,
          ip_address,
          action,
          entity_type,
          created_at,
          user:users(id, full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      return (logs || []).map((log) => {
        const user = Array.isArray(log.user) ? log.user[0] : log.user;
        return {
          id: log.id,
          userId: user?.id || 'unknown',
          userName: user?.full_name || 'Unknown User',
          action: log.action,
          resource: log.entity_type,
          timestamp: new Date(log.created_at).toLocaleString(),
          ipAddress: log.ip_address || 'N/A',
          status: 'success',
        };
      });
    } catch (error) {
      console.error('Failed to get audit activity:', error);
      return [];
    }
  }
}
