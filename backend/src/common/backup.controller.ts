import { Controller, Get, Post, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackupService } from './backup.service';
import * as fs from 'fs';

@Controller('common/backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  /**
   * Download the latest encrypted backup file
   */
  @Get('download-latest')
  async downloadLatestBackup(@Res() res: Response) {
    try {
      const latest = this.backupService.getLatestBackup();

      if (!latest) {
        return res.status(404).json({
          success: false,
          message: 'No encrypted backups found',
        });
      }

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
            error: error.message,
          });
        }
      });
    } catch (error: any) {
      console.error('Backup download error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve backup',
        error: error.message,
      });
    }
  }

  /**
   * Trigger a new backup operation
   */
  @Post('trigger')
  async triggerBackup(@Res() res: Response) {
    try {
      const filepath = await this.backupService.createBackup();
      res.status(201).json({
        success: true,
        message: 'Backup created successfully',
        filepath,
      });
    } catch (error: any) {
      console.error('Backup trigger error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to trigger backup',
        error: error.message,
      });
    }
  }
}
