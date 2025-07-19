#!/bin/bash

# Redis Security Hardening Script for Production
# This script secures Redis against Cross Protocol Scripting attacks

echo "🔒 Starting Redis security hardening..."

# 1. Block the attacking IP
echo "🚫 Blocking attacking IP 3.131.215.38..."
sudo iptables -A INPUT -s 3.131.215.38 -j DROP
sudo iptables-save > /etc/iptables/rules.v4

# 2. Check if Redis is publicly exposed
echo "🔍 Checking Redis network exposure..."
redis_exposure=$(sudo netstat -tlnp | grep 6379)
echo "Current Redis bindings: $redis_exposure"

if echo "$redis_exposure" | grep -q "0.0.0.0:6379"; then
    echo "❌ CRITICAL: Redis is exposed to the internet!"
else
    echo "✅ Redis appears to be bound to localhost only"
fi

# 3. Backup current Redis configuration
echo "💾 Backing up Redis configuration..."
sudo cp /etc/redis/redis.conf /etc/redis/redis.conf.backup.$(date +%Y%m%d_%H%M%S)

# 4. Apply security configuration
echo "🔧 Applying security configuration..."
sudo tee /tmp/redis-security.conf > /dev/null << 'EOF'
# Security hardening for Redis
bind 127.0.0.1 ::1
protected-mode yes
port 6379
timeout 300
tcp-keepalive 300

# Require authentication
requirepass CHANGE_THIS_PASSWORD_NOW

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command EVAL ""
rename-command DEBUG ""
rename-command CONFIG "CONFIG_a1b2c3d4e5f6"

# Connection limits
maxclients 128
tcp-backlog 511

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log

# Persistence (adjust as needed)
save 900 1
save 300 10
save 60 10000

# Memory management
maxmemory-policy allkeys-lru
EOF

# 5. Apply the security configuration
echo "📝 Updating Redis configuration..."
sudo cat /tmp/redis-security.conf >> /etc/redis/redis.conf

# 6. Restart Redis
echo "🔄 Restarting Redis service..."
sudo systemctl restart redis-server

# 7. Verify Redis is secure
echo "✅ Verifying Redis security..."
sleep 2

# Check if Redis is running
if sudo systemctl is-active --quiet redis-server; then
    echo "✅ Redis is running"
else
    echo "❌ Redis failed to start"
fi

# Check network binding
redis_binding=$(sudo netstat -tlnp | grep 6379)
echo "New Redis bindings: $redis_binding"

# 8. Update firewall rules
echo "🔥 Updating firewall rules..."
sudo ufw deny 6379/tcp
sudo ufw reload

# 9. Set up monitoring
echo "📊 Setting up Redis monitoring..."
sudo tee /etc/logrotate.d/redis-security > /dev/null << 'EOF'
/var/log/redis/redis-server.log {
    daily
    missingok
    rotate 7
    compress
    notifempty
    create 640 redis redis
    postrotate
        systemctl reload redis-server > /dev/null 2>&1 || true
    endscript
}
EOF

echo "🎯 Security hardening completed!"
echo ""
echo "🚨 IMPORTANT NEXT STEPS:"
echo "1. Change the Redis password in /etc/redis/redis.conf"
echo "2. Update your application's REDIS_PASSWORD environment variable"
echo "3. Test your application connectivity"
echo "4. Monitor /var/log/redis/redis-server.log for attacks"
echo ""
echo "📋 Commands to run:"
echo "sudo nano /etc/redis/redis.conf  # Change requirepass"
echo "sudo systemctl restart redis-server"
echo "tail -f /var/log/redis/redis-server.log"