#!/bin/sh

# Docker entrypoint script for robust database initialization and app startup
set -e

echo "🚀 Starting IoT GraphQL Backend..."

# Function to wait for database
wait_for_db() {
    echo "⏳ Waiting for database to be ready..."
    
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DATABASE" > /dev/null 2>&1; then
            echo "✅ Database is ready!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo "⏳ Database not ready yet (attempt $attempt/$max_attempts). Retrying in 2s..."
        sleep 2
    done
    
    echo "❌ Database failed to become ready after $max_attempts attempts"
    exit 1
}

# Function to wait for Redis
wait_for_redis() {
    echo "⏳ Waiting for Redis to be ready..."
    
    max_attempts=20
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" ping > /dev/null 2>&1; then
            echo "✅ Redis is ready!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo "⏳ Redis not ready yet (attempt $attempt/$max_attempts). Retrying in 2s..."
        sleep 2
    done
    
    echo "❌ Redis failed to become ready after $max_attempts attempts"
    exit 1
}

# Function to initialize database
init_database() {
    echo "🗄️  Initializing database..."
    
    if node init-database.js; then
        echo "✅ Database initialization completed successfully!"
        
        # Verify database deployment
        echo "🔍 Verifying database deployment..."
        if [ -f "verify-database-deploy.js" ]; then
            if node verify-database-deploy.js; then
                echo "✅ Database verification passed!"
                return 0
            else
                echo "⚠️ Database verification had warnings, but proceeding..."
                return 0
            fi
        else
            echo "⚠️ Database verification script not found, skipping..."
            return 0
        fi
    else
        echo "❌ Database initialization failed!"
        exit 1
    fi
}

# Function to start application
start_application() {
    echo "🚀 Starting application..."
    
    # Check if we're running the db-init service
    if [ "$1" = "init-db" ]; then
        init_database
        exit 0
    fi
    
    # For main app, wait for dependencies and start
    wait_for_db
    wait_for_redis
    
    # Start the application
    exec node src/server.js
}

# Main execution
case "$1" in
    "init-db")
        wait_for_db
        init_database
        ;;
    *)
        start_application "$@"
        ;;
esac