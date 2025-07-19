#!/bin/bash

# Production Database Cleanup Script
# This script cleans up Docker resources and PostgreSQL temp files

echo "🧹 Starting production cleanup..."

# Check disk space before cleanup
echo "📊 Disk space before cleanup:"
df -h | grep -E "(Filesystem|/dev/)"

# Clean Docker resources
echo "🐳 Cleaning Docker resources..."
sudo docker system prune -a --volumes -f
sudo docker container prune -f
sudo docker image prune -a -f
sudo docker volume prune -f

# Clean system logs
echo "📝 Cleaning system logs..."
sudo journalctl --vacuum-time=7d
sudo journalctl --vacuum-size=100M

# Clean PostgreSQL temp files (if accessible)
echo "🗄️ Cleaning PostgreSQL temp files..."
sudo find /var/lib/docker/volumes/ -name "pg_stat_tmp*" -type f -delete 2>/dev/null || true
sudo find /var/lib/docker/volumes/ -name "*.tmp" -type f -delete 2>/dev/null || true

# Clean old log files
echo "🔍 Cleaning old log files..."
sudo find /var/log -name "*.log.*" -mtime +7 -delete 2>/dev/null || true

# Check disk space after cleanup
echo "📊 Disk space after cleanup:"
df -h | grep -E "(Filesystem|/dev/)"

# Show Docker space usage
echo "🐳 Docker space usage:"
sudo docker system df

echo "✅ Cleanup completed!"