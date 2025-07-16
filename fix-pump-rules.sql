-- Fix pump rules that are referencing non-existent device ID 6
-- Update them to reference device ID 1 (the legitimate water pump)

-- First, check which rules have device actions pointing to device ID 6
SELECT id, name, actions, enabled 
FROM rules 
WHERE actions::text LIKE '%"deviceId":"6"%';

-- Update the actions to reference device ID 1 instead of 6
UPDATE rules 
SET actions = REPLACE(actions::text, '"deviceId":"6"', '"deviceId":"1"')::jsonb,
    enabled = true,
    updated_at = CURRENT_TIMESTAMP
WHERE actions::text LIKE '%"deviceId":"6"%';

-- Verify the changes
SELECT id, name, actions, enabled 
FROM rules 
WHERE actions::text LIKE '%"deviceId":"1"%' 
AND name LIKE '%BOMBA%';

-- Show all pump-related rules
SELECT id, name, enabled, description
FROM rules 
WHERE name LIKE '%BOMBA%' OR name LIKE '%CICLO%' OR name LIKE '%Riego%'
ORDER BY id;