-- Actualizar reglas de calefactor y ventilador para usar sensor temhum3
-- Esto cambiará las condiciones de las reglas para que consulten específicamente temhum3

-- Verificar reglas actuales antes del cambio
SELECT id, name, enabled, conditions 
FROM rules 
WHERE id IN (6, 9, 10);

-- Regla 6: Calefactor Auto - Temp <10°C
-- Actualizar condiciones para usar temhum3
UPDATE rules 
SET conditions = jsonb_set(
    conditions,
    '{rules,0,sensorId}',
    '"temhum3"'
)
WHERE id = 6;

-- Regla 9: Ventilador ON - Temp >23°C  
-- Actualizar condiciones para usar temhum3
UPDATE rules 
SET conditions = jsonb_set(
    conditions,
    '{rules,0,sensorId}',
    '"temhum3"'
)
WHERE id = 9;

-- Regla 10: Ventilador OFF - Temp <21°C
-- Actualizar condiciones para usar temhum3
UPDATE rules 
SET conditions = jsonb_set(
    conditions,
    '{rules,0,sensorId}',
    '"temhum3"'
)
WHERE id = 10;

-- Verificar los cambios
SELECT id, name, enabled, conditions 
FROM rules 
WHERE id IN (6, 9, 10);

-- Mostrar las condiciones en formato legible
SELECT 
    id,
    name,
    enabled,
    conditions->'rules'->0->>'sensorId' as sensor_id,
    conditions->'rules'->0->>'field' as sensor_field,
    conditions->'rules'->0->>'operator' as operator,
    conditions->'rules'->0->>'value' as threshold_value
FROM rules 
WHERE id IN (6, 9, 10);