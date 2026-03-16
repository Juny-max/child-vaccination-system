import { Controller, Get, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import * as fs from 'fs';
import * as path from 'path';

@Controller('common/backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  /**
   * Download the latest encrypted backup file
   */
  @Get('download-latest')
  async downloadLatestBackup(@Res() res: Response) {
    try {
      const backupDir = process.env.BACKUP_DIR || './backups';
      
      // Ensure directory exists
      if (!fs.existsSync(backupDir)) {
        return res.status(404).json({
          success: false,
          message: 'No backups found. Backup directory not initialized.',
        });
      }
      
      // Get all .bin files sorted by date (newest first)
      const files = fs.readdirSync(backupDir)
        .filter(file => file.endsWith('.bin'))
        .sort()
        .reverse();
      
      if (files.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No encrypted backups found',
        });
      }
      
      const latestFile = files[0];
      const filePath = path.join(backupDir, latestFile);
      
      // Set proper response headers
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${latestFile}"`);
      
      // Stream the file to client
      const fileStream = fs.createReadStream(filePath);
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
  @Get('trigger')
  async triggerBackup(@Res() res: Response) {
    try {
      // Placeholder for backup trigger - will queue a backup job
      res.status(202).json({
        success: true,
        message: 'Backup job queued',
        status: 'queued',
        estimatedTime: '5-10 minutes',
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
