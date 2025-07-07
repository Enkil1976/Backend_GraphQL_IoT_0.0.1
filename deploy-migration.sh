#!/bin/bash

# Database Migration Script for VPS Deployment
# This script fixes the database schema issues on production

echo "🚀 Starting database migration for production VPS..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if PostgreSQL container is running
if ! docker ps | grep -q postgres; then
    echo "❌ PostgreSQL container is not running. Starting containers..."
    docker compose up -d postgres
    sleep 10
fi

# Get PostgreSQL container name
POSTGRES_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -1)
if [ -z "$POSTGRES_CONTAINER" ]; then
    echo "❌ PostgreSQL container not found. Please check your docker-compose.yml"
    exit 1
fi

echo "📋 Found PostgreSQL container: $POSTGRES_CONTAINER"

# Run the migration script
echo "🔧 Running database migration..."
docker exec -i $POSTGRES_CONTAINER psql -U postgres -d iot_greenhouse << 'EOF'
-- Complete database migration script for production VPS
-- This script will add all missing columns and tables to match the current schema

-- 1. Fix devices table - Add missing columns
ALTER TABLE devices ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_id VARCHAR(50);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS room VARCHAR(50);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS configuration JSONB DEFAULT '{}';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS owner_user_id INTEGER;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE devices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE devices ADD COLUMN IF NOT EXISTS created_by INTEGER;

-- 2. Create missing indexes for devices table
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_room ON devices(room);
CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);

-- 3. Create rule_executions table if it doesn't exist
CREATE TABLE IF NOT EXISTS rule_executions (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT false,
    execution_time_ms INTEGER DEFAULT 0,
    
    -- Context and evaluation data
    trigger_data JSONB,
    evaluation_result JSONB,
    actions_executed JSONB,
    
    -- Error information
    error_message TEXT,
    stack_trace TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create indexes for rule_executions
CREATE INDEX IF NOT EXISTS idx_rule_executions_rule_id ON rule_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_executions_triggered_at ON rule_executions(triggered_at);
CREATE INDEX IF NOT EXISTS idx_rule_executions_success ON rule_executions(success);
CREATE INDEX IF NOT EXISTS idx_rule_executions_rule_triggered ON rule_executions(rule_id, triggered_at DESC);

-- 5. Create user_configurations table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_configurations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    config_key VARCHAR(100) NOT NULL,
    config_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, config_key)
);

-- 6. Create indexes for user_configurations
CREATE INDEX IF NOT EXISTS idx_user_configurations_user_id ON user_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_configurations_key ON user_configurations(config_key);

-- 7. Update existing devices with device_id values if they don't have them
UPDATE devices SET device_id = 'ventilador_01' WHERE name = 'Ventilador de Circulación' AND (device_id IS NULL OR device_id = '');
UPDATE devices SET device_id = 'bomba_agua_01' WHERE name = 'Bomba de Agua Principal' AND (device_id IS NULL OR device_id = '');
UPDATE devices SET device_id = 'calefactor_01' WHERE name = 'Calefactor Nocturno' AND (device_id IS NULL OR device_id = '');
UPDATE devices SET device_id = 'calefactor_agua_01' WHERE name = 'Calefactor de Agua' AND (device_id IS NULL OR device_id = '');
UPDATE devices SET device_id = 'led_grow_01' WHERE name LIKE '%LED%' AND (device_id IS NULL OR device_id = '');

-- 8. Update existing devices with default configurations if they don't have them
UPDATE devices SET configuration = '{"auto_mode": false, "schedule": null}' WHERE configuration IS NULL OR configuration = '{}';

-- 9. Update existing devices with timestamps if they don't have them
UPDATE devices SET created_at = NOW() WHERE created_at IS NULL;
UPDATE devices SET updated_at = NOW() WHERE updated_at IS NULL;

-- 10. Verification - Check devices table structure
SELECT 'Migration completed successfully' as status;

-- Show devices table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'devices' 
ORDER BY ordinal_position;

EOF

if [ $? -eq 0 ]; then
    echo "✅ Database migration completed successfully!"
    echo "🔄 Restarting application containers..."
    
    # Restart the application
    docker compose restart app
    
    echo "✅ Application restarted successfully!"
    echo "🎉 Deployment migration completed!"
else
    echo "❌ Database migration failed. Please check the error messages above."
    exit 1
fi