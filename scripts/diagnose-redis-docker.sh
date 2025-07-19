#!/bin/bash

# Redis Docker Diagnostic Script
# Diagnoses and fixes Redis container startup issues

echo "🔍 Diagnosing Redis Docker container issues..."
echo "==============================================="

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running or not accessible"
    exit 1
fi

echo "✅ Docker is running"

# Check for existing Redis containers
echo ""
echo "📋 Checking existing Redis containers..."
REDIS_CONTAINERS=$(docker ps -a --filter "name=redis" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")

if [ -n "$REDIS_CONTAINERS" ]; then
    echo "$REDIS_CONTAINERS"
    
    # Stop and remove existing Redis containers
    echo ""
    echo "🧹 Cleaning up existing Redis containers..."
    docker stop $(docker ps -aq --filter "name=redis") 2>/dev/null || true
    docker rm $(docker ps -aq --filter "name=redis") 2>/dev/null || true
    echo "✅ Existing Redis containers removed"
else
    echo "No existing Redis containers found"
fi

# Check Redis volumes
echo ""
echo "📦 Checking Redis volumes..."
REDIS_VOLUMES=$(docker volume ls --filter "name=redis" --format "table {{.Name}}\t{{.Driver}}")

if [ -n "$REDIS_VOLUMES" ]; then
    echo "$REDIS_VOLUMES"
    echo ""
    read -p "Do you want to remove Redis volumes? (yes/no): " REMOVE_VOLUMES
    
    if [ "$REMOVE_VOLUMES" = "yes" ]; then
        echo "🗑️  Removing Redis volumes..."
        docker volume rm $(docker volume ls --filter "name=redis" -q) 2>/dev/null || true
        echo "✅ Redis volumes removed"
    fi
else
    echo "No Redis volumes found"
fi

# Test Redis standalone container
echo ""
echo "🧪 Testing Redis standalone container..."
echo "Starting test Redis container..."

# Start a simple Redis container for testing
docker run --name redis-test -d -p 6379:6379 redis:7-alpine redis-server --requirepass testpass

# Wait for container to start
sleep 5

# Check if test container is running
if docker ps --filter "name=redis-test" --format "{{.Names}}" | grep -q "redis-test"; then
    echo "✅ Test Redis container started successfully"
    
    # Test Redis connection
    echo "🔌 Testing Redis connection..."
    if docker exec redis-test redis-cli -a testpass ping | grep -q "PONG"; then
        echo "✅ Redis connection test successful"
    else
        echo "❌ Redis connection test failed"
    fi
    
    # Clean up test container
    echo "🧹 Cleaning up test container..."
    docker stop redis-test >/dev/null 2>&1
    docker rm redis-test >/dev/null 2>&1
    echo "✅ Test container cleaned up"
else
    echo "❌ Test Redis container failed to start"
    echo "Checking container logs..."
    docker logs redis-test
    docker rm redis-test >/dev/null 2>&1
fi

# Check system resources
echo ""
echo "💾 Checking system resources..."
echo "Memory usage:"
free -h 2>/dev/null || echo "Memory info not available"
echo ""
echo "Disk usage:"
df -h | head -2

# Check for port conflicts
echo ""
echo "🔌 Checking port 6379 availability..."
if command -v netstat >/dev/null 2>&1; then
    PORT_CHECK=$(netstat -ln | grep ":6379" || echo "Port 6379 is available")
    echo "$PORT_CHECK"
elif command -v lsof >/dev/null 2>&1; then
    PORT_CHECK=$(lsof -i :6379 || echo "Port 6379 is available")
    echo "$PORT_CHECK"
else
    echo "Cannot check port status (netstat/lsof not available)"
fi

# Provide recommendations
echo ""
echo "💡 Recommendations:"
echo "==================="
echo "1. Use docker-compose.override.yml for production-specific Redis config"
echo "2. Ensure Redis password is consistent across all services"
echo "3. Use hardcoded passwords instead of environment variables in Redis command"
echo "4. Increase healthcheck intervals and start_period for Redis"
echo "5. Check easypanel logs for more specific error details"

echo ""
echo "🚀 Next steps:"
echo "1. Push updated docker-compose files to repository"
echo "2. Redeploy in easypanel"
echo "3. Monitor container startup order: postgres -> redis -> db-init -> app"

echo ""
echo "✅ Redis diagnosis completed!"