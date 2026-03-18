# Encrypted Backup Storage Configuration Guide

This guide walks you through setting up the encrypted backup storage system. The endpoints are ready—you just need to configure the storage backend.

## Overview

The backup system has three components to configure:

1. **Storage Directory** - Where encrypted backups are stored
2. **Encryption Keys** - For encrypting/decrypting backups
3. **Backup Schedule** - Automated backup timing (optional)

---

## Step 1: Set Environment Variables

Add these to your `.env` file in the `backend/` directory:

```bash
# Backup Storage Configuration
BACKUP_DIR=/path/to/your/backups          # Where backups are stored
BACKUP_ENCRYPTION_KEY=your-256-bit-key    # Base64-encoded 256-bit encryption key
BACKUP_RETENTION_DAYS=30                  # Keep backups for 30 days
BACKUP_SCHEDULE=0 2 * * *                 # Cron: Daily at 2 AM
```

### Example Configuration:

```bash
# macOS/Linux
BACKUP_DIR=/Users/jy/Documents/backups
BACKUP_ENCRYPTION_KEY=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE=0 2 * * *
```

Or with environment-specific paths:

```bash
# Development
BACKUP_DIR=./backups/dev

# Production (Render/Railway)
BACKUP_DIR=/var/backups/cvcc
```

---

## Step 2: Generate Encryption Key

Run this command in your backend directory to generate a secure encryption key:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Output example:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

Copy this value and paste it as `BACKUP_ENCRYPTION_KEY` in your `.env` file.

---

## Step 3: Create Backup Directory

Create the directory where backups will be stored:

```bash
# macOS/Linux
mkdir -p /Users/jy/Documents/backups
chmod 700 /Users/jy/Documents/backups

# Or use relative path (creates in backend/)
mkdir -p ./backups
chmod 700 ./backups
```

**Security Note**: Set restrictive permissions (700) so only your app can read/write backups.

---

## Step 4: Update Backend Controller

Update `backend/src/common/backup.controller.ts` to use actual file operations:

### Current state (placeholder):
```typescript
@Get('download-latest')
async downloadLatestBackup(@Res() res: Response) {
  try {
    const backupDir = process.env.BACKUP_DIR || './backups';
    
    res.status(200).json({
      success: false,
      message: 'Backup endpoint ready. Storage configuration pending...',
      status: 'pending-storage-config',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve backup',
      error: error.message,
    });
  }
}
```

### What to replace it with:

Replace the placeholder response with actual file reading:

```typescript
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
```

---

## Step 5: Create Backup Service (Optional but Recommended)

Create a new file: `backend/src/common/backup.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
   * Create an encrypted database backup
   */
  async createBackup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `cvcc-backup-encrypted-${timestamp}.bin`;
      const filepath = path.join(this.backupDir, filename);

      this.logger.log(`Starting backup: ${filename}`);

      // Step 1: Dump Supabase database (using pg_dump or Supabase API)
      // Example using Supabase SQL endpoint
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable not set');
      }

      // Using pg_dump to export database
      const dumpCommand = `pg_dump "${databaseUrl}" --format=custom --file=/tmp/cvcc-dump.bin`;
      await execAsync(dumpCommand);

      // Step 2: Encrypt the dump
      if (!this.encryptionKey) {
        throw new Error('BACKUP_ENCRYPTION_KEY not configured');
      }

      const dumpBuffer = fs.readFileSync('/tmp/cvcc-dump.bin');
      const encrypted = this.encryptData(dumpBuffer, this.encryptionKey);

      // Step 3: Write encrypted backup
      fs.writeFileSync(filepath, encrypted);
      fs.chmodSync(filepath, 0o600); // Read-only for owner

      // Step 4: Clean up temporary dump
      fs.unlinkSync('/tmp/cvcc-dump.bin');

      this.logger.log(`Backup created successfully: ${filename}`);
      return filepath;
    } catch (error: any) {
      this.logger.error(`Backup failed: ${error.message}`);
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
   * Encrypt data using AES-256-CBC
   */
  private encryptData(data: Buffer, key: string): Buffer {
    const iv = crypto.randomBytes(16);
    const keyBuffer = Buffer.from(key, 'hex');
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);

    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final(),
    ]);

    // Return IV + encrypted data
    return Buffer.concat([iv, encrypted]);
  }

  /**
   * Decrypt data using AES-256-CBC
   */
  decryptData(encryptedData: Buffer, key: string): Buffer {
    const iv = encryptedData.slice(0, 16);
    const data = encryptedData.slice(16);
    const keyBuffer = Buffer.from(key, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);

    return Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]);
  }

  /**
   * Clean up old backups based on retention policy
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
}
```

---

## Step 6: Register Backup Service (Optional)

If you created the BackupService, register it in `backend/src/app.module.ts`:

```typescript
import { BackupService } from './common/backup.service';

@Module({
  // ... other config
  providers: [
    // ... other providers
    BackupService,
  ],
})
export class AppModule {}
```

---

## Step 7: Test Configuration

### Test 1: Verify Environment Variables

```bash
cd backend
echo "BACKUP_DIR: $BACKUP_DIR"
echo "BACKUP_ENCRYPTION_KEY: $BACKUP_ENCRYPTION_KEY"
echo "BACKUP_RETENTION_DAYS: $BACKUP_RETENTION_DAYS"
```

### Test 2: Check Directory Permissions

```bash
ls -la /Users/jy/Documents/backups
# Should show: drwx------ (700 permissions)
```

### Test 3: Start Backend and Test Endpoint

```bash
# Terminal 1: Start backend
cd backend
pnpm run start:dev

# Terminal 2: Test the endpoint
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3001/api/common/backup/download-latest
```

### Test 4: Create Sample Backup

```bash
# Create a test backup file
echo "Test backup content" | openssl enc -aes-256-cbc -e -K abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890 -iv 0 -out /Users/jy/Documents/backups/cvcc-backup-encrypted-2026-03-16.bin
```

---

## Step 8: Set Up Automated Backups (Optional)

Use your deployment platform's cron job feature:

### For Render:
Add to `render.yaml`:
```yaml
services:
  - type: cron
    name: daily-backup
    schedule: '0 2 * * *'  # 2 AM daily
    command: 'curl -X GET http://localhost:3001/api/common/backup/trigger -H "Authorization: Bearer $SERVICE_TOKEN"'
```

### For Railway:
Use railway.toml:
```toml
[cron]
daily_backup = "0 2 * * * /app/backup-job.sh"
```

### For Local Development:
Use node-cron package:
```bash
pnpm add node-cron
```

Then in a scheduled service:
```typescript
import * as cron from 'node-cron';

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  const backup = await this.backupService.createBackup();
  console.log('Scheduled backup created:', backup);
});
```

---

## Configuration Checklist

- [ ] Added `BACKUP_DIR` to `.env` (check it exists and has 700 permissions)
- [ ] Generated encryption key and added `BACKUP_ENCRYPTION_KEY` to `.env`
- [ ] Created backup directory: `mkdir -p $BACKUP_DIR && chmod 700 $BACKUP_DIR`
- [ ] Updated `backend/src/common/backup.controller.ts` with file streaming logic
- [ ] (Optional) Created `backend/src/common/backup.service.ts`
- [ ] (Optional) Registered BackupService in `app.module.ts`
- [ ] Tested endpoint: `curl ... /api/common/backup/download-latest`
- [ ] Frontend automatically detects working backups

---

## Troubleshooting

### "Backup directory not initialized"
```bash
# Solution: Create the directory
mkdir -p /Users/jy/Documents/backups
chmod 700 /Users/jy/Documents/backups
```

### "No encrypted backups found"
```bash
# Solution: Create first backup
node backend/scripts/create-backup.ts
# Or wait for scheduled backup to run
```

### "Failed to decrypt backup"
```bash
# Solution: Verify encryption key matches
node -e "console.log(process.env.BACKUP_ENCRYPTION_KEY)" 
# Must be 64 hex characters (256 bits)
```

### "Permission denied" on backup file
```bash
# Solution: Fix permissions
chmod 600 /Users/jy/Documents/backups/*.bin
```

---

## Next Steps

1. **Configure Storage** - Follow steps 1-3 above
2. **Update Controller** - Implement step 4 with actual file operations
3. **Add Service** - (Optional) Create BackupService for backup creation
4. **Test Endpoint** - Use step 7 to verify it's working
5. **Set Up Automation** - (Optional) Configure scheduled backups

Once storage is configured, the frontend will automatically start downloading encrypted backups!
