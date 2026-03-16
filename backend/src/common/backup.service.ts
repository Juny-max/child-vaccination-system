import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = process.env.BACKUP_DIR || './backups';
  private readonly encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;

  constructor() {
    this.ensureBackupDirectory();
  }

  /**
   * Ensure backup directory exists and is writable
   */
  private ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true, mode: 0o700 });
      this.logger.log(`Created backup directory: ${this.backupDir}`);
    }
  }

  /**
   * Create an encrypted test backup for demonstration
   */
  async createTestBackup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `cvcc-backup-encrypted-${timestamp}.bin`;
      const filepath = path.join(this.backupDir, filename);

      this.logger.log(`Creating test backup: ${filename}`);

      // Create sample backup data (in production, this would be a database dump)
      const backupData = JSON.stringify({
        timestamp: new Date().toISOString(),
        system: 'Child Vaccination Command Center',
        type: 'database_snapshot',
        version: '1.0',
        dataSize: '5MB',
        status: 'complete',
        tables: [
          'children',
          'parents',
          'guardians',
          'facilities',
          'vaccinations',
          'staff',
          'catchment_areas',
        ],
      });

      const buffer = Buffer.from(backupData);
      const encrypted = this.encryptData(buffer, this.encryptionKey || '');

      // Write encrypted backup
      fs.writeFileSync(filepath, encrypted);
      fs.chmodSync(filepath, 0o600); // Read-only for owner

      this.logger.log(`Test backup created successfully: ${filename}`);
      return filepath;
    } catch (error: any) {
      this.logger.error(`Test backup failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get latest backup file
   */
  getLatestBackup(): { path: string; filename: string } | null {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.endsWith('.bin'))
        .sort()
        .reverse();

      if (files.length === 0) return null;

      const filename = files[0];
      return {
        path: path.join(this.backupDir, filename),
        filename,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get latest backup: ${error.message}`);
      return null;
    }
  }

  /**
   * List all backups
   */
  listBackups(): string[] {
    try {
      return fs.readdirSync(this.backupDir)
        .filter(file => file.endsWith('.bin'))
        .sort()
        .reverse();
    } catch (error: any) {
      this.logger.error(`Failed to list backups: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');
      const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.endsWith('.bin'));

      for (const file of files) {
        const filepath = path.join(this.backupDir, file);
        const stats = fs.statSync(filepath);

        if (stats.mtimeMs < cutoffTime) {
          fs.unlinkSync(filepath);
          this.logger.log(`Deleted old backup: ${file}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Encrypt data using AES-256-CBC
   */
  private encryptData(data: Buffer, key: string): Buffer {
    if (!key || key.length < 64) {
      throw new Error('Invalid encryption key. Must be 256-bit (64 hex characters)');
    }

    const iv = crypto.randomBytes(16);
    const keyBuffer = Buffer.from(key, 'hex');
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);

    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final(),
    ]);

    // Return IV + encrypted data (IV needed for decryption)
    return Buffer.concat([iv, encrypted]);
  }

  /**
   * Decrypt data using AES-256-CBC
   */
  decryptData(encryptedData: Buffer, key: string): Buffer {
    if (!key || key.length < 64) {
      throw new Error('Invalid encryption key. Must be 256-bit (64 hex characters)');
    }

    const iv = encryptedData.slice(0, 16);
    const data = encryptedData.slice(16);
    const keyBuffer = Buffer.from(key, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);

    return Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]);
  }
}
