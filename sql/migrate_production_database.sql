-- Complete database migration script for production VPS
-- This script will add all missing columns and tables to match the current schema

-- 1. Fix devices table - Add missing columns
ALTER TABLE devices ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_id VARCHAR(50) UNIQUE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS room VARCHAR(50);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS configuration JSONB DEFAULT '{}';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE devices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE devices ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- 2. Create missing indexes for devices table
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_room ON devices(room);
CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);

-- 3. Create rule_executions table if it doesn't exist
CREATE TABLE IF NOT EXISTS rule_executions (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
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
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    config_key VARCHAR(100) NOT NULL,
    config_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, config_key)
);

-- 6. Create indexes for user_configurations
CREATE INDEX IF NOT EXISTS idx_user_configurations_user_id ON user_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_configurations_key ON user_configurations(config_key);

-- 7. Create notification_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS notification_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    template_content TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    template_type VARCHAR(50) DEFAULT 'general',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create indexes for notification_templates
CREATE INDEX IF NOT EXISTS idx_notification_templates_name ON notification_templates(name);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(template_type);

-- 9. Create operations_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS operations_log (
    id SERIAL PRIMARY KEY,
    operation_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    operation_data JSONB DEFAULT '{}',
    user_id INTEGER REFERENCES users(id),
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Create indexes for operations_log
CREATE INDEX IF NOT EXISTS idx_operations_log_type ON operations_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_operations_log_entity ON operations_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_operations_log_user_id ON operations_log(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_log_created_at ON operations_log(created_at DESC);

-- 11. Update existing devices with device_id values if they don't have them
UPDATE devices SET device_id = 'ventilador_01' WHERE name = 'Ventilador de Circulación' AND (device_id IS NULL OR device_id = '');
UPDATE devices SET device_id = 'bomba_agua_01' WHERE name = 'Bomba de Agua Principal' AND (device_id IS NULL OR device_id = '');
UPDATE devices SET device_id = 'calefactor_01' WHERE name = 'Calefactor Nocturno' AND (device_id IS NULL OR device_id = '');
UPDATE devices SET device_id = 'calefactor_agua_01' WHERE name = 'Calefactor de Agua' AND (device_id IS NULL OR device_id = '');
UPDATE devices SET device_id = 'led_grow_01' WHERE name LIKE '%LED%' AND (device_id IS NULL OR device_id = '');

-- 12. Update existing devices with default configurations if they don't have them
UPDATE devices SET configuration = '{"auto_mode": false, "schedule": null}' WHERE configuration IS NULL OR configuration = '{}';

-- 13. Update existing devices with timestamps if they don't have them
UPDATE devices SET created_at = NOW() WHERE created_at IS NULL;
UPDATE devices SET updated_at = NOW() WHERE updated_at IS NULL;

-- 14. Add table comments for documentation
COMMENT ON TABLE rule_executions IS 'Stores the execution history and results of automation rules';
COMMENT ON TABLE user_configurations IS 'User-specific configuration settings';
COMMENT ON TABLE notification_templates IS 'Templates for notification messages';
COMMENT ON TABLE operations_log IS 'Audit log for all system operations and changes';

-- 15. Verification queries
SELECT 'Database Migration Complete' as status;

-- Check devices table structure
SELECT 
    'devices' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'devices' 
ORDER BY ordinal_position;

-- Check all tables exist
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;