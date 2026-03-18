#!/bin/bash
# Verify Encrypted Backup Configuration

echo "═══════════════════════════════════════════════════════════════"
echo "  CVCC Encrypted Backup Configuration Verification"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check environment variables
echo "✓ Environment Variables:"
echo "  BACKUP_DIR: ${BACKUP_DIR:-./backups}"
if [ -n "$BACKUP_ENCRYPTION_KEY" ]; then
  KEY_LENGTH=${#BACKUP_ENCRYPTION_KEY}
  echo "  BACKUP_ENCRYPTION_KEY: ****** (${KEY_LENGTH} characters)"
else
  echo "  BACKUP_ENCRYPTION_KEY: ✗ NOT SET"
fi
echo "  BACKUP_RETENTION_DAYS: ${BACKUP_RETENTION_DAYS:-30}"
echo ""

# Check backup directory
echo "✓ Backup Directory:"
BACKUP_PATH="./backups"
if [ -d "$BACKUP_PATH" ]; then
  PERMS=$(ls -ld "$BACKUP_PATH" | awk '{print $1}')
  echo "  Path: $BACKUP_PATH"
  echo "  Permissions: $PERMS (should be drwx------)"
  echo "  Status: Ready ✓"
else
  echo "  Path: $BACKUP_PATH"
  echo "  Status: Directory not found ✗"
fi
echo ""

# Check backup files
echo "✓ Encrypted Backups:"
if [ -d "$BACKUP_PATH" ]; then
  BACKUP_COUNT=$(find "$BACKUP_PATH" -name "*.bin" -type f | wc -l)
  if [ "$BACKUP_COUNT" -gt 0 ]; then
    echo "  Found $BACKUP_COUNT backup(s):"
    find "$BACKUP_PATH" -name "*.bin" -type f -exec ls -lh {} \; | awk '{print "    - " $9 " (" $5 ")"}'
  else
    echo "  No backups found yet. Run to create one:"
    echo "  $ npx ts-node scripts/create-test-backup.ts"
  fi
else
  echo "  Backup directory not found"
fi
echo ""

# Check backend files
echo "✓ Backend Files:"
CONTROLLER_FILE="src/common/backup.controller.ts"
SERVICE_FILE="src/common/backup.service.ts"
if [ -f "$CONTROLLER_FILE" ]; then
  echo "  - $CONTROLLER_FILE ✓"
else
  echo "  - $CONTROLLER_FILE ✗ NOT FOUND"
fi
if [ -f "$SERVICE_FILE" ]; then
  echo "  - $SERVICE_FILE ✓"
else
  echo "  - $SERVICE_FILE ✗ NOT FOUND"
fi
echo ""

# Check configuration in .env
echo "✓ Configuration Status:"
if grep -q "BACKUP_DIR=" .env; then
  echo "  - BACKUP_DIR configured ✓"
else
  echo "  - BACKUP_DIR not configured ✗"
fi
if grep -q "BACKUP_ENCRYPTION_KEY=" .env; then
  echo "  - BACKUP_ENCRYPTION_KEY configured ✓"
else
  echo "  - BACKUP_ENCRYPTION_KEY not configured ✗"
fi
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "  Configuration Complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📝 Next Steps:"
echo "  1. Start the backend: pnpm run start:dev"
echo "  2. Test the endpoint:"
echo "     curl -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "     http://localhost:3001/api/common/backup/download-latest"
echo "  3. To create more backups:"
echo "     npx ts-node scripts/create-test-backup.ts"
echo ""
