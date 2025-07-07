-- Fix devices table - Add missing description column
-- Run this script to add the description column to the devices table

-- Add description column if it doesn't exist
ALTER TABLE devices ADD COLUMN IF NOT EXISTS description TEXT;

-- Add other potentially missing columns for devices table
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_id VARCHAR(50) UNIQUE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS room VARCHAR(50);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS configuration JSONB DEFAULT '{}';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE devices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE devices ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- Create missing indexes
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_room ON devices(room);
CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);

-- Update existing devices with device_id values if they don't have them
UPDATE devices SET device_id = 'ventilador_01' WHERE name = 'Ventilador de Circulación' AND (device_id IS NULL OR device_id = '');
UPDATE devices SET device_id = 'bomba_agua_01' WHERE name = 'Bomba de Agua Principal' AND (device_id IS NULL OR device_id = '');
UPDATE devices SET device_id = 'calefactor_01' WHERE name = 'Calefactor Nocturno' AND (device_id IS NULL OR device_id = '');
UPDATE devices SET device_id = 'calefactor_agua_01' WHERE name = 'Calefactor de Agua' AND (device_id IS NULL OR device_id = '');
UPDATE devices SET device_id = 'led_grow_01' WHERE name LIKE '%LED%' AND (device_id IS NULL OR device_id = '');

-- Update existing devices with default configurations if they don't have them
UPDATE devices SET configuration = '{"auto_mode": false, "schedule": null}' WHERE configuration IS NULL OR configuration = '{}';

-- Update existing devices with timestamps if they don't have them
UPDATE devices SET created_at = NOW() WHERE created_at IS NULL;
UPDATE devices SET updated_at = NOW() WHERE updated_at IS NULL;

-- Verify the columns were added
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'devices' 
ORDER BY ordinal_position;

-- Show current devices
SELECT id, name, device_id, type, description, room, status FROM devices ORDER BY id;