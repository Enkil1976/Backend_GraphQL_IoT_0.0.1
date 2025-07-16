-- Migration: Add hardware_id columns to sensor data tables
-- Description: Adds hardware_id column to sensor data tables for consistency with dynamic sensor service
-- Date: 2025-07-10

-- Add hardware_id column to temp_pressure_data table
ALTER TABLE temp_pressure_data 
ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);

-- Add hardware_id column to luxometro table
ALTER TABLE luxometro 
ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);

-- Add hardware_id column to calidad_agua table
ALTER TABLE calidad_agua 
ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);

-- Add hardware_id column to power_monitor_logs table (if not exists)
ALTER TABLE power_monitor_logs 
ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);

-- Add hardware_id column to temhum1 table
ALTER TABLE temhum1 
ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);

-- Add hardware_id column to temhum2 table
ALTER TABLE temhum2 
ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);

-- Add hardware_id column to temhum_data table
ALTER TABLE temhum_data 
ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);

-- Add hardware_id column to soil_moisture_data table
ALTER TABLE soil_moisture_data 
ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);

-- Add hardware_id column to co2_data table
ALTER TABLE co2_data 
ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);

-- Add hardware_id column to motion_data table
ALTER TABLE motion_data 
ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);

-- Add hardware_id column to custom_sensor_data table
ALTER TABLE custom_sensor_data 
ADD COLUMN IF NOT EXISTS hardware_id VARCHAR(100);

-- Create indexes for hardware_id columns for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_temp_pressure_data_hardware_id 
ON temp_pressure_data(hardware_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_luxometro_hardware_id 
ON luxometro(hardware_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calidad_agua_hardware_id 
ON calidad_agua(hardware_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_power_monitor_logs_hardware_id 
ON power_monitor_logs(hardware_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_temhum1_hardware_id 
ON temhum1(hardware_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_temhum2_hardware_id 
ON temhum2(hardware_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_temhum_data_hardware_id 
ON temhum_data(hardware_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_soil_moisture_data_hardware_id 
ON soil_moisture_data(hardware_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_co2_data_hardware_id 
ON co2_data(hardware_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_motion_data_hardware_id 
ON motion_data(hardware_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_custom_sensor_data_hardware_id 
ON custom_sensor_data(hardware_id);

-- Add comments for documentation
COMMENT ON COLUMN temp_pressure_data.hardware_id IS 'Hardware identifier for the sensor device';
COMMENT ON COLUMN luxometro.hardware_id IS 'Hardware identifier for the sensor device';
COMMENT ON COLUMN calidad_agua.hardware_id IS 'Hardware identifier for the sensor device';
COMMENT ON COLUMN power_monitor_logs.hardware_id IS 'Hardware identifier for the sensor device';
COMMENT ON COLUMN temhum1.hardware_id IS 'Hardware identifier for the sensor device';
COMMENT ON COLUMN temhum2.hardware_id IS 'Hardware identifier for the sensor device';
COMMENT ON COLUMN temhum_data.hardware_id IS 'Hardware identifier for the sensor device';
COMMENT ON COLUMN soil_moisture_data.hardware_id IS 'Hardware identifier for the sensor device';
COMMENT ON COLUMN co2_data.hardware_id IS 'Hardware identifier for the sensor device';
COMMENT ON COLUMN motion_data.hardware_id IS 'Hardware identifier for the sensor device';
COMMENT ON COLUMN custom_sensor_data.hardware_id IS 'Hardware identifier for the sensor device';

-- Update existing records to populate hardware_id from sensor_id if needed
-- This is commented out as it requires specific mapping logic
-- UPDATE temp_pressure_data SET hardware_id = (SELECT hardware_id FROM sensors WHERE sensors.sensor_id = temp_pressure_data.sensor_id);
-- UPDATE luxometro SET hardware_id = (SELECT hardware_id FROM sensors WHERE sensors.sensor_id = luxometro.sensor_id);

SELECT 'Hardware ID columns added successfully to all sensor data tables' AS result;