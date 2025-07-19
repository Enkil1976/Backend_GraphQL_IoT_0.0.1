#!/bin/bash

# Redis Disk Usage Diagnostic Script
# Checks if Redis attacks are causing disk space issues

echo "🔍 Diagnosing Redis disk usage..."

# 1. Check Redis log file sizes
echo "📄 Redis log file sizes:"
sudo find /var/log -name "*redis*" -exec ls -lh {} \; 2>/dev/null

# 2. Check Redis data directory
echo ""
echo "💾 Redis data directory usage:"
sudo du -sh /var/lib/redis/ 2>/dev/null || echo "Redis data dir not found at standard location"

# 3. Check for Redis dump files
echo ""
echo "🗂️ Redis dump files:"
sudo find / -name "dump.rdb" -exec ls -lh {} \; 2>/dev/null

# 4. Check Redis memory usage
echo ""
echo "🧠 Redis memory usage:"
if command -v redis-cli &> /dev/null; then
    redis-cli info memory 2>/dev/null | grep -E "(used_memory_human|used_memory_peak_human)" || echo "Redis not accessible"
else
    echo "redis-cli not available"
fi

# 5. Count recent security attacks in logs
echo ""
echo "🚨 Recent security attacks (last 1000 lines):"
sudo tail -1000 /var/log/redis/redis-server.log 2>/dev/null | grep -c "SECURITY ATTACK" || echo "No Redis log found"

# 6. Check largest files in Redis directory
echo ""
echo "📊 Largest files in Redis directories:"
sudo find /var/lib/redis /var/log/redis -type f -exec ls -lh {} \; 2>/dev/null | sort -k5 -hr | head -10

# 7. Check Docker Redis container logs
echo ""
echo "🐳 Docker Redis container log sizes:"
docker logs redis --tail 100 2>/dev/null | wc -l || echo "No Docker Redis container found"

# 8. Check total disk usage
echo ""
echo "💿 Total disk usage:"
df -h | grep -E "(Filesystem|/dev/)"

# 9. Check largest directories
echo ""
echo "📁 Largest directories in /var:"
sudo du -sh /var/* 2>/dev/null | sort -hr | head -10

echo ""
echo "✅ Diagnostic complete!"
echo ""
echo "🔍 ANALYSIS TIPS:"
echo "- If Redis logs are >100MB, attacks are filling disk"
echo "- If dump.rdb is >1GB, data corruption likely"
echo "- If memory usage is abnormally high, spam data exists"
echo "- High security attack count = active attack in progress"