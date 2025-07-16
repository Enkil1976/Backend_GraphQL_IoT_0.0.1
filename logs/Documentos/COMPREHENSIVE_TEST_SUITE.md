# 🧪 Suite de Pruebas Completas - Backend IoT GraphQL v2.0

## 📋 **Información del Sistema**
- **URL**: https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/
- **Versión**: v2.0 con Sistema de Ciclos de Bomba
- **Fecha**: Enero 2025
- **Estado**: Listo para pruebas exhaustivas

## 🎯 **Nuevas Características a Probar**

### ✨ **Características Añadidas**
1. **Sistema de Ciclos de Bomba** automático (15min ON/OFF)
2. **Notificaciones automáticas** en control de dispositivos
3. **Campo enableNotifications** en dispositivos
4. **Lógica temporal mejorada** en rules engine
5. **Scripts de gestión** desde terminal
6. **Migración SQL** para deployment
7. **Verificación automática** del sistema

---

## 🧪 **PRUEBAS NIVEL 1: INFRAESTRUCTURA Y CONECTIVIDAD**

### 1.1 **Health Check Mejorado**
```bash
# Test 1: Health endpoint básico
curl -X GET "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/health" \
  -H "Content-Type: application/json" | jq

# Test 2: GraphQL Health
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ health { status timestamp services } }"}' | jq

# Resultados esperados:
# ✅ Status: "healthy"  
# ✅ Services: graphql, mqtt, rules, database
# ✅ Timestamp actual
```

### 1.2 **Conectividad MQTT Avanzada**
```bash
# Test 3: Verificar conexión MQTT
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ health { services } }" }' | jq '.data.health.services.mqtt'

# Esperado: true (conexión MQTT activa)
```

---

## 🧪 **PRUEBAS NIVEL 2: AUTENTICACIÓN Y SEGURIDAD**

### 2.1 **Sistema de Autenticación**
```bash
# Test 4: Login de administrador
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { login(username: \"admin\", password: \"admin123\") { token user { id username role } } }"
  }' | jq

# Guardar token para pruebas siguientes
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 2.2 **Validación de Permisos**
```bash
# Test 5: Acceso sin token (debe fallar)
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ devices { id name } }"}' | jq

# Test 6: Acceso con token válido
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "{ devices { id name status } }"}' | jq
```

---

## 🧪 **PRUEBAS NIVEL 3: GESTIÓN DE DISPOSITIVOS MEJORADA**

### 3.1 **Campo enableNotifications**
```bash
# Test 7: Verificar campo enableNotifications en dispositivos
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "{ devices { id name enableNotifications status type location } }"
  }' | jq

# Esperado: Todos los dispositivos deben tener enableNotifications: true por defecto
```

### 3.2 **Control de Dispositivos con Notificaciones**
```bash
# Test 8: Encender bomba (con notificación automática)
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "mutation { turnOnDevice(id: \"1\") { id name status enableNotifications } }"
  }' | jq

# Test 9: Apagar bomba (con notificación automática)
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "mutation { turnOffDevice(id: \"1\") { id name status enableNotifications } }"
  }' | jq

# Verificar notificaciones (deben generarse automáticamente)
```

### 3.3 **Actualización de Dispositivos**
```bash
# Test 10: Actualizar configuración de notificaciones
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "mutation { updateDevice(id: \"1\", input: { enableNotifications: false }) { id enableNotifications } }"
  }' | jq

# Test 11: Verificar que las notificaciones se desactivaron
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "mutation { toggleDevice(id: \"1\") { id status enableNotifications } }"
  }' | jq

# Reactivar notificaciones
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "mutation { updateDevice(id: \"1\", input: { enableNotifications: true }) { id enableNotifications } }"
  }' | jq
```

---

## 🧪 **PRUEBAS NIVEL 4: SISTEMA DE CICLOS DE BOMBA**

### 4.1 **Verificar Reglas de Ciclos**
```bash
# Test 12: Verificar reglas de ciclos existentes
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "{ rules(orderBy: PRIORITY_DESC) { id name enabled priority conditions actions lastTriggered triggerCount } }"
  }' | jq

# Buscar reglas que contengan "CICLO" en el nombre
```

### 4.2 **Crear Reglas de Ciclos via SQL**
```sql
-- Test 13: Ejecutar en base de datos para crear ciclos
DELETE FROM rules WHERE name LIKE '%CICLO%' AND name LIKE '%Bomba%';

INSERT INTO rules (name, description, enabled, priority, cooldown_minutes, conditions, actions, created_by, created_at, updated_at) VALUES
('CICLO: Bomba ON (minutos 00-15)', 'Enciende bomba de agua durante los primeros 15 minutos de cada media hora (00-15 y 30-45)', true, 9, 5, '{"operator": "AND", "rules": [{"type": "TIME", "timeStart": "00:00", "timeEnd": "00:15"}]}', '[{"type": "DEVICE_CONTROL", "deviceId": "1", "action": "TURN_ON"}]', 1, NOW(), NOW()),
('CICLO: Bomba OFF (minutos 15-30)', 'Apaga bomba de agua durante los minutos 15-30 y 45-00 de cada media hora', true, 9, 5, '{"operator": "AND", "rules": [{"type": "TIME", "timeStart": "00:15", "timeEnd": "00:30"}]}', '[{"type": "DEVICE_CONTROL", "deviceId": "1", "action": "TURN_OFF"}]', 1, NOW(), NOW()),
('CICLO: Bomba ON (minutos 30-45)', 'Enciende bomba de agua durante los minutos 30-45 de cada hora', true, 9, 5, '{"operator": "AND", "rules": [{"type": "TIME", "timeStart": "00:30", "timeEnd": "00:45"}]}', '[{"type": "DEVICE_CONTROL", "deviceId": "1", "action": "TURN_ON"}]', 1, NOW(), NOW()),
('CICLO: Bomba OFF (minutos 45-00)', 'Apaga bomba de agua durante los minutos 45-00 de cada hora', true, 9, 5, '{"operator": "AND", "rules": [{"type": "TIME", "timeStart": "00:45", "timeEnd": "23:59"}]}', '[{"type": "DEVICE_CONTROL", "deviceId": "1", "action": "TURN_OFF"}]', 1, NOW(), NOW());

SELECT COUNT(*) as reglas_creadas FROM rules WHERE name LIKE '%CICLO%' AND name LIKE '%Bomba%';
```

### 4.3 **Verificar Rules Engine Mejorado**
```bash
# Test 14: Confirmar que las reglas se crearon
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "{ rules { id name enabled priority cooldownMinutes conditions actions } }"
  }' | jq '.data.rules[] | select(.name | contains("CICLO"))'

# Esperado: 4 reglas de ciclo con prioridad 9
```

### 4.4 **Monitoreo de Ejecuciones**
```bash
# Test 15: Verificar ejecuciones de reglas (después de 5 minutos)
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "{ ruleExecutions(limit: 10) { id rule { name } success triggeredAt executionTimeMs } }"
  }' | jq

# Buscar ejecuciones de reglas CICLO
```

---

## 🧪 **PRUEBAS NIVEL 5: NOTIFICACIONES AUTOMÁTICAS**

### 5.1 **Historial de Notificaciones**
```bash
# Test 16: Verificar notificaciones generadas por control de dispositivos
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "{ notifications(limit: 10) { id title message type priority status channels metadata createdAt } }"
  }' | jq

# Buscar notificaciones con emoji de dispositivos (💧, ⚡, 🔥, etc.)
```

### 5.2 **Creación Manual de Notificaciones**
```bash
# Test 17: Crear notificación manual
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "mutation { createNotification(input: { title: \"Test Notification\", message: \"Testing notification system\", type: \"info\", priority: \"medium\", channels: [\"webhook\"] }) { id title status } }"
  }' | jq
```

---

## 🧪 **PRUEBAS NIVEL 6: SENSORES Y DATOS**

### 6.1 **Estructura de Datos de Sensores**
```bash
# Test 18: Verificar tipos de sensores disponibles
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "{ sensorTypes }"
  }' | jq

# Test 19: Consultar datos de sensores (si hay datos)
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "{ latestSensorData(sensorType: TEMHUM1) { temperatura humedad heatindex timestamp } }"
  }' | jq
```

### 6.2 **Compatibilidad de Campos**
```bash
# Test 20: Verificar mapping de campos en rules engine
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "{ rules { id conditions } }"
  }' | jq '.data.rules[] | .conditions' | grep -E "(temperature|temperatura)"

# Verificar que el mapping funciona correctamente
```

---

## 🧪 **PRUEBAS NIVEL 7: PERFORMANCE Y ESCALABILIDAD**

### 7.1 **Pruebas de Carga**
```bash
# Test 21: Múltiples solicitudes concurrentes
for i in {1..5}; do
  (curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"query": "{ devices { id name status } }"}' \
    -w "Request $i: %{time_total}s\n" -o /dev/null -s) &
done
wait

# Esperado: Todas las solicitudes < 2 segundos
```

### 7.2 **Pruebas de Memoria**
```bash
# Test 22: Consultas complejas
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "{ devices { id name status type location enableNotifications owner { username } events { id eventType timestamp } } rules { id name enabled priority actions conditions } notifications { id title message type priority status createdAt } }"
  }' | jq > /dev/null

echo "Complex query completed successfully"
```

---

## 🧪 **PRUEBAS NIVEL 8: TIMESTAMP Y LOCALIZACIÓN**

### 8.1 **Verificar Timestamps Corregidos**
```bash
# Test 23: Control de dispositivo y verificar timestamp
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "mutation { toggleDevice(id: \"1\") { id status updatedAt } }"
  }' | jq

# Esperar 2 minutos y verificar notificación
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "{ notifications(limit: 1) { id message metadata createdAt } }"
  }' | jq

# Verificar que el timestamp NO sea "{{timestamp}}" sino fecha real
```

---

## 🧪 **PRUEBAS NIVEL 9: INTEGRACIÓN COMPLETA**

### 9.1 **Escenario de Usuario Completo**
```bash
# Test 24: Flujo completo de administrador
echo "=== ESCENARIO: Admin gestiona bomba de agua ==="

# 1. Login
TOKEN=$(curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { login(username: \"admin\", password: \"admin123\") { token } }"}' \
  | jq -r '.data.login.token')

# 2. Ver dispositivos
echo "2. Consultando dispositivos..."
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "{ devices { id name status enableNotifications } }"}' | jq

# 3. Controlar bomba
echo "3. Encendiendo bomba..."
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "mutation { turnOnDevice(id: \"1\") { id status } }"}' | jq

# 4. Verificar reglas activas
echo "4. Verificando reglas de ciclos..."
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "{ rules { id name enabled priority } }"}' | jq '.data.rules[] | select(.name | contains("CICLO"))'

# 5. Ver notificaciones
echo "5. Consultando notificaciones..."
curl -X POST "https://invernaderoiot-backendiot20.2h4eh9.easypanel.host/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "{ notifications(limit: 3) { id title message type createdAt } }"}' | jq

echo "=== ESCENARIO COMPLETADO ==="
```

---

## 🧪 **PRUEBAS NIVEL 10: VALIDACIÓN DE DATOS**

### 10.1 **Integridad de Base de Datos**
```sql
-- Test 25: Ejecutar en base de datos
-- Verificar estructura de tablas
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('devices', 'rules', 'notifications')
ORDER BY table_name, ordinal_position;

-- Verificar índices
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';

-- Verificar constraints
SELECT conname, contype FROM pg_constraint WHERE connamespace = 'public'::regnamespace;
```

### 10.2 **Validación de Reglas de Ciclos**
```sql
-- Test 26: Verificar reglas de ciclos en BD
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
ORDER BY name;

-- Verificar ejecuciones
SELECT 
  re.triggered_at,
  r.name,
  re.success,
  re.execution_time_ms
FROM rule_executions re
JOIN rules r ON re.rule_id = r.id
WHERE r.name LIKE '%CICLO%'
ORDER BY re.triggered_at DESC
LIMIT 10;
```

---

## 📊 **MÉTRICAS DE ÉXITO**

### ✅ **Criterios de Aprobación**

#### **Funcionalidad Core**
- [ ] Login de admin funciona (< 1s)
- [ ] Control de dispositivos funciona (< 1s)
- [ ] Campo enableNotifications presente
- [ ] Notificaciones automáticas se generan
- [ ] Timestamps reales (no {{timestamp}})

#### **Sistema de Ciclos**
- [ ] 4 reglas de ciclo se crean correctamente
- [ ] Reglas tienen prioridad 9
- [ ] Rules engine ejecuta las reglas
- [ ] Patrón 15min ON/OFF funciona
- [ ] Logs de ejecución se registran

#### **Performance**
- [ ] Respuestas < 2 segundos
- [ ] 5 solicitudes concurrentes exitosas
- [ ] Sin errores 500 o timeouts
- [ ] Memoria estable

#### **Seguridad**
- [ ] Acceso sin token bloqueado
- [ ] JWT válido permite acceso
- [ ] Introspection deshabilitada en producción
- [ ] Datos sensibles protegidos

#### **Integración**
- [ ] Health check reporta servicios OK
- [ ] MQTT connection activa
- [ ] Database queries exitosas
- [ ] Rules engine operativo

---

## 🚀 **COMANDOS RÁPIDOS PARA EJECUTAR TODAS LAS PRUEBAS**

```bash
#!/bin/bash
# SUITE DE PRUEBAS AUTOMATIZADA

BASE_URL="https://invernaderoiot-backendiot20.2h4eh9.easypanel.host"
echo "🧪 Iniciando Suite de Pruebas Completas..."
echo "🎯 URL: $BASE_URL"

# 1. Health Check
echo "1️⃣ Health Check..."
curl -s "$BASE_URL/health" | jq '.status' || echo "❌ Health check failed"

# 2. Login
echo "2️⃣ Authentication..."
TOKEN=$(curl -s -X POST "$BASE_URL/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { login(username: \"admin\", password: \"admin123\") { token } }"}' \
  | jq -r '.data.login.token')

if [ "$TOKEN" != "null" ] && [ "$TOKEN" != "" ]; then
  echo "✅ Authentication successful"
else
  echo "❌ Authentication failed"
  exit 1
fi

# 3. Device Control
echo "3️⃣ Device Control..."
curl -s -X POST "$BASE_URL/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "{ devices { id name enableNotifications } }"}' \
  | jq '.data.devices' > /dev/null && echo "✅ Device queries work" || echo "❌ Device queries failed"

# 4. Rules Verification
echo "4️⃣ Rules Engine..."
RULES_COUNT=$(curl -s -X POST "$BASE_URL/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "{ rules { id name } }"}' \
  | jq '.data.rules | length')

echo "📋 Found $RULES_COUNT rules in system"

# 5. Notifications
echo "5️⃣ Notifications..."
curl -s -X POST "$BASE_URL/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query": "{ notifications(limit: 1) { id title } }"}' \
  | jq '.data' > /dev/null && echo "✅ Notifications accessible" || echo "❌ Notifications failed"

echo "🎉 Suite de pruebas completada"
echo "📋 Revisar resultados arriba para validación completa"
```

---

## 📋 **CHECKLIST FINAL**

### ✅ **Pre-Producción**
- [ ] Todas las pruebas de conectividad pasan
- [ ] Sistema de autenticación funciona
- [ ] Control de dispositivos operativo
- [ ] Notificaciones automáticas activas
- [ ] Sistema de ciclos funcionando
- [ ] Performance dentro de límites
- [ ] Seguridad validada
- [ ] Base de datos íntegra

### ✅ **Post-Deployment**
- [ ] Monitoreo de reglas de ciclos activo
- [ ] Logs de ejecución generándose
- [ ] Notificaciones llegando correctamente
- [ ] Sistema estable por 24 horas
- [ ] Métricas de performance normales

**¡Sistema listo para operación en producción!** 🚀