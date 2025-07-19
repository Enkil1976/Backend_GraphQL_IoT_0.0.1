#!/bin/bash

# Cleanup Backup Files Script
# This script removes backup files to free disk space

echo "🧹 Starting backup cleanup..."

# Check current disk usage
echo "📊 Current disk usage:"
df -h | grep -E "(Filesystem|/dev/)"

# Find and list backup files
echo ""
echo "🔍 Searching for backup files..."

# Check for backup directories
BACKUP_DIRS=("./backups" "../backups" "/var/backups" "/tmp/backups")
BACKUP_FILES_FOUND=0

for dir in "${BACKUP_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "📁 Found backup directory: $dir"
    BACKUP_COUNT=$(find "$dir" -name "*backup*" -type f 2>/dev/null | wc -l)
    BACKUP_SIZE=$(du -sh "$dir" 2>/dev/null | cut -f1)
    echo "   Files: $BACKUP_COUNT, Size: $BACKUP_SIZE"
    BACKUP_FILES_FOUND=$((BACKUP_FILES_FOUND + BACKUP_COUNT))
  fi
done

# Look for backup files in current directory
CURRENT_BACKUPS=$(find . -maxdepth 1 -name "*backup*.json" -type f 2>/dev/null | wc -l)
if [ $CURRENT_BACKUPS -gt 0 ]; then
  echo "📁 Found $CURRENT_BACKUPS backup files in current directory"
  BACKUP_FILES_FOUND=$((BACKUP_FILES_FOUND + CURRENT_BACKUPS))
fi

if [ $BACKUP_FILES_FOUND -eq 0 ]; then
  echo "✅ No backup files found to clean"
else
  echo ""
  echo "⚠️  Found $BACKUP_FILES_FOUND backup files total"
  echo ""
  read -p "Do you want to remove ALL backup files? (yes/no): " CONFIRM
  
  if [ "$CONFIRM" = "yes" ]; then
    echo ""
    echo "🗑️  Removing backup files..."
    
    # Remove backup directories
    for dir in "${BACKUP_DIRS[@]}"; do
      if [ -d "$dir" ]; then
        echo "   Removing directory: $dir"
        rm -rf "$dir"
      fi
    done
    
    # Remove backup files in current directory
    find . -maxdepth 1 -name "*backup*.json" -type f -delete 2>/dev/null
    find . -maxdepth 1 -name "db-backup-*" -type f -delete 2>/dev/null
    
    echo "✅ Backup cleanup completed!"
  else
    echo "❌ Backup cleanup cancelled"
  fi
fi

# Check disk usage after cleanup
echo ""
echo "📊 Disk usage after cleanup:"
df -h | grep -E "(Filesystem|/dev/)"

echo ""
echo "💡 To prevent future backup accumulation:"
echo "   - Set AUTO_BACKUP=false in .env"
echo "   - Set BACKUP_ENABLED=false in .env"
echo "   - Reduce BACKUP_RETENTION_DAYS to 7 or less"