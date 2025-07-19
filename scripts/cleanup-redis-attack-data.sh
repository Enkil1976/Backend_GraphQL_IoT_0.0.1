#!/bin/bash

# Redis Attack Data Cleanup Script
# Cleans up disk space consumed by Redis attacks

echo "🧹 Starting Redis attack data cleanup..."

# 1. Stop services to safely clean
echo "🛑 Stopping services for safe cleanup..."
docker-compose down 2>/dev/null || echo "Docker compose not available"
sudo systemctl stop redis-server 2>/dev/null || echo "Redis service not found"

# 2. Backup important data first
echo "💾 Creating backup of legitimate Redis data..."
mkdir -p /tmp/redis-backup-$(date +%Y%m%d_%H%M%S)
sudo cp /var/lib/redis/dump.rdb /tmp/redis-backup-$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || echo "No dump.rdb to backup"

# 3. Clean Redis logs (keep last 100 lines)
echo "📄 Cleaning Redis logs..."
if [ -f /var/log/redis/redis-server.log ]; then
    sudo tail -100 /var/log/redis/redis-server.log > /tmp/redis-clean.log
    sudo mv /tmp/redis-clean.log /var/log/redis/redis-server.log
    sudo chown redis:redis /var/log/redis/redis-server.log
    echo "✅ Redis logs cleaned"
else
    echo "⚠️ Redis log file not found"
fi

# 4. Clear Redis data directory of potentially corrupted data
echo "🗂️ Cleaning Redis data directory..."
sudo rm -f /var/lib/redis/dump.rdb 2>/dev/null
sudo rm -f /var/lib/redis/*.aof 2>/dev/null
sudo rm -f /var/lib/redis/*.rdb.* 2>/dev/null
sudo rm -f /var/lib/redis/temp-* 2>/dev/null

# 5. Clean Docker Redis container data
echo "🐳 Cleaning Docker Redis data..."
docker volume rm $(docker volume ls -q | grep redis) 2>/dev/null || echo "No Docker Redis volumes found"

# 6. Clean system logs related to Redis
echo "📝 Cleaning system logs..."
sudo journalctl --vacuum-time=1h
sudo journalctl --vacuum-size=50M

# 7. Clean temporary files
echo "🗑️ Cleaning temporary files..."
sudo find /tmp -name "*redis*" -type f -delete 2>/dev/null
sudo find /var/tmp -name "*redis*" -type f -delete 2>/dev/null

# 8. Check space freed
echo "📊 Checking space freed..."
df -h | grep -E "(Filesystem|/dev/)"

# 9. Restart services
echo "🔄 Restarting services..."
sudo systemctl start redis-server 2>/dev/null || echo "Redis service not available"

# Wait for Redis to start
sleep 3

# Start Docker services
docker-compose up -d 2>/dev/null || echo "Docker compose not available"

echo ""
echo "✅ Redis attack cleanup completed!"
echo ""
echo "🔍 NEXT STEPS:"
echo "1. Monitor: sudo tail -f /var/log/redis/redis-server.log"
echo "2. Check space: df -h"
echo "3. Secure Redis: ./scripts/secure-redis-production.sh"
echo "4. Test app: curl http://localhost:4001/health"