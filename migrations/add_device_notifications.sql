-- Migration: Add notification settings to devices table
-- Created: 2025-07-07
-- Purpose: Add enable_notifications column to control device notification preferences

BEGIN;

-- Add enable_notifications column to devices table (default: true)
ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS enable_notifications BOOLEAN DEFAULT true;

-- Add index for performance when querying devices with notifications enabled
CREATE INDEX IF NOT EXISTS idx_devices_notifications 
ON devices(enable_notifications) 
WHERE enable_notifications = true;

-- Update existing devices to have notifications enabled by default
UPDATE devices 
SET enable_notifications = true 
WHERE enable_notifications IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN devices.enable_notifications IS 'Whether to send notifications when this device is controlled (ON/OFF/etc)';

COMMIT;