-- Buscar reglas que están referenciando dispositivos que no existen
-- Específicamente buscando THM-003 o dispositivos inexistentes

-- 1. Buscar reglas con acciones que referencian dispositivos inexistentes
SELECT 
    r.id,
    r.name,
    r.enabled,
    r.actions,
    r.description
FROM rules r
WHERE r.actions::text LIKE '%THM-003%'
   OR r.actions::text LIKE '%"deviceId"%';

-- 2. Verificar si hay acciones que referencian dispositivos que no existen
WITH device_ids AS (
    SELECT DISTINCT device_id FROM devices
),
rule_actions AS (
    SELECT 
        r.id,
        r.name,
        r.enabled,
        action->>'deviceId' as referenced_device_id,
        action
    FROM rules r,
    jsonb_array_elements(r.actions) as action
    WHERE action->>'type' IN ('DEVICE_CONTROL', 'DEVICE_STATUS')
)
SELECT 
    ra.id,
    ra.name,
    ra.enabled,
    ra.referenced_device_id,
    ra.action,
    CASE 
        WHEN d.device_id IS NULL THEN 'DISPOSITIVO NO EXISTE'
        ELSE 'DISPOSITIVO EXISTE'
    END as device_status
FROM rule_actions ra
LEFT JOIN device_ids d ON d.device_id = ra.referenced_device_id
ORDER BY ra.id;

-- 3. Buscar reglas que puedan estar enviando comandos fantasma
SELECT 
    id,
    name,
    enabled,
    conditions,
    actions
FROM rules
WHERE enabled = true
  AND (actions::text LIKE '%DEVICE_%' OR actions::text LIKE '%device%')
ORDER BY id;