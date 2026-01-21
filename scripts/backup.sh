#!/bin/bash
set -e

# NexusNote Database Backup Script
# Usage: ./scripts/backup.sh [backup_dir]

BACKUP_DIR=${1:-./backups}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/nexusnote_$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"

echo "Creating database backup..."
docker exec nexusnote-db pg_dump -U postgres nexusnote > "$BACKUP_FILE"

# Compress
gzip "$BACKUP_FILE"

echo "Backup created: ${BACKUP_FILE}.gz"

# Keep only last 7 backups
cd "$BACKUP_DIR"
ls -tp | grep -v '/$' | tail -n +8 | xargs -I {} rm -- {}

echo "Old backups cleaned up. Keeping last 7."
