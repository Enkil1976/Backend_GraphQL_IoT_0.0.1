-- Quick fix for VPS database - Add missing description column
-- Run this command on your VPS:
-- docker exec -i <postgres_container> psql -U postgres -d iot_greenhouse < quick_fix_vps.sql

-- Add the missing description column to devices table
ALTER TABLE devices ADD COLUMN IF NOT EXISTS description TEXT;

-- Add other potentially missing columns
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_id VARCHAR(50);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS room VARCHAR(50);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS configuration JSONB DEFAULT '{}';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS owner_user_id INTEGER;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE devices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE devices ADD COLUMN IF NOT EXISTS created_by INTEGER;

-- Create missing indexes
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_room ON devices(room);
CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);

-- Update existing devices with default values
UPDATE devices SET configuration = '{"auto_mode": false, "schedule": null}' WHERE configuration IS NULL OR configuration = '{}';
UPDATE devices SET created_at = NOW() WHERE created_at IS NULL;
UPDATE devices SET updated_at = NOW() WHERE updated_at IS NULL;

-- Verify the fix
SELECT 'Database fix completed' as status;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'devices' ORDER BY ordinal_position;