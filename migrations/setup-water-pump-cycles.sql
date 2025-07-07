-- Water Pump Cycling System Migration
-- Configures automated 15-minute ON/OFF cycles for water pump
-- This migration sets up 4 rules that create a continuous cycling pattern

-- First, clean up any existing pump cycle rules to avoid conflicts
DELETE FROM rules 
WHERE name LIKE '%CICLO%' 
AND name LIKE '%Bomba%';

-- Create the water pump cycling rules
-- Rule 1: Turn pump ON during minutes 0-15 of every 30-minute cycle
INSERT INTO rules (
  name, 
  description, 
  enabled, 
  priority, 
  cooldown_minutes, 
  conditions, 
  actions, 
  created_by, 
  created_at, 
  updated_at
) VALUES (
  'CICLO: Bomba ON (minutos 00-15)',
  'Enciende bomba de agua durante los primeros 15 minutos de cada media hora (00-15 y 30-45)',
  true,
  9,
  5,
  '{"operator": "AND", "rules": [{"type": "TIME", "timeStart": "00:00", "timeEnd": "00:15"}]}',
  '[{"type": "DEVICE_CONTROL", "deviceId": "1", "action": "TURN_ON"}]',
  1,
  NOW(),
  NOW()
);

-- Rule 2: Turn pump OFF during minutes 15-30 of every 30-minute cycle  
INSERT INTO rules (
  name, 
  description, 
  enabled, 
  priority, 
  cooldown_minutes, 
  conditions, 
  actions, 
  created_by, 
  created_at, 
  updated_at
) VALUES (
  'CICLO: Bomba OFF (minutos 15-30)',
  'Apaga bomba de agua durante los minutos 15-30 y 45-00 de cada media hora',
  true,
  9,
  5,
  '{"operator": "AND", "rules": [{"type": "TIME", "timeStart": "00:15", "timeEnd": "00:30"}]}',
  '[{"type": "DEVICE_CONTROL", "deviceId": "1", "action": "TURN_OFF"}]',
  1,
  NOW(),
  NOW()
);

-- Rule 3: Turn pump ON during minutes 30-45 of every 30-minute cycle
INSERT INTO rules (
  name, 
  description, 
  enabled, 
  priority, 
  cooldown_minutes, 
  conditions, 
  actions, 
  created_by, 
  created_at, 
  updated_at
) VALUES (
  'CICLO: Bomba ON (minutos 30-45)',
  'Enciende bomba de agua durante los minutos 30-45 de cada hora',
  true,
  9,
  5,
  '{"operator": "AND", "rules": [{"type": "TIME", "timeStart": "00:30", "timeEnd": "00:45"}]}',
  '[{"type": "DEVICE_CONTROL", "deviceId": "1", "action": "TURN_ON"}]',
  1,
  NOW(),
  NOW()
);

-- Rule 4: Turn pump OFF during minutes 45-00 of every 30-minute cycle
INSERT INTO rules (
  name, 
  description, 
  enabled, 
  priority, 
  cooldown_minutes, 
  conditions, 
  actions, 
  created_by, 
  created_at, 
  updated_at
) VALUES (
  'CICLO: Bomba OFF (minutos 45-00)',
  'Apaga bomba de agua durante los minutos 45-00 de cada hora',
  true,
  9,
  5,
  '{"operator": "AND", "rules": [{"type": "TIME", "timeStart": "00:45", "timeEnd": "23:59"}]}',
  '[{"type": "DEVICE_CONTROL", "deviceId": "1", "action": "TURN_OFF"}]',
  1,
  NOW(),
  NOW()
);

-- Verify the rules were created successfully
SELECT 
  id,
  name,
  enabled,
  priority,
  cooldown_minutes,
  conditions,
  actions,
  created_at
FROM rules 
WHERE name LIKE '%CICLO%' 
AND name LIKE '%Bomba%'
ORDER BY name;

-- Display summary
SELECT 
  COUNT(*) as total_pump_rules,
  SUM(CASE WHEN enabled = true THEN 1 ELSE 0 END) as enabled_rules,
  SUM(CASE WHEN priority = 9 THEN 1 ELSE 0 END) as high_priority_rules
FROM rules 
WHERE name LIKE '%CICLO%' 
AND name LIKE '%Bomba%';

-- Create a comment record for documentation
COMMENT ON TABLE rules IS 'Automation rules for IoT device control and notifications. Water pump cycling implemented via 4 time-based rules with 15-minute ON/OFF pattern.';