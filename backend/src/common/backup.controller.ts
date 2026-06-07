import { Controller, Get, Post, UseGuards, Res, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BackupService } from './backup.service';
import { DatabaseService } from './database/database.service';
import * as fs from 'fs';

@Controller('common/backup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('hq-admin')  // Only HQ admins can access backups
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Download the latest encrypted backup file
   * Restricted to HQ Admin only
   */
  @Get('download-latest')
  async downloadLatestBackup(@Req() req: Request, @Res() res: Response) {
    const user = req['user'] as { id: string; email: string };

    try {
      let latest = this.backupService.getLatestBackup();

      if (!latest) {
        try {
          const filepath = await this.backupService.createBackup();
          await this.databaseService.createAuditLog(
            user.id,
            'export',
            'backup',
            null,
            { after: { action: 'backup_created_on_download', filepath } },
          );
          latest = this.backupService.getLatestBackup();
        } catch (error: any) {
          const message = error?.message || 'Failed to create backup';
          const statusCode = message.includes('Invalid encryption key') ? 400 : 500;

          return res.status(statusCode).json({
            success: false,
            message,
          });
        }
      }

      if (!latest) {
        return res.status(404).json({
          success: false,
          message: 'No encrypted backups found after creation',
        });
      }

      // Audit log: backup download
      await this.databaseService.createAuditLog(
        user.id,
        'export',
        'backup',
        null,
        { after: { action: 'backup_download', filename: latest.filename } },
      );

      // Set proper response headers
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${latest.filename}"`);

      // Stream the file to client
      const fileStream = fs.createReadStream(latest.path);
      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        console.error('File read error:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Failed to stream backup file',
          });
        }
      });
    } catch (error: any) {
      console.error('Backup download error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve backup',
      });
    }
  }

  /**
   * Get status of the latest backup
   * Restricted to HQ Admin only
   */
  @Get('status')
  async getBackupStatus(@Res() res: Response) {
    try {
      const latest = this.backupService.getLatestBackup();
      if (!latest) {
        return res.json({ hasBackup: false, lastBackupAt: null, filename: null });
      }
      const stat = fs.statSync(latest.path);
      return res.json({
        hasBackup: true,
        lastBackupAt: stat.mtime.toISOString(),
        filename: latest.filename,
      });
    } catch (error: any) {
      return res.status(500).json({ hasBackup: false, lastBackupAt: null, filename: null });
    }
  }

  /**
   * Trigger a new backup operation
   * Restricted to HQ Admin only
   */
  @Post('trigger')
  async triggerBackup(@Req() req: Request, @Res() res: Response) {
    const user = req['user'] as { id: string; email: string };

    try {
      const filepath = await this.backupService.createBackup();

      // Audit log: backup creation
      await this.databaseService.createAuditLog(
        user.id,
        'export',
        'backup',
        null,
        { after: { action: 'backup_created', filepath } },
      );

      res.status(201).json({
        success: true,
        message: 'Backup created successfully',
      });
    } catch (error: any) {
      console.error('Backup trigger error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to trigger backup',
      });
    }
  }
}
