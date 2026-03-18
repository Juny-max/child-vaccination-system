#!/usr/bin/env npx ts-node
/**
 * Create Test Backup
 * 
 * This script creates a test encrypted backup file for testing the download endpoint.
 * 
 * Usage:
 *   npx ts-node scripts/create-test-backup.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const BACKUP_ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY;

/**
 * Ensure backup directory exists
 */
function ensureBackupDirectory() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
    console.log(`✓ Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Encrypt data using AES-256-CBC
 */
function encryptData(data: Buffer, key: string): Buffer {
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

  // Return IV + encrypted data
  return Buffer.concat([iv, encrypted]);
}

/**
 * Create test backup
 */
function createTestBackup() {
  try {
    ensureBackupDirectory();

    if (!BACKUP_ENCRYPTION_KEY) {
      throw new Error('BACKUP_ENCRYPTION_KEY not set in .env');
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `cvcc-backup-encrypted-${timestamp}.bin`;
    const filepath = path.join(BACKUP_DIR, filename);

    // Check if backup already exists for today
    if (fs.existsSync(filepath)) {
      console.log(`ℹ Backup already exists for today: ${filename}`);
      return filepath;
    }

    // Create sample backup data
    const backupData = JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        system: 'Child Vaccination Command Center',
        type: 'database_snapshot',
        version: '1.0',
        environment: process.env.NODE_ENV || 'development',
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
          'clinic_sessions',
          'stock_inventory',
        ],
        recordCounts: {
          children: 1250,
          parents: 890,
          vaccinations: 5230,
          facilities: 12,
        },
      },
      null,
      2
    );

    console.log('🔐 Encrypting backup data...');
    const buffer = Buffer.from(backupData);
    const encrypted = encryptData(buffer, BACKUP_ENCRYPTION_KEY);

    // Write encrypted backup
    fs.writeFileSync(filepath, encrypted);
    fs.chmodSync(filepath, 0o600); // Read-only for owner

    console.log(`✓ Test backup created: ${filename}`);
    console.log(`  Location: ${filepath}`);
    console.log(`  Size: ${encrypted.length} bytes`);
    console.log(`  Encrypted: Yes (AES-256-CBC)`);
    console.log(`  Permissions: 600 (owner read-only)`);

    return filepath;
  } catch (error: any) {
    console.error(`✗ Failed to create test backup: ${error.message}`);
    process.exit(1);
  }
}

// Run
createTestBackup();
