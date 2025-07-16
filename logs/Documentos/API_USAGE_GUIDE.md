# 📋 GUÍA DE USO DE LA API GraphQL - Sistema IoT Invernadero

## 🌐 **Información General**

- **URL Base**: `http://localhost:4001/graphql`
- **Tipo**: GraphQL API con Apollo Server
- **Autenticación**: JWT Bearer Token
- **Suscripciones**: WebSocket disponibles para datos en tiempo real

---

## 🔐 **1. AUTENTICACIÓN**

### **Login**
```graphql
mutation {
  login(username: "admin", password: "admin123") {
    token
    user {
      id
      username
      email
      role
    }
  }
}
```

### **Ejemplo con cURL**
```bash
curl -X POST http://localhost:4001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { login(username: \"admin\", password: \"admin123\") { token user { id username role } } }"}'
```

### **Respuesta**
```json
{
  "data": {
    "login": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "1",
        "username": "admin",
        "role": "admin"
      }
    }
  }
}
```

---

## 📊 **2. OBTENER DATOS PRINCIPALES**

### **A. Lista de Sensores Activos**
```graphql
query {
  sensors {
    id
    name
    hardware_id
    sensor_type
    is_active
    is_online
    last_seen
    location
    configuration
  }
}
```

### **B. Lista de Dispositivos**
```graphql
query {
  devices {
    id
    name
    device_id
    type
    status
    last_updated
    location
    configuration
  }
}
```

### **C. Datos Más Recientes de Sensores**
```graphql
query {
  latestSensorData {
    sensor_id
    hardware_id
    sensor_type
    payload
    received_at
    normalized_data
  }
}
```

### **D. Reglas de Automatización**
```graphql
query {
  rules {
    id
    name
    enabled
    priority
    cooldownMinutes
    conditions {
      operator
      rules {
        type
        sensorId
        field
        operator
        value
      }
    }
    actions {
      type
      channels
      template
      canal
      targetChannel
      deviceId
      action
    }
    lastTriggered
    triggerCount
  }
}
```

---

## 📈 **3. OBTENER HISTORIAL DE DATOS**

### **A. Historial de Sensor Específico**
```graphql
query {
  sensorHistory(
    sensorId: "thm-001"
    startDate: "2025-01-01T00:00:00Z"
    endDate: "2025-01-10T23:59:59Z"
    limit: 100
  ) {
    id
    sensor_id
    hardware_id
    payload
    received_at
    normalized_data
  }
}
```

### **B. Historial por Tipo de Sensor**
```graphql
query {
  sensorDataByType(
    sensorType: "TEMHUM"
    startDate: "2025-01-01T00:00:00Z"
    endDate: "2025-01-10T23:59:59Z"
    limit: 50
  ) {
    sensor_id
    hardware_id
    payload
    received_at
  }
}
```

### **C. Datos Agregados (Estadísticas)**
```graphql
query {
  sensorStats(
    sensorId: "thm-001"
    field: "temperature"
    aggregation: "HOURLY"
    startDate: "2025-01-01T00:00:00Z"
    endDate: "2025-01-10T23:59:59Z"
  ) {
    timestamp
    min_value
    max_value
    avg_value
    count
  }
}
```

---

## 🔄 **4. SUSCRIPCIONES EN TIEMPO REAL**

### **A. Datos de Sensores en Tiempo Real**
```graphql
subscription {
  sensorDataUpdated {
    sensor_id
    hardware_id
    sensor_type
    payload
    received_at
    normalized_data
  }
}
```

### **B. Actualizaciones de Dispositivos**
```graphql
subscription {
  deviceUpdated {
    id
    name
    device_id
    status
    last_updated
  }
}
```

### **C. Ejecución de Reglas**
```graphql
subscription {
  ruleTriggered {
    id
    rule {
      id
      name
    }
    triggeredAt
    success
    triggerData
    actionsExecuted {
      success
      result
      error
    }
  }
}
```

---

## 💡 **5. EJEMPLOS PRÁCTICOS**

### **Ejemplo 1: Obtener temperatura actual de todos los sensores**
```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:4001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { login(username: \"admin\", password: \"admin123\") { token } }"}' | \
  jq -r '.data.login.token')

# 2. Obtener datos de temperatura
curl -X POST http://localhost:4001/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { latestSensorData { sensor_id hardware_id payload received_at } }"}'
```

### **Ejemplo 2: Obtener historial de últimas 24 horas**
```bash
curl -X POST http://localhost:4001/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { sensorHistory(sensorId: \"thm-001\", startDate: \"2025-01-09T00:00:00Z\", endDate: \"2025-01-10T23:59:59Z\", limit: 100) { payload received_at } }"}'
```

---

## 🔧 **6. ESTRUCTURA DE DATOS DE SENSORES**

### **Payload Típico de Sensor TEMHUM**
```json
{
  "data": {
    "temperature": 28.4,
    "humidity": 45.2,
    "heat_index": 29.1,
    "dew_point": 15.3
  },
  "metadata": {
    "rssi": -45,
    "boot": 1,
    "mem": 85.2
  },
  "timestamp": "2025-01-10T10:30:00Z"
}
```

### **Payload Típico de Sensor LIGHT**
```json
{
  "data": {
    "light": 1250,
    "white_light": 890,
    "raw_light": 2140
  },
  "metadata": {
    "rssi": -42,
    "boot": 1,
    "mem": 82.1
  },
  "timestamp": "2025-01-10T10:30:00Z"
}
```

### **Payload Típico de Sensor WATER_QUALITY**
```json
{
  "data": {
    "ph": 6.8,
    "ec": 1420,
    "ppm": 710,
    "temperature": 22.5
  },
  "metadata": {
    "rssi": -38,
    "boot": 1,
    "mem": 78.9
  },
  "timestamp": "2025-01-10T10:30:00Z"
}
```

---

## 🎛️ **7. CONTROL DE DISPOSITIVOS**

### **A. Activar/Desactivar Dispositivo**
```graphql
mutation {
  controlDevice(
    deviceId: "6"
    action: TURN_ON
    duration: 900  # 15 minutos en segundos
  ) {
    success
    message
    device {
      id
      name
      status
    }
  }
}
```

### **B. Obtener Estado de Dispositivos**
```graphql
query {
  devices {
    id
    name
    device_id
    status
    last_updated
    configuration
  }
}
```

---

## 🔔 **8. GESTIÓN DE NOTIFICACIONES**

### **A. Historial de Notificaciones**
```graphql
query {
  notifications(limit: 20) {
    id
    type
    channel
    message
    sent_at
    success
    error
  }
}
```

### **B. Crear Notificación Manual**
```graphql
mutation {
  sendNotification(
    type: "MANUAL"
    channel: "WEBHOOK"
    message: "Mensaje de prueba"
    variables: {
      "canal": "telegram",
      "targetChannel": "webhook"
    }
  ) {
    success
    message
  }
}
```

---

## 📡 **9. USANDO WEBSOCKETS (Suscripciones)**

### **JavaScript Example**
```javascript
import { createClient } from 'graphql-ws';

const client = createClient({
  url: 'ws://localhost:4001/graphql',
  connectionParams: {
    Authorization: `Bearer ${token}`
  }
});

// Suscribirse a datos de sensores
client.subscribe(
  {
    query: `
      subscription {
        sensorDataUpdated {
          sensor_id
          hardware_id
          payload
          received_at
        }
      }
    `
  },
  {
    next: (data) => {
      console.log('Nuevo dato de sensor:', data);
    },
    error: (err) => {
      console.error('Error:', err);
    },
    complete: () => {
      console.log('Suscripción completada');
    }
  }
);
```

---

## 🔍 **10. FILTROS Y PAGINACIÓN**

### **A. Filtrar Sensores por Estado**
```graphql
query {
  sensors(isActive: true, isOnline: true) {
    id
    name
    hardware_id
    sensor_type
    last_seen
  }
}
```

### **B. Paginación de Historial**
```graphql
query {
  sensorHistory(
    sensorId: "thm-001"
    limit: 50
    offset: 100
    orderBy: "received_at DESC"
  ) {
    id
    payload
    received_at
  }
}
```

---

## 🛠️ **11. HERRAMIENTAS RECOMENDADAS**

### **A. GraphQL Playground**
Accede a: `http://localhost:4001/graphql`

### **B. Postman**
Configura requests GraphQL con:
- Method: POST
- URL: `http://localhost:4001/graphql`
- Headers: `Authorization: Bearer YOUR_TOKEN`
- Body: GraphQL query

### **C. curl Scripts**
```bash
# Script para obtener datos rápidamente
#!/bin/bash
TOKEN="YOUR_TOKEN_HERE"
curl -X POST http://localhost:4001/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"YOUR_QUERY_HERE"}'
```

---

## 🚨 **12. ERRORES COMUNES**

### **A. Token Expirado**
```json
{
  "errors": [
    {
      "message": "Token expired",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```
**Solución**: Hacer login nuevamente

### **B. Sensor No Encontrado**
```json
{
  "errors": [
    {
      "message": "Sensor not found",
      "extensions": {
        "code": "NOT_FOUND"
      }
    }
  ]
}
```
**Solución**: Verificar que el sensor existe y está activo

### **C. Permisos Insuficientes**
```json
{
  "errors": [
    {
      "message": "Insufficient permissions",
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ]
}
```
**Solución**: Verificar rol de usuario (admin, user, viewer)

---

## 📚 **13. RECURSOS ADICIONALES**

- **Documentación GraphQL**: Disponible en el endpoint `/graphql`
- **Schema Introspection**: Habilitado en modo desarrollo
- **Logs del Sistema**: `docker logs backend_graphql_iot-app-1`
- **Base de Datos**: PostgreSQL en puerto 5432
- **Cache**: Redis en puerto 6379

---

**📅 Última actualización**: 2025-01-10  
**🔗 Repositorio**: Backend_GraphQL_IoT  
**📧 Soporte**: Consultar logs y documentación del proyecto