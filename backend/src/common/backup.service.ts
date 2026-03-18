import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { DatabaseService } from './database/database.service';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = process.env.BACKUP_DIR || './backups';
  private readonly encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;

  private readonly BACKUP_TABLES = [
    'users',
    'branches',
    'catchment_areas',
    'guardians',
    'children',
    'child_guardian',
    'vaccines',
    'vaccination_schedules',
    'vaccination_events',
    'aefi_reports',
    'certificates',
    'appointments',
    'notifications',
    'audit_logs',
  ];

  constructor(private readonly db: DatabaseService) {
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
   * Fetch all rows from a Supabase table with automatic pagination.
   */
  private async fetchAllRows(tableName: string): Promise<{ rows: any[]; count: number }> {
    const PAGE_SIZE = 1000;
    const allRows: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.db.supabase
        .from(tableName)
        .select('*')
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        this.logger.warn(`Failed to read table "${tableName}": ${error.message}`);
        return { rows: [], count: 0 };
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allRows.push(...data);
        offset += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      }
    }

    return { rows: allRows, count: allRows.length };
  }

  /**
   * Create an encrypted, gzip-compressed database backup.
   * Exports all configured tables via the Supabase client.
   */
  async createBackup(): Promise<string> {
    const startTime = Date.now();

    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `cvcc-backup-encrypted-${timestamp}.bin`;
      const filepath = path.join(this.backupDir, filename);

      this.logger.log(`Starting database backup: ${filename}`);

      const tables: Record<string, any[]> = {};
      const tableCounts: Record<string, number> = {};

      for (const tableName of this.BACKUP_TABLES) {
        this.logger.log(`Exporting table: ${tableName}`);
        const { rows, count } = await this.fetchAllRows(tableName);
        tables[tableName] = rows;
        tableCounts[tableName] = count;
      }

      const backupPayload = {
        metadata: {
          timestamp: new Date().toISOString(),
          system: 'Child Vaccination Command Center',
          type: 'database_snapshot',
          version: '2.0',
          tables: Object.keys(tableCounts),
          tableCounts,
          totalRows: Object.values(tableCounts).reduce((sum, c) => sum + c, 0),
          durationMs: Date.now() - startTime,
        },
        data: tables,
      };

      const jsonBuffer = Buffer.from(JSON.stringify(backupPayload), 'utf-8');
      this.logger.log(
        `Backup JSON assembled: ${(jsonBuffer.length / 1024 / 1024).toFixed(2)} MB uncompressed`,
      );

      const compressed = await gzip(jsonBuffer);
      this.logger.log(
        `Compressed: ${(compressed.length / 1024 / 1024).toFixed(2)} MB ` +
        `(${((1 - compressed.length / jsonBuffer.length) * 100).toFixed(1)}% reduction)`,
      );

      const encrypted = this.encryptData(compressed as Buffer, this.encryptionKey || '');

      fs.writeFileSync(filepath, encrypted);
      fs.chmodSync(filepath, 0o600);

      const totalDuration = Date.now() - startTime;
      this.logger.log(
        `Backup completed: ${filename} | ` +
        `${(encrypted.length / 1024 / 1024).toFixed(2)} MB encrypted | ` +
        `${totalDuration}ms | ` +
        `${backupPayload.metadata.totalRows} total rows`,
      );

      return filepath;
    } catch (error: any) {
      this.logger.error(`Backup failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Decrypt and decompress a backup file, returning the parsed JSON payload.
   */
  async decryptBackup(filepath: string): Promise<any> {
    const encrypted = fs.readFileSync(filepath);
    const decrypted = this.decryptData(encrypted, this.encryptionKey || '');
    const decompressed = await gunzip(decrypted);
    return JSON.parse(decompressed.toString('utf-8'));
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
   * Encrypt data using AES-256-GCM (AEAD — provides confidentiality + integrity).
   * Output format: IV (12 bytes) || AuthTag (16 bytes) || Ciphertext
   */
  private encryptData(data: Buffer, key: string): Buffer {
    if (!key || key.length < 64) {
      throw new Error('Invalid encryption key. Must be 256-bit (64 hex characters)');
    }

    const iv = crypto.randomBytes(12);
    const keyBuffer = Buffer.from(key, 'hex');
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Return IV || AuthTag || Ciphertext
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * Decrypt data using AES-256-GCM.
   * Verifies the authentication tag before returning plaintext;
   * throws if the ciphertext has been tampered with.
   */
  private decryptData(encryptedData: Buffer, key: string): Buffer {
    if (!key || key.length < 64) {
      throw new Error('Invalid encryption key. Must be 256-bit (64 hex characters)');
    }

    // Minimum: 12-byte IV + 16-byte auth tag = 28 bytes
    if (encryptedData.length < 28) {
      throw new Error('Invalid encrypted data: too short to contain IV and authentication tag');
    }

    const iv = encryptedData.subarray(0, 12);
    const authTag = encryptedData.subarray(12, 28);
    const data = encryptedData.subarray(28);
    const keyBuffer = Buffer.from(key, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]);
  }
}
