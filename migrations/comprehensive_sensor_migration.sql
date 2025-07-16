-- Comprehensive Sensor Migration

-- 1. Add missing columns to 'sensors' table
ALTER TABLE sensors ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE sensors ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE;
ALTER TABLE sensors ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE sensors ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE sensors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE sensors ADD COLUMN IF NOT EXISTS configuration JSONB DEFAULT '{}';

-- 2. Drop old sensor data tables if they exist
DROP TABLE IF EXISTS temhum1;
DROP TABLE IF EXISTS temhum2;
DROP TABLE IF EXISTS calidad_agua;
DROP TABLE IF EXISTS luxometro;
