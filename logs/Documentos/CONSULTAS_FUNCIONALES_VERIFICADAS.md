# Consultas GraphQL Funcionales Verificadas

## 🔐 Autenticación (100% Funcional)

### Login de Administrador
```graphql
mutation AdminLogin {
  login(username: "admin", password: "admin123") {
    token
    user {
      id
      username
      role
    }
  }
}
```

**✅ Respuesta Verificada:**
```json
{
  "data": {
    "login": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "1",
        "username": "admin",
        "role": "ADMIN"
      }
    }
  }
}
```

---

## 📡 Consultas de Sensores (100% Funcional)

### 1. Obtener Todos los Sensores
```graphql
query GetAllSensors {
  sensors {
    id
    name
    hardwareId
    type
    isOnline
    location
    mqttTopic
  }
}
```

**✅ Resultado Verificado:** 9 sensores activos
- 3 sensores WATER_QUALITY (calidad del agua)
- 3 sensores TEMHUM (temperatura/humedad) 
- 1 sensor LIGHT (luxómetro)
- 1 sensor TEMP_PRESSURE (BMP280)
- 1 sensor SYSTEM

### 2. Datos de Sensores en Tiempo Real (NUEVO - Implementado y Funcional)
```graphql
query GetLatestSensorData {
  latestSensorData {
    id
    timestamp
    temperatura
    humedad
    ph
    ec
    light
    watts
    rssi
  }
}
```

**✅ Respuesta Verificada:** 8 sensores con datos en tiempo real
```json
{
  "data": {
    "latestSensorData": [
      {
        "id": "5_1752295080947",
        "timestamp": "2025-07-11T19:38:45.020Z",
        "temperatura": 27.5,
        "humedad": 36,
        "rssi": -74
      },
      {
        "id": "3_1752295080948", 
        "timestamp": "2025-07-12T04:37:36.229Z",
        "temperatura": 6.318855,
        "humedad": 62.95519,
        "rssi": -84
      }
      // ... más sensores
    ]
  }
}
```

### 3. Sensor Específico
```graphql
query GetSensor($id: ID!) {
  sensor(id: $id) {
    id
    name
    hardwareId
    type
    isOnline
    location
    mqttTopic
  }
}
```

**✅ Ejemplo Verificado:**
```javascript
// Variables: { "id": "6" }
// Retorna: TemHum1 Sensor con todos los campos
```

---

## 🔌 Consultas de Dispositivos (100% Funcional)

### 1. Obtener Todos los Dispositivos
```graphql
query GetAllDevices {
  devices {
    id
    name
    deviceId
    type
    status
    lastSeen
  }
}
```

**✅ Resultado Verificado:** 10 dispositivos
- 5 bombas de agua (1 principal + 4 auto-detectadas)
- 1 ventilador
- 1 calefactor  
- 1 lámpara LED
- 1 relay
- 1 sensor actuador

### 2. Control de Dispositivos
```graphql
mutation ToggleDevice($deviceId: ID!) {
  toggleDevice(id: $deviceId) {
    id
    name
    status
  }
}
```

**✅ Ejemplo Verificado:**
```javascript
// Variables: { "deviceId": "2" }
// Resultado: Ventilador cambió de OFF a ON
```

---

## 🤖 Consultas de Automatización (100% Funcional)

### 1. Obtener Reglas de Automatización
```graphql
query GetAutomationRules {
  rules {
    id
    name
    description
    enabled
    priority
    lastTriggered
    triggerCount
  }
}
```

**✅ Resultado Verificado:** 13 reglas activas
- Reglas de temperatura crítica
- Control automático de calefactor
- Ciclos de bomba de agua
- Control de ventilación
- Programación de iluminación

### 2. Reglas por Prioridad
```graphql
query GetHighPriorityRules {
  rules(enabled: true) {
    id
    name
    priority
    triggerCount
    enabled
  }
}
```

**✅ Verificado:** Reglas ordenadas por prioridad (10 = más alta)

---

## 📢 Consultas de Notificaciones (90% Funcional)

### 1. Obtener Notificaciones Recientes
```graphql
query GetNotifications($limit: Int = 10) {
  notifications(limit: $limit) {
    edges {
      node {
        id
        title
        message
        severity
        isRead
        createdAt
      }
    }
    totalCount
    unreadCount
  }
}
```

**✅ Resultado Verificado:** 4,364 notificaciones totales
- Todas no leídas (4,364 unreadCount)
- Notificaciones de control de dispositivos
- Alertas de temperatura
- Estados de bomba

**⚠️ Limitación:** Campo `type` causa error de enum, usar sin ese campo

---

## 🌤️ Consultas Meteorológicas (100% Funcional)

### 1. Datos Meteorológicos Actuales
```graphql
query GetCurrentWeather {
  getCurrentWeather {
    id
    temperatura
    humedad
    presion
    receivedAt
  }
}
```

**✅ Respuesta Verificada en Tiempo Real:**
```json
{
  "data": {
    "getCurrentWeather": {
      "id": "weather_1752294704399",
      "temperatura": 5.3,
      "humedad": 81,
      "presion": 1018,
      "receivedAt": "2025-07-12T04:31:44.399Z"
    }
  }
}
```

### 2. Historial Meteorológico (Estructura Funcional)
```graphql
query GetWeatherHistory($limit: Int = 10) {
  getWeatherHistory(limit: $limit) {
    edges {
      node {
        id
        temperatura
        humedad
        presion
        receivedAt
      }
    }
    totalCount
  }
}
```

**✅ Consulta Funcional:** Estructura completa, datos limitados

---

## 🔍 Consultas de Historial (Estructura Completa)

### 1. Historial General de Sensores
```graphql
query GetAllSensorHistory($limit: Int = 10) {
  allSensorHistory(limit: $limit) {
    edges {
      node {
        id
        timestamp
        data
      }
    }
    totalCount
  }
}
```

**✅ Estructura Verificada:** Consulta existe y funciona (sin datos actuales)

### 2. Lecturas de Sensor Específico
```graphql
query GetSensorReadings($sensorId: ID!, $limit: Int = 10) {
  sensorReadings(sensorId: $sensorId, limit: $limit) {
    edges {
      node {
        id
        timestamp
        temperatura
        humedad
      }
    }
    totalCount
  }
}
```

**✅ Estructura Verificada:** Consulta funcional (retorna datos vacíos)

---

## 👤 Consultas de Usuario (Funcional)

### 1. Usuario Actual
```graphql
query Me {
  me {
    id
    username
    email
    role
    firstName
    lastName
    lastLogin
    createdAt
  }
}
```

**✅ Funcional:** Con token de autenticación válido

---

## ❌ Consultas con Limitaciones Conocidas

### 1. Campos Problemáticos en Dispositivos
```graphql
# ❌ NO funciona - causa error null
query DevicesWithOnlineStatus {
  devices {
    isOnline  # Este campo causa error
  }
}

# ❌ NO funciona - campo no existe  
query DevicesWithRoom {
  devices {
    room  # Este campo no existe
  }
}
```

### 2. Campos Problemáticos en Notificaciones
```graphql
# ❌ NO funciona - enum incompatible
query NotificationsWithType {
  notifications {
    edges {
      node {
        type  # Este campo causa error de enum
      }
    }
  }
}
```

### 3. Introspección de Schema
```graphql
# ❌ NO funciona - deshabilitada en producción
query SchemaIntrospection {
  __schema {
    queryType {
      fields {
        name
      }
    }
  }
}
```

---

## 🚀 Ejemplos de Uso con cURL

### Autenticación
```bash
curl -X POST https://postgres-bakend.2h4eh9.easypanel.host/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { login(username: \"admin\", password: \"admin123\") { token user { username role } } }"}'
```

### Consultar Sensores (con token)
```bash
TOKEN="tu_token_aqui"
curl -X POST https://postgres-bakend.2h4eh9.easypanel.host/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { sensors { id name type isOnline } }"}'
```

### Datos en Tiempo Real
```bash
TOKEN="tu_token_aqui"
curl -X POST https://postgres-bakend.2h4eh9.easypanel.host/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { latestSensorData { id timestamp temperatura humedad rssi } }"}'
```

### Controlar Dispositivo
```bash
TOKEN="tu_token_aqui"
curl -X POST https://postgres-bakend.2h4eh9.easypanel.host/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"mutation { toggleDevice(id: \"2\") { id name status } }"}'
```

---

## 📊 Resumen de Estado

### ✅ Completamente Funcional (100%)
- **Autenticación**: Login, tokens JWT
- **Sensores**: Listado, consulta individual, datos en tiempo real
- **Dispositivos**: Listado, control (toggle, on/off)
- **Reglas**: Consulta de automatización
- **Meteorología**: Datos actuales en tiempo real

### ⚠️ Funcional con Limitaciones (90%)
- **Notificaciones**: Funciona sin campo `type`
- **Historial**: Estructura completa, datos limitados

### ❌ No Funcional
- **Introspección**: Deshabilitada en producción
- **Campos específicos**: `isOnline` en devices, `type` en notifications

### 🎯 Datos Confirmados en Tiempo Real
- **9 sensores activos** enviando datos
- **10 dispositivos** registrados y controlables
- **13 reglas de automatización** ejecutándose
- **4,364 notificaciones** del sistema
- **Datos meteorológicos** actualizándose en tiempo real

---

## 🔧 Casos de Uso Principales

### Dashboard de Monitoreo
```graphql
query Dashboard {
  sensors { id name type isOnline }
  devices { id name type status }
  getCurrentWeather { temperatura humedad presion }
  latestSensorData { temperatura humedad ph ec rssi }
}
```

### Control de Invernadero
```graphql
mutation ControlDevices {
  fan: toggleDevice(id: "2") { status }
  heater: toggleDevice(id: "4") { status } 
  lights: toggleDevice(id: "3") { status }
}
```

### Monitoreo de Automatización
```graphql
query AutomationStatus {
  rules(enabled: true) { 
    name priority triggerCount lastTriggered 
  }
  notifications(limit: 5) {
    edges { 
      node { 
        title message severity createdAt 
      } 
    }
  }
}
```

Todas estas consultas han sido **verificadas y probadas** contra el servidor de producción en https://postgres-bakend.2h4eh9.easypanel.host/