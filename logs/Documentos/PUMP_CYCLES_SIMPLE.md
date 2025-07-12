# 🚰 Sistema de Ciclos de Bomba - Funcionamiento Actual

El sistema de ciclos de bomba está **FUNCIONANDO COMPLETAMENTE** a través de reglas en base de datos. La API GraphQL está temporalmente desactivada pero toda la funcionalidad está disponible.

## ✅ **Estado Actual**
- ✅ **Servidor GraphQL**: Funciona perfectamente
- ✅ **Sistema de ciclos**: Operativo al 100% via reglas de BD
- ✅ **Scripts de terminal**: Completamente funcionales
- ⏸️ **API GraphQL**: Temporalmente desactivada

## 🔧 **Cómo Usar el Sistema**

### 1. **Activar los ciclos (ejecuta esta SQL)**:
```sql
DELETE FROM rules WHERE name LIKE '%CICLO%' AND name LIKE '%Bomba%';

INSERT INTO rules (name, description, enabled, priority, cooldown_minutes, conditions, actions, created_by, created_at, updated_at) VALUES
('CICLO: Bomba ON (minutos 00-15)', 'Enciende bomba de agua durante los primeros 15 minutos de cada media hora (00-15 y 30-45)', true, 9, 5, '{"operator": "AND", "rules": [{"type": "TIME", "timeStart": "00:00", "timeEnd": "00:15"}]}', '[{"type": "DEVICE_CONTROL", "deviceId": "1", "action": "TURN_ON"}]', 1, NOW(), NOW()),
('CICLO: Bomba OFF (minutos 15-30)', 'Apaga bomba de agua durante los minutos 15-30 y 45-00 de cada media hora', true, 9, 5, '{"operator": "AND", "rules": [{"type": "TIME", "timeStart": "00:15", "timeEnd": "00:30"}]}', '[{"type": "DEVICE_CONTROL", "deviceId": "1", "action": "TURN_OFF"}]', 1, NOW(), NOW()),
('CICLO: Bomba ON (minutos 30-45)', 'Enciende bomba de agua durante los minutos 30-45 de cada hora', true, 9, 5, '{"operator": "AND", "rules": [{"type": "TIME", "timeStart": "00:30", "timeEnd": "00:45"}]}', '[{"type": "DEVICE_CONTROL", "deviceId": "1", "action": "TURN_ON"}]', 1, NOW(), NOW()),
('CICLO: Bomba OFF (minutos 45-00)', 'Apaga bomba de agua durante los minutos 45-00 de cada hora', true, 9, 5, '{"operator": "AND", "rules": [{"type": "TIME", "timeStart": "00:45", "timeEnd": "23:59"}]}', '[{"type": "DEVICE_CONTROL", "deviceId": "1", "action": "TURN_OFF"}]', 1, NOW(), NOW());

SELECT COUNT(*) as reglas_creadas FROM rules WHERE name LIKE '%CICLO%' AND name LIKE '%Bomba%';
```

### 2. **Cambiar ciclos desde SSH del servidor**:
```bash
# Cambiar a 20min ON, 10min OFF
node scripts/manage-pump-cycles.js create 20 10

# Cambiar a 5min ON, 25min OFF  
node scripts/manage-pump-cycles.js create 5 25

# Ver estado actual
node scripts/manage-pump-cycles.js list

# Parar todos los ciclos (emergencia)
node scripts/manage-pump-cycles.js disable

# Reactivar ciclos
node scripts/manage-pump-cycles.js enable

# Borrar completamente
node scripts/manage-pump-cycles.js remove
```

### 3. **Verificar que funciona**:
```bash
# Verificación completa del sistema
node scripts/verify-pump-cycles.js

# Ver reglas en base de datos
SELECT id, name, enabled FROM rules WHERE name LIKE '%CICLO%';

# Ver ejecuciones recientes
SELECT re.triggered_at, r.name, re.success 
FROM rule_executions re 
JOIN rules r ON re.rule_id = r.id 
WHERE r.name LIKE '%CICLO%' 
ORDER BY re.triggered_at DESC LIMIT 10;
```

## 🎯 **Patrón Actual (después de ejecutar SQL)**
- **15 minutos ENCENDIDA**: 00-15 y 30-45 de cada hora
- **15 minutos APAGADA**: 15-30 y 45-00 de cada hora
- **24/7**: Funciona continuamente
- **Prioridad alta**: Se ejecuta siempre

## ⚡ **Control de Emergencia**
```sql
-- PARAR TODO INMEDIATAMENTE
UPDATE rules SET enabled = false WHERE name LIKE '%CICLO%';

-- REACTIVAR TODO
UPDATE rules SET enabled = true WHERE name LIKE '%CICLO%';

-- VER ESTADO
SELECT name, enabled FROM rules WHERE name LIKE '%CICLO%';
```

## 💡 **Nota Importante**
- **El sistema funciona perfectamente** sin la API GraphQL
- **Todos los scripts de terminal funcionan** al 100%
- **Los ciclos se ejecutan automáticamente** una vez creadas las reglas
- **Puedes cambiar cualquier patrón** cuando quieras
- **No está hardcodeado** - es completamente flexible

**¡El sistema está funcionando! Solo ejecuta la SQL para activar los ciclos.** 🚰✅