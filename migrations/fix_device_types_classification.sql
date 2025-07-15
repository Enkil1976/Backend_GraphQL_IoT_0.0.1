-- Migration: Fix Device Types Classification
-- File: migrations/fix_device_types_classification.sql
-- Description: Corrects incorrectly classified device types from autodiscovery
-- Issue: Devices like "ventilador" and "calefactor" were classified as WATER_PUMP
-- Solution: Update device types based on device_id patterns

-- Update ventilador devices (fans) from WATER_PUMP to VENTILATOR
UPDATE devices 
SET 
  type = 'VENTILATOR',
  configuration = COALESCE(configuration, '{}') || jsonb_build_object(
    'migration_applied', 'fix_device_types_classification',
    'original_type', type,
    'corrected_type', 'VENTILATOR',
    'correction_reason', 'device_id pattern: ventilador',
    'correction_date', NOW()::text
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE 
  device_id ILIKE '%ventilador%' 
  AND type = 'WATER_PUMP';

-- Update calefactor devices (heaters) from WATER_PUMP to HEATER
UPDATE devices 
SET 
  type = 'HEATER',
  configuration = COALESCE(configuration, '{}') || jsonb_build_object(
    'migration_applied', 'fix_device_types_classification',
    'original_type', type,
    'corrected_type', 'HEATER',
    'correction_reason', 'device_id pattern: calefactor',
    'correction_date', NOW()::text
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE 
  device_id ILIKE '%calefactor%' 
  AND type = 'WATER_PUMP';

-- Update luz/light devices from WATER_PUMP to LIGHTS
UPDATE devices 
SET 
  type = 'LIGHTS',
  configuration = COALESCE(configuration, '{}') || jsonb_build_object(
    'migration_applied', 'fix_device_types_classification',
    'original_type', type,
    'corrected_type', 'LIGHTS',
    'correction_reason', 'device_id pattern: luz/light',
    'correction_date', NOW()::text
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE 
  (device_id ILIKE '%luz%' OR device_id ILIKE '%light%' OR device_id ILIKE '%led%')
  AND type = 'WATER_PUMP';

-- Update valve devices from WATER_PUMP to VALVE
UPDATE devices 
SET 
  type = 'VALVE',
  configuration = COALESCE(configuration, '{}') || jsonb_build_object(
    'migration_applied', 'fix_device_types_classification',
    'original_type', type,
    'corrected_type', 'VALVE',
    'correction_reason', 'device_id pattern: valve/valvula',
    'correction_date', NOW()::text
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE 
  (device_id ILIKE '%valve%' OR device_id ILIKE '%valvula%')
  AND type = 'WATER_PUMP'