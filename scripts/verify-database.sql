-- 🗄️ Script de Verificación de Base de Datos
-- Verifica la integridad y estado del sistema después de todas las mejoras

-- =====================================================
-- 1. VERIFICACIÓN DE TABLAS Y ESTRUCTURA
-- =====================================================

\echo '🗄️  VERIFICACIÓN DE ESTRUCTURA DE BASE DE DATOS'
\echo '================================================='

-- Verificar todas las tablas
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

\echo ''
\echo '📊 CONTEO DE REGISTROS POR TABLA'
\echo '================================='

-- Conteo de registros en tablas principales
SELECT 'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 'devices', COUNT(*) FROM devices
UNION ALL
SELECT 'rules', COUNT(*) FROM rules
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'rule_executions', COUNT(*) FROM rule_executions
UNION ALL
SELECT 'operations_log', COUNT(*) FROM operations_log
ORDER BY table_name;

-- =====================================================
-- 2. VERIFICACIÓN DE DISPOSITIVOS
-- =====================================================

\echo ''
\echo '🔌 VERIFICACIÓN DE DISPOSITIVOS'
\echo '==============================='

-- Verificar dispositivos y nueva columna enable_notifications
SELECT 
    id,
    name,
    device_id,
    type,
    status,
    COALESCE(enable_notifications, true) as enable_notifications,
    created_at
FROM devices
ORDER BY id;

-- =====================================================
-- 3. VERIFICACIÓN DE REGLAS DE CICLOS
-- =====================================================

\echo ''
\echo '🚰 VERIFICACIÓN DE REGLAS DE CICLOS DE BOMBA'
\echo '============================================='

-- Verificar reglas de ciclos
SELECT 
    id,
    name,
    enabled,
    priority,
    cooldown_minutes,
    conditions->>'operator' as condition_operator,
    jsonb_array_length(actions) as action_count,
    last_triggered,
    trigger_count,
    created_at
FROM rules 
WHERE name LIKE '%CICLO%' 
AND name LIKE '%Bomba%'
ORDER BY name;

-- Contar reglas de ciclos
SELECT 
    COUNT(*) as total_cycle_rules,
    SUM(CASE WHEN enabled = true THEN 1 ELSE 0 END) as enabled_rules,
    SUM(CASE WHEN priority = 9 THEN 1 ELSE 0 END) as high_priority_rules
FROM rules 
WHERE name LIKE '%CICLO%' 
AND name LIKE '%Bomba%';

-- =====================================================
-- 4. VERIFICACIÓN DE EJECUCIONES DE REGLAS
-- =====================================================

\echo ''
\echo '⚡ EJECUCIONES RECIENTES DE REGLAS'
\echo '=================================='

-- Ejecuciones recientes de reglas de ciclos
SELECT 
    re.triggered_at,
    r.name as rule_name,
    re.success,
    re.execution_time_ms,
    CASE 
        WHEN re.error_message IS NOT NULL THEN 'ERROR: ' || LEFT(re.error_message, 50)
        ELSE 'SUCCESS'
    END as status
FROM rule_executions re
JOIN rules r ON re.rule_id = r.id
WHERE r.name LIKE '%CICLO%'
ORDER BY re.triggered_at DESC
LIMIT 10;

-- Estadísticas de ejecuciones de ciclos
SELECT 
    COUNT(*) as total_executions,
    SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful_executions,
    SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed_executions,
    ROUND(AVG(execution_time_ms), 2) as avg_execution_time_ms,
    MAX(triggered_at) as last_execution
FROM rule_executions re
JOIN rules r ON re.rule_id = r.id
WHERE r.name LIKE '%CICLO%';

-- =====================================================
-- 5. VERIFICACIÓN DE NOTIFICACIONES
-- =====================================================

\echo ''
\echo '📧 VERIFICACIÓN DE NOTIFICACIONES'
\echo '================================='

-- Notificaciones recientes
SELECT 
    id,
    title,
    LEFT(message, 60) as message_preview,
    type,
    priority,
    status,
    created_at
FROM notifications
ORDER BY created_at DESC
LIMIT 10;

-- Estadísticas de notificaciones
SELECT 
    type,
    priority,
    status,
    COUNT(*) as count
FROM notifications
GROUP BY type, priority, status
ORDER BY type, priority, status;

-- =====================================================
-- 6. VERIFICACIÓN DE USUARIOS Y PERMISOS
-- =====================================================

\echo ''
\echo '👤 VERIFICACIÓN DE USUARIOS'
\echo '==========================='

-- Usuarios del sistema
SELECT 
    id,
    username,
    email,
    role,
    is_active,
    last_login,
    created_at
FROM users
ORDER BY id;

-- =====================================================
-- 7. VERIFICACIÓN DE ÍNDICES Y PERFORMANCE
-- =====================================================

\echo ''
\echo '🏃 VERIFICACIÓN DE ÍNDICES'
\echo '========================='

-- Índices importantes
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
AND (tablename IN ('rules', 'devices', 'notifications', 'rule_executions')
     OR indexname LIKE '%ciclo%')
ORDER BY tablename, indexname;

-- =====================================================
-- 8. VERIFICACIÓN DE CONDICIONES TEMPORALES
-- =====================================================

\echo ''
\echo '⏰ ANÁLISIS DE CONDICIONES TEMPORALES'
\echo '====================================='

-- Análisis de las condiciones de tiempo en reglas de ciclos
SELECT 
    name,
    conditions->'rules'->0->>'timeStart' as time_start,
    conditions->'rules'->0->>'timeEnd' as time_end,
    conditions->'rules'->0->>'type' as condition_type,
    actions->0->>'action' as device_action
FROM rules 
WHERE name LIKE '%CICLO%'
ORDER BY name;

-- =====================================================
-- 9. VERIFICACIÓN DE HORA ACTUAL Y REGLAS ACTIVAS
-- =====================================================

\echo ''
\echo '🕐 ESTADO ACTUAL DEL SISTEMA'
\echo '==========================='

-- Hora actual y minuto
SELECT 
    NOW() as current_timestamp,
    EXTRACT(hour FROM NOW()) as current_hour,
    EXTRACT(minute FROM NOW()) as current_minute,
    CASE 
        WHEN EXTRACT(minute FROM NOW()) BETWEEN 0 AND 14 THEN 'Debería estar ENCENDIDA (00-15)'
        WHEN EXTRACT(minute FROM NOW()) BETWEEN 15 AND 29 THEN 'Debería estar APAGADA (15-30)'
        WHEN EXTRACT(minute FROM NOW()) BETWEEN 30 AND 44 THEN 'Debería estar ENCENDIDA (30-45)'
        WHEN EXTRACT(minute FROM NOW()) BETWEEN 45 AND 59 THEN 'Debería estar APAGADA (45-00)'
    END as expected_pump_status;

-- Estado actual de la bomba de agua
SELECT 
    id,
    name,
    status as current_status,
    updated_at as last_status_change
FROM devices 
WHERE id = 1 OR device_id = 'bomba_agua_01'
LIMIT 1;

-- =====================================================
-- 10. VERIFICACIÓN DE INTEGRIDAD REFERENCIAL
-- =====================================================

\echo ''
\echo '🔗 VERIFICACIÓN DE INTEGRIDAD REFERENCIAL'
\echo '========================================='

-- Verificar foreign keys importantes
SELECT 
    'rules.created_by -> users.id' as relationship,
    COUNT(*) as total_rules,
    COUNT(u.id) as valid_references
FROM rules r
LEFT JOIN users u ON r.created_by = u.id
UNION ALL
SELECT 
    'notifications.user_id -> users.id',
    COUNT(*) as total_notifications,
    COUNT(u.id) as valid_references
FROM notifications n
LEFT JOIN users u ON n.user_id = u.id
UNION ALL
SELECT 
    'rule_executions.rule_id -> rules.id',
    COUNT(*) as total_executions,
    COUNT(r.id) as valid_references
FROM rule_executions re
LEFT JOIN rules r ON re.rule_id = r.id;

-- =====================================================
-- 11. RESUMEN FINAL
-- =====================================================

\echo ''
\echo '📋 RESUMEN FINAL'
\echo '==============='

-- Resumen del estado del sistema
SELECT 
    '🗄️  Total Tablas' as metric,
    COUNT(*)::text as value
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'

UNION ALL

SELECT 
    '🔌 Total Dispositivos',
    COUNT(*)::text
FROM devices

UNION ALL

SELECT 
    '🚰 Reglas de Ciclos',
    COUNT(*)::text
FROM rules WHERE name LIKE '%CICLO%'

UNION ALL

SELECT 
    '⚡ Reglas Activas',
    COUNT(*)::text
FROM rules WHERE enabled = true

UNION ALL

SELECT 
    '📧 Total Notificaciones',
    COUNT(*)::text
FROM notifications

UNION ALL

SELECT 
    '🏃 Últimas 24h Ejecuciones',
    COUNT(*)::text
FROM rule_executions 
WHERE triggered_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
    '👤 Usuarios Activos',
    COUNT(*)::text
FROM users WHERE is_active = true;

\echo ''
\echo '✅ VERIFICACIÓN COMPLETADA'
\echo '========================='
\echo 'Revise los resultados arriba para confirmar que:'
\echo '1. Las reglas de ciclos están creadas (4 reglas)'
\echo '2. Los dispositivos tienen el campo enable_notifications'
\echo '3. Las notificaciones se están generando'
\echo '4. Las ejecuciones de reglas están funcionando'
\echo '5. La integridad referencial está correcta'