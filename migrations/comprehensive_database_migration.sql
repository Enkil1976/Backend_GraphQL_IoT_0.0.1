-- Comprehensive Database Migration for Clean Deployment
-- Description: Fixes all identified schema inconsistencies and missing columns/tables
-- Date: 2025-07-10
-- Version: 2.0.0

-- ==============================================================================
-- 1. SCHEMA VERSION TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS schema_version (
    id SERIAL PRIMARY KEY,
    version INTEGER NOT NULL UNIQUE,
    description TEXT,
    checksum VARCHAR(64),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 2. USERS TABLE - Base table with all required columns
-- ==============================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 3. DEVICES TABLE - Enhanced with all required columns
-- ==============================================================================
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    location VARCHAR(100),
    room VARCHAR(50),
    device_id VARCHAR(50) UNIQUE,
    status VARCHAR(20) DEFAULT 'offline',
    configuration JSONB DEFAULT '{}',
    enable_notifications BOOLEAN DEFAULT true,
    owner_user_id INTEGER REFERENCES users(id),
    is_public BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id)
);

-- Add missing columns to existing devices table
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

-- ==============================================================================
-- 4. NOTIFICATIONS TABLE - Complete schema with all columns
-- ==============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO_MESSAGE',
    priority VARCHAR(20) DEFAULT 'medium',
    channels TEXT DEFAULT 'webhook',
    status VARCHAR(20) DEFAULT 'pending',
    user_id INTEGER REFERENCES users(id),
    source VARCHAR(50) DEFAULT 'SYSTEM',
    source_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    read_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to existing notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'SYSTEM';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source_id VARCHAR(100);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'INFO_MESSAGE';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ==============================================================================
-- 5. RULES TABLE - Enhanced with all required columns
-- ==============================================================================
CREATE TABLE IF NOT EXISTS rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    condition_type VARCHAR(50) NOT NULL,
    condition_value JSONB NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    action_value JSONB NOT NULL,
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 6. RULE EXECUTIONS TABLE - Track rule execution history
-- ==============================================================================
CREATE TABLE IF NOT EXISTS rule_executions (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT false,
    execution_time_ms INTEGER DEFAULT 0,
    trigger_data JSONB,
    evaluation_result JSONB,
    actions_executed JSONB,
    error_message TEXT,
    stack_trace TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 7. SENSOR DATA TABLES - Add hardware_id columns
-- ==============================================================================

-- Legacy sensor tables maintained for historical data compatibility
-- New sensor data will use sensor_data_generic table

-- temhum1 table (historical data only)
CREATE TABLE IF NOT EXISTS temhum1 (
    id SERIAL PRIMARY KEY,
    temperatura DECIMAL(5,2) NOT NULL,
    humedad DECIMAL(5,2) NOT NULL CHECK (humedad >= 0 AND humedad <= 100),
    heatindex DECIMAL(5,2),
    dewpoint DECIMAL(5,2),
    rssi INTEGER,
    boot INTEGER DEFAULT 0,
    mem INTEGER,
    hardware_id VARCHAR(100),
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- temhum2 table (historical data only)
CREATE TABLE IF NOT EXISTS temhum2 (
    id SERIAL PRIMARY KEY,
    temperatura DECIMAL(5,2) NOT NULL,
    humedad DECIMAL(5,2) NOT NULL CHECK (humedad >= 0 AND humedad <= 100),
    heatindex DECIMAL(5,2),
    dewpoint DECIMAL(5,2),
    rssi INTEGER,
    boot INTEGER DEFAULT 0,
    mem INTEGER,
    hardware_id VARCHAR(100),
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- calidad_agua table (historical data only)
CREATE TABLE IF NOT EXISTS calidad_agua (
    id SERIAL PRIMARY KEY,
    ph DECIMAL(4,2) NOT NULL,
    ec DECIMAL(8,2) NOT NULL,
    ppm DECIMAL(8,2) NOT NULL,
    temperatura_agua DECIMAL(5,2),
    rssi INTEGER,
    boot INTEGER DEFAULT 0,
    mem INTEGER,
    hardware_id VARCHAR(100),
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- luxometro table (historical data only)
CREATE TABLE IF NOT EXISTS luxometro (
    id SERIAL PRIMARY KEY,
    light DECIMAL(10,2) NOT NULL,
    white_light DECIMAL(10,2),
    raw_light DECIMAL(10,2),
    rssi INTEGER,
    boot INTEGER DEFAULT 0,
    mem INTEGER,
    hardware_id VARCHAR(100),
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- temp_pressure_data table (historical data only)
CREATE TABLE IF NOT EXISTS temp_pressure_data (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(100) NOT NULL,
    temperatura DECIMAL(5,2) NOT NULL,
    presion DECIMAL(7,2) NOT NULL,
    altitude DECIMAL(7,2),
    rssi INTEGER,
    boot INTEGER DEFAULT 0,
    mem INTEGER,
    hardware_id VARCHAR(100),
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- power_monitor_logs table (historical data only)
CREATE TABLE IF NOT EXISTS power_monitor_logs (
    id SERIAL PRIMARY KEY,
    voltage DECIMAL(6,2) NOT NULL,
    current DECIMAL(6,2) NOT NULL,
    watts DECIMAL(8,2) NOT NULL,
    device_hardware_id VARCHAR(100),
    monitors_device_id VARCHAR(100),
    rssi INTEGER,
    boot INTEGER DEFAULT 0,
    mem INTEGER,
    hardware_id VARCHAR(100),
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add hardware_id columns to existing tables
ALTER TABLE temhum1 ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);
ALTER TABLE temhum2 ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);
ALTER TABLE calidad_agua ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);
ALTER TABLE luxometro ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);
ALTER TABLE temp_pressure_data ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);
ALTER TABLE power_monitor_logs ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);

-- ==============================================================================
-- 8. DYNAMIC SENSOR TABLES - Support for flexible sensor types
-- ==============================================================================

-- Main sensors registry table with complete structure
CREATE TABLE IF NOT EXISTS sensors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    sensor_type VARCHAR(50) NOT NULL,
    hardware_id VARCHAR(100) NOT NULL,
    mqtt_topic VARCHAR(200) NOT NULL,
    location VARCHAR(200),
    description TEXT,
    configuration JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sensors_hardware_id_unique UNIQUE (hardware_id)
);

-- Add missing columns to existing sensors table
ALTER TABLE sensors ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
ALTER TABLE sensors ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE;
ALTER TABLE sensors ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE sensors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Generic sensor data table with normalized structure
CREATE TABLE IF NOT EXISTS sensor_data_generic (
    id SERIAL PRIMARY KEY,
    sensor_id INTEGER NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dynamic sensor tables are no longer needed - all data goes to sensor_data_generic
-- Tables maintained for historical data compatibility but no longer used for new data

-- ==============================================================================
-- 9. WEATHER AND ADDITIONAL TABLES
-- ==============================================================================

-- Weather table
CREATE TABLE IF NOT EXISTS weather_current (
    id SERIAL PRIMARY KEY,
    temperature DECIMAL(5,2),
    humidity DECIMAL(5,2),
    pressure DECIMAL(7,2),
    description TEXT,
    wind_speed DECIMAL(5,2),
    wind_direction INTEGER,
    visibility DECIMAL(5,2),
    uv_index DECIMAL(3,1),
    air_quality_index INTEGER,
    pm25 DECIMAL(6,2),
    pm10 DECIMAL(6,2),
    co DECIMAL(8,2),
    no2 DECIMAL(8,2),
    so2 DECIMAL(8,2),
    o3 DECIMAL(8,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Operations log table
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

-- User configurations table
CREATE TABLE IF NOT EXISTS user_configurations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    config_key VARCHAR(100) NOT NULL,
    config_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, config_key)
);

-- ==============================================================================
-- 10. INDEXES FOR PERFORMANCE
-- ==============================================================================

-- Devices indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_type ON devices(type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_owner ON devices(owner_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_room ON devices(room);

-- Notifications indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);

-- Rules indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rules_enabled ON rules(enabled);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rules_priority ON rules(priority);

-- Rule executions indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rule_executions_rule_id ON rule_executions(rule_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rule_executions_triggered_at ON rule_executions(triggered_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rule_executions_success ON rule_executions(success);

-- Sensor data indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_temhum1_received_at ON temhum1(received_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_temhum1_hardware_id ON temhum1(hardware_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_temhum2_received_at ON temhum2(received_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_temhum2_hardware_id ON temhum2(hardware_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calidad_agua_received_at ON calidad_agua(received_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calidad_agua_hardware_id ON calidad_agua(hardware_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_luxometro_received_at ON luxometro(received_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_luxometro_hardware_id ON luxometro(hardware_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_temp_pressure_data_received_at ON temp_pressure_data(received_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_temp_pressure_data_hardware_id ON temp_pressure_data(hardware_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_power_monitor_logs_received_at ON power_monitor_logs(received_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_power_monitor_logs_hardware_id ON power_monitor_logs(hardware_id);

-- Dynamic sensor indexes for normalized architecture
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensors_sensor_type ON sensors(sensor_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensors_is_active ON sensors(is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensors_hardware_id ON sensors(hardware_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensors_is_online ON sensors(is_online);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensors_created_at ON sensors(created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensor_data_generic_sensor_id ON sensor_data_generic(sensor_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensor_data_generic_received_at ON sensor_data_generic(received_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensor_data_generic_processed_at ON sensor_data_generic(processed_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensor_data_generic_payload_type ON sensor_data_generic USING GIN ((payload->>'_metadata'));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensor_data_generic_payload_data ON sensor_data_generic USING GIN ((payload->'data'));

-- ==============================================================================
-- 11. DATA FIXES AND UPDATES
-- ==============================================================================

-- Update existing devices with device_id values
UPDATE devices SET device_id = 'ventilador_01' WHERE name = 'Ventilador de Circulación' AND (device_id IS NULL OR device_id = '');
UPDATE devices SET device_id = 'bomba_agua_01' WHERE name = 'Bomba de Agua Principal' AND (device_id IS NULL OR device_id = '');
UPDATE devices SET device_id = 'calefactor_01' WHERE name = 'Calefactor Nocturno' AND (device_id IS NULL OR device_id = '');
UPDATE devices SET device_id = 'calefactor_agua_01' WHERE name = 'Calefactor de Agua' AND (device_id IS NULL OR device_id = '');
UPDATE devices SET device_id = 'led_grow_01' WHERE name LIKE '%LED%' AND (device_id IS NULL OR device_id = '');

-- Update devices with default configurations
UPDATE devices SET configuration = '{"auto_mode": false, "schedule": null}' WHERE configuration IS NULL OR configuration = '{}';

-- Update timestamps for existing records
UPDATE devices SET created_at = NOW() WHERE created_at IS NULL;
UPDATE devices SET updated_at = NOW() WHERE updated_at IS NULL;

-- ==============================================================================
-- 11.5. TRIGGERS AND FUNCTIONS
-- ==============================================================================

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_sensor_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for sensors table
CREATE TRIGGER trigger_update_sensor_timestamp
    BEFORE UPDATE ON sensors
    FOR EACH ROW
    EXECUTE FUNCTION update_sensor_timestamp();

-- ==============================================================================
-- 12. TABLE COMMENTS FOR DOCUMENTATION
-- ==============================================================================

COMMENT ON TABLE devices IS 'Physical devices in the greenhouse system';
COMMENT ON TABLE notifications IS 'System notifications and alerts';
COMMENT ON TABLE rules IS 'Automation rules for device control';
COMMENT ON TABLE rule_executions IS 'Execution history of automation rules';
COMMENT ON TABLE sensors IS 'Dynamic sensor registry and configuration';
COMMENT ON TABLE operations_log IS 'Audit log for all system operations';
COMMENT ON TABLE weather_current IS 'Current weather conditions and air quality';

-- Column comments
COMMENT ON COLUMN devices.device_id IS 'Unique identifier for device control';
COMMENT ON COLUMN notifications.read_at IS 'Timestamp when notification was read';
COMMENT ON COLUMN temp_pressure_data.hardware_id IS 'Hardware identifier for the sensor device';
COMMENT ON COLUMN luxometro.hardware_id IS 'Hardware identifier for the sensor device';

-- ==============================================================================
-- 13. RECORD MIGRATION VERSION
-- ==============================================================================

INSERT INTO schema_version (version, description) 
VALUES (2000, 'Comprehensive database migration for clean deployment')
ON CONFLICT (version) DO NOTHING;

-- Additional migration to fix sensors table columns
INSERT INTO schema_version (version, description) 
VALUES (2001, 'Fix sensors table missing columns')
ON CONFLICT (version) DO NOTHING;

-- ==============================================================================
-- 14. VERIFICATION QUERIES
-- ==============================================================================

-- Verify all critical tables exist
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Verify critical columns exist
SELECT 
    'notifications' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'notifications' 
AND column_name IN ('read_at', 'sent_at', 'source', 'metadata')
ORDER BY column_name;

-- Verify hardware_id columns exist
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE column_name = 'hardware_id' 
AND table_name IN ('temp_pressure_data', 'luxometro', 'calidad_agua', 'power_monitor_logs')
ORDER BY table_name;

SELECT 'Comprehensive database migration completed successfully' AS result;