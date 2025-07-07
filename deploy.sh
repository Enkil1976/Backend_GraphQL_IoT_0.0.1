#!/bin/bash

# Deployment script for VPS - Automatic database setup
# This script ensures complete database initialization during deployment

set -e

echo "🚀 Starting IoT GraphQL Backend deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed or not in PATH"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed or not in PATH"
    exit 1
fi

# Use appropriate docker compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

print_status "Using $DOCKER_COMPOSE for deployment"

# Stop existing containers
echo "🛑 Stopping existing containers..."
$DOCKER_COMPOSE down --remove-orphans || true

# Remove old images to force rebuild
echo "🔄 Cleaning up old images..."
docker system prune -f || true

# Build and start services
echo "🔨 Building and starting services..."
$DOCKER_COMPOSE up --build -d postgres redis

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 15

# Initialize database
echo "🗄️  Initializing database..."
$DOCKER_COMPOSE up --build db-init

# Check if database initialization was successful
if [ $? -eq 0 ]; then
    print_status "Database initialized successfully"
else
    print_error "Database initialization failed"
    $DOCKER_COMPOSE logs db-init
    exit 1
fi

# Start the main application
echo "🚀 Starting main application..."
$DOCKER_COMPOSE up --build -d app

# Wait for application to be ready
echo "⏳ Waiting for application to start..."
sleep 10

# Check application health
echo "🏥 Checking application health..."
for i in {1..30}; do
    if docker exec $(docker ps -q -f name=app) node healthcheck.js &> /dev/null; then
        print_status "Application is healthy and ready!"
        break
    elif [ $i -eq 30 ]; then
        print_error "Application failed to become healthy"
        $DOCKER_COMPOSE logs app
        exit 1
    else
        echo "⏳ Health check attempt $i/30..."
        sleep 5
    fi
done

# Show running containers
echo "📋 Deployment status:"
$DOCKER_COMPOSE ps

# Show application logs
echo "📝 Recent application logs:"
$DOCKER_COMPOSE logs --tail=20 app

print_status "🎉 Deployment completed successfully!"
echo ""
echo "📊 Service Information:"
echo "   - GraphQL API: http://localhost:4001/graphql"
echo "   - Health Check: http://localhost:4001/health"
echo "   - PGAdmin: http://localhost:5050"
echo ""
echo "🔧 Management Commands:"
echo "   - View logs: $DOCKER_COMPOSE logs -f app"
echo "   - Restart: $DOCKER_COMPOSE restart app"
echo "   - Stop: $DOCKER_COMPOSE down"
echo "   - Database shell: $DOCKER_COMPOSE exec postgres psql -U postgres -d invernadero_iot"