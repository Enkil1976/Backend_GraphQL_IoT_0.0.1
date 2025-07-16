-- Create Missing Sensor Tables
-- This script creates the sensor tables that are expected by the sensorService but don't exist in the database

-- 1. Create luxometro table (light sensor data)
-- The service expects 'luxometro' but init-database.js creates 'sensor_data_luxometro'
CREATE TABLE IF NOT EXISTS luxometro (
    id SERIAL PRIMARY KEY,
    light DECIMAL(10,2),
    white_light DECIMAL(10,2),
    raw_light DECIMAL(10,2),
    rssi INTEGER,
    boot INTEGER DEFAULT 0,
    mem INTEGER DEFAULT 0,
    
    -- Statistics fields expected by the service
    lmin DECIMAL(10,2),
    lmax DECIMAL(10,2),
    lavg DECIMAL(10,2),
    wmin DECIMAL(10,2),
    wmax DECIMAL(10,2),
    wavg DECIMAL(10,2),
    total INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create power_monitor_logs table (power consumption data)
CREATE TABLE IF NOT EXISTS power_monitor_logs (
    id SERIAL PRIMARY KEY,
    device_hardware_id VARCHAR(50) NOT NULL,
    device_id INTEGER REFERENCES devices(id),
    
    -- Power measurements
    watts DECIMAL(8,2),
    voltage DECIMAL(6,2),
    current DECIMAL(6,2),
    frequency DECIMAL(4,1),
    power_factor DECIMAL(4,3),
    
    -- Device status
    rssi INTEGER,
    mem INTEGER DEFAULT 0,
    boot INTEGER DEFAULT 0,
    
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_luxometro_received_at ON luxometro(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_luxometro_light ON luxometro(light);
CREATE INDEX IF NOT EXISTS idx_luxometro_rssi ON luxometro(rssi);

CREATE INDEX IF NOT EXISTS idx_power_monitor_logs_device_hardware_id ON power_monitor_logs(device_hardware_id);
CREATE INDEX IF NOT EXISTS idx_power_monitor_logs_device_id ON power_monitor_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_power_monitor_logs_received_at ON power_monitor_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_power_monitor_logs_watts ON power_monitor_logs(watts);

-- 4. Add table comments
COMMENT ON TABLE luxometro IS 'Light sensor data with lux, white light, and raw light measurements';
COMMENT ON TABLE power_monitor_logs IS 'Power consumption monitoring data for IoT devices';

-- 5. Create views to unify old and new sensor tables if needed
-- This allows backward compatibility if sensor_data_luxometro has existing data

-- Create a view that combines data from both tables (if sensor_data_luxometro exists)
CREATE OR REPLACE VIEW unified_luxometro AS
SELECT 
    id,
    lux as light,
    NULL::DECIMAL(10,2) as white_light,
    NULL::DECIMAL(10,2) as raw_light,
    NULL::INTEGER as rssi,
    0 as boot,
    0 as mem,
    NULL::DECIMAL(10,2) as lmin,
    NULL::DECIMAL(10,2) as lmax,
    NULL::DECIMAL(10,2) as lavg,
    NULL::DECIMAL(10,2) as wmin,
    NULL::DECIMAL(10,2) as wmax,
    NULL::DECIMAL(10,2) as wavg,
    0 as total,
    0 as errors,
    timestamp as received_at,
    timestamp as created_at
FROM sensor_data_luxometro
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sensor_data_luxometro')

UNION ALL

SELECT 
    id,
    light,
    white_light,
    raw_light,
    rssi,
    boot,
    mem,
    lmin,
    lmax,
    lavg,
    wmin,
    wmax,
    wavg,
    total,
    errors,
    received_at,
    created_at
FROM luxometro;

-- 6. Insert sample data for testing (optional)
-- Uncomment the following lines to add test data

/*
INSERT INTO luxometro (light, white_light, raw_light, rssi, lmin, lmax, lavg, wmin, wmax, wavg, total, errors) VALUES
(1500.0, 1200.0, 1800.0, -45, 1400.0, 1600.0, 1500.0, 1100.0, 1300.0, 1200.0, 100, 0),
(1520.0, 1220.0, 1820.0, -42, 1420.0, 1620.0, 1520.0, 1120.0, 1320.0, 1220.0, 101, 0),
(1480.0, 1180.0, 1780.0, -48, 1380.0, 1580.0, 1480.0, 1080.0, 1280.0, 1180.0, 102, 1);

INSERT INTO power_monitor_logs (device_hardware_id, watts, voltage, current, frequency, power_factor, rssi) VALUES
('pump_01', 150.5, 220.0, 0.68, 50.0, 0.95, -35),
('heater_01', 500.2, 220.0, 2.27, 50.0, 0.98, -40),
('fan_01', 75.8, 220.0, 0.34, 50.0, 0.92, -38);
*/

-- 7. Verification queries
SELECT 'Missing sensor tables created successfully' as status;

-- Check table structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('luxometro', 'power_monitor_logs')
ORDER BY table_name, ordinal_position;

-- Count existing records
SELECT 
    'luxometro' as table_name,
    COUNT(*) as record_count
FROM luxometro
UNION ALL
SELECT 
    'power_monitor_logs' as table_name,
    COUNT(*) as record_count
FROM power_monitor_logs;