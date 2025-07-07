-- 🚰🌡️ Setup Completo de Reglas - Sistema IoT Invernadero
-- Crea todas las reglas de temperatura, humedad, ventilador y ciclos de bomba

-- =====================================================
-- 1. LIMPIAR REGLAS EXISTENTES
-- =====================================================

DELETE FROM rules WHERE name LIKE '%CICLO%' OR name LIKE '%Temperatura%' OR name LIKE '%Humedad%' OR name LIKE '%Ventilador%';

-- =====================================================
-- 2. REGLAS DE NOTIFICACIÓN POR TEMPERATURA
-- =====================================================

-- Regla 1: Temperatura crítica baja (< 5°C)
INSERT INTO rules (name, description, enabled, priority, cooldown_minutes, conditions, actions, created_by, created_at, updated_at) VALUES
(
    'ALERTA: Temperatura Crítica Baja - TemHum1',
    'Alerta crítica cuando la temperatura del sensor temhum1 baja de 5°C',
    true,
    10, -- Máxima prioridad
    30, -- 30 minutos de cooldown
    '{"operator": "AND", "rules": [{"type": "SENSOR", "sensorType": "TEMHUM1", "field": "temperatura", "operator": "LT", "value": 5, "dataAgeMinutes": 5}]}',
    '[{"type": "NOTIFICATION", "channels": ["whatsapp"], "template": "🚨 ALERTA CRÍTICA: Temperatura extremadamente baja\\n\\n❄️ Temperatura actual: {{temperatura}}°C\\n📍 Sensor: TemHum1\\n⚠️ Umbral crítico: < 5°C\\n\\n🔥 REVISAR SISTEMA DE CALEFACCIÓN INMEDIATAMENTE"}]',
    1,
    NOW(),
    NOW()
);

-- Regla 2: Temperatura baja (< 18°C)
INSERT INTO rules (name, description, enabled, priority, cooldown_minutes, conditions, actions, created_by, created_at, updated_at) VALUES
(
    'ALERTA: Temperatura Baja - TemHum1',
    'Notificación cuando la temperatura del sensor temhum1 baja de 18°C',
    true,
    8, -- Alta prioridad
    60, -- 1 hora de cooldown
    '{"operator": "AND", "rules": [{"type": "SENSOR", "sensorType": "TEMHUM1", "field": "temperatura", "operator": "LT", "value": 18, "dataAgeMinutes": 5}]}',
    '[{"type": "NOTIFICATION", "channels": ["whatsapp"], "template": "🌡️ Temperatura Baja Detectada\\n\\n❄️ Temperatura actual: {{temperatura}}°C\\n📍 Sensor: TemHum1\\n⚠️ Umbral: < 18°C\\n\\n💡 Considerar activar calefacción"}]',
    1,
    NOW(),
    NOW()
);

-- Regla 3: Temperatura alta (> 23°C)
INSERT INTO rules (name, description, enabled, priority, cooldown_minutes, conditions, actions, created_by, created_at, updated_at) VALUES
(
    'ALERTA: Temperatura Alta - TemHum1',
    'Notificación cuando la temperatura del sensor temhum1 supera los 23°C',
    true,
    7, -- Alta prioridad
    60, -- 1 hora de cooldown
    '{"operator": "AND", "rules": [{"type": "SENSOR", "sensorType": "TEMHUM1", "field": "temperatura", "operator": "GT", "value": 23, "dataAgeMinutes": 5}]}',
    '[{"type": "NOTIFICATION", "channels": ["whatsapp"], "template": "🌡️ Temperatura Alta Detectada\\n\\n🔥 Temperatura actual: {{temperatura}}°C\\n📍 Sensor: TemHum1\\n⚠️ Umbral: > 23°C\\n\\n💨 Sistema de ventilación activándose automáticamente"}]',
    1,
    NOW(),
    NOW()
);

-- =====================================================
-- 3. REGLA DE NOTIFICACIÓN POR HUMEDAD
-- =====================================================

-- Regla 4: Humedad baja (< 50%)
INSERT INTO rules (name, description, enabled, priority, cooldown_minutes, conditions, actions, created_by, created_at, updated_at) VALUES
(
    'ALERTA: Humedad Baja - TemHum1',
    'Notificación cuando la humedad del sensor temhum1 baja del 50%',
    true,
    6, -- Prioridad media-alta
    90, -- 1.5 horas de cooldown
    '{"operator": "AND", "rules": [{"type": "SENSOR", "sensorType": "TEMHUM1", "field": "humedad", "operator": "LT", "value": 50, "dataAgeMinutes": 10}]}',
    '[{"type": "NOTIFICATION", "channels": ["whatsapp"], "template": "💧 Humedad Baja Detectada\\n\\n💦 Humedad actual: {{humedad}}%\\n📍 Sensor: TemHum1\\n⚠️ Umbral: < 50%\\n\\n🌿 Las plantas pueden necesitar más humidificación"}]',
    1,
    NOW(),
    NOW()
);

-- =====================================================
-- 4. REGLAS DE CONTROL DE VENTILADOR
-- =====================================================

-- Regla 5: Encender ventilador (Temperatura > 23°C)
INSERT INTO rules (name, description, enabled, priority, cooldown_minutes, conditions, actions, created_by, created_at, updated_at) VALUES
(
    'AUTO: Encender Ventilador - Temp > 23°C',
    'Enciende automáticamente el ventilador cuando la temperatura supera los 23°C',
    true,
    9, -- Alta prioridad para control automático
    5, -- Cooldown corto para respuesta rápida
    '{"operator": "AND", "rules": [{"type": "SENSOR", "sensorType": "TEMHUM1", "field": "temperatura", "operator": "GT", "value": 23, "dataAgeMinutes": 3}]}',
    '[{"type": "DEVICE_CONTROL", "deviceId": "2", "action": "TURN_ON"}]',
    1,
    NOW(),
    NOW()
);

-- Regla 6: Apagar ventilador (Temperatura < 21°C)
INSERT INTO rules (name, description, enabled, priority, cooldown_minutes, conditions, actions, created_by, created_at, updated_at) VALUES
(
    'AUTO: Apagar Ventilador - Temp < 21°C',
    'Apaga automáticamente el ventilador cuando la temperatura baja de 21°C',
    true,
    9, -- Alta prioridad para control automático
    5, -- Cooldown corto para respuesta rápida
    '{"operator": "AND", "rules": [{"type": "SENSOR", "sensorType": "TEMHUM1", "field": "temperatura", "operator": "LT", "value": 21, "dataAgeMinutes": 3}]}',
    '[{"type": "DEVICE_CONTROL", "deviceId": "2", "action": "TURN_OFF"}]',
    1,
    NOW(),
    NOW()
);

-- =====================================================
-- 5. SISTEMA DE CICLOS DE BOMBA DE AGUA (15 min ON/OFF)
-- =====================================================

-- Regla 7: Bomba ON (minutos 00-15 de cada 30 min)
INSERT INTO rules (name, description, enabled, priority, cooldown_minutes, conditions, actions, created_by, created_at, updated_at) VALUES
(
    'CICLO: Bomba ON (minutos 00-15)',
    'Enciende bomba de agua durante los primeros 15 minutos de cada media hora (00-15 y 30-45)',
    true,
    9, -- Alta prioridad para asegurar ejecución
    5, -- Cooldown corto
    '{"operator": "AND", "rules": [{"type": "TIME", "timeStart": "00:00", "timeEnd": "00:15"}]}',
    '[{"type": "DEVICE_CONTROL", "deviceId": "1", "action": "TURN_ON"}]',
    1,
    NOW(),
    NOW()
);

-- Regla 8: Bomba OFF (minutos 15-30 de cada 30 min)
INSERT INTO rules (name, description, enabled, priority, cooldown_minutes, conditions, actions, created_by, created_at, updated_at) VALUES
(
    'CICLO: Bomba OFF (minutos 15-30)',
    'Apaga bomba de agua durante los minutos 15-30 y 45-00 de cada media hora',
    true,
    9, -- Alta prioridad para asegurar ejecución
    5, -- Cooldown corto
    '{"operator": "AND", "rules": [{"type": "TIME", "timeStart": "00:15", "timeEnd": "00:30"}]}',
    '[{"type": "DEVICE_CONTROL", "deviceId": "1", "action": "TURN_OFF"}]',
    1,
    NOW(),
    NOW()
);

-- Regla 9: Bomba ON (minutos 30-45 de cada hora)
INSERT INTO rules (name, description, enabled, priority, cooldown_minutes, conditions, actions, created_by, created_at, updated_at) VALUES
(
    'CICLO: Bomba ON (minutos 30-45)',
    'Enciende bomba de agua durante los minutos 30-45 de cada hora',
    true,
    9, -- Alta prioridad para asegurar ejecución
    5, -- Cooldown corto
    '{"operator": "AND", "rules": [{"type": "TIME", "timeStart": "00:30", "timeEnd": "00:45"}]}',
    '[{"type": "DEVICE_CONTROL", "deviceId": "1", "action": "TURN_ON"}]',
    1,
    NOW(),
    NOW()
);

-- Regla 10: Bomba OFF (minutos 45-00 de cada hora)
INSERT INTO rules (name, description, enabled, priority, cooldown_minutes, conditions, actions, created_by, created_at, updated_at) VALUES
(
    'CICLO: Bomba OFF (minutos 45-00)',
    'Apaga bomba de agua durante los minutos 45-00 de cada hora',
    true,
    9, -- Alta prioridad para asegurar ejecución
    5, -- Cooldown corto
    '{"operator": "AND", "rules": [{"type": "TIME", "timeStart": "00:45", "timeEnd": "23:59"}]}',
    '[{"type": "DEVICE_CONTROL", "deviceId": "1", "action": "TURN_OFF"}]',
    1,
    NOW(),
    NOW()
);

-- =====================================================
-- 6. VERIFICACIÓN DE REGLAS CREADAS
-- =====================================================

-- Mostrar resumen de todas las reglas creadas
SELECT 
    id,
    name,
    enabled,
    priority,
    cooldown_minutes,
    CASE 
        WHEN name LIKE '%Temperatura%' THEN '🌡️ Temperatura'
        WHEN name LIKE '%Humedad%' THEN '💧 Humedad'
        WHEN name LIKE '%Ventilador%' THEN '💨 Ventilador'
        WHEN name LIKE '%CICLO%' THEN '🚰 Bomba'
        ELSE '❓ Otra'
    END as category,
    created_at
FROM rules 
WHERE name LIKE '%CICLO%' 
   OR name LIKE '%Temperatura%' 
   OR name LIKE '%Humedad%' 
   OR name LIKE '%Ventilador%'
ORDER BY priority DESC, category, name;

-- Contar reglas por categoría
SELECT 
    CASE 
        WHEN name LIKE '%Temperatura%' THEN '🌡️ Notificaciones Temperatura'
        WHEN name LIKE '%Humedad%' THEN '💧 Notificaciones Humedad'
        WHEN name LIKE '%Ventilador%' THEN '💨 Control Ventilador'
        WHEN name LIKE '%CICLO%' THEN '🚰 Ciclos Bomba'
        ELSE '❓ Otras'
    END as category,
    COUNT(*) as rule_count,
    SUM(CASE WHEN enabled = true THEN 1 ELSE 0 END) as enabled_count
FROM rules 
WHERE name LIKE '%CICLO%' 
   OR name LIKE '%Temperatura%' 
   OR name LIKE '%Humedad%' 
   OR name LIKE '%Ventilador%'
GROUP BY 
    CASE 
        WHEN name LIKE '%Temperatura%' THEN '🌡️ Notificaciones Temperatura'
        WHEN name LIKE '%Humedad%' THEN '💧 Notificaciones Humedad'
        WHEN name LIKE '%Ventilador%' THEN '💨 Control Ventilador'
        WHEN name LIKE '%CICLO%' THEN '🚰 Ciclos Bomba'
        ELSE '❓ Otras'
    END
ORDER BY category;

-- Verificar total de reglas activas
SELECT 
    COUNT(*) as total_rules,
    SUM(CASE WHEN enabled = true THEN 1 ELSE 0 END) as enabled_rules,
    SUM(CASE WHEN priority >= 9 THEN 1 ELSE 0 END) as high_priority_rules
FROM rules 
WHERE name LIKE '%CICLO%' 
   OR name LIKE '%Temperatura%' 
   OR name LIKE '%Humedad%' 
   OR name LIKE '%Ventilador%';

COMMENT ON TABLE rules IS 'Sistema de reglas completo: 3 alertas de temperatura (5°, 18°, 23°), 1 alerta de humedad (50%), control automático de ventilador (23°/21°), y ciclos de bomba 15min ON/OFF';

-- =====================================================
-- RESUMEN FINAL
-- =====================================================
SELECT '✅ Sistema de reglas completo creado exitosamente' as status,
       '10 reglas activas: 3 temp + 1 humedad + 2 ventilador + 4 bomba' as details;