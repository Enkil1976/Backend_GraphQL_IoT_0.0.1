# Pruebas del Backend de Producción - API GraphQL IoT

## Información del Servidor
- **URL Producción**: https://postgres-bakend.2h4eh9.easypanel.host/
- **Endpoint GraphQL**: https://postgres-bakend.2h4eh9.easypanel.host/graphql
- **Estado**: ✅ ONLINE
- **Último chequeo**: 2025-07-12T04:22:08.772Z

## Autenticación

### 🔐 Login de Administrador
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

**Respuesta de prueba:**
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

## Consultas de Sensores

### 📡 Obtener Todos los Sensores
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

**Resultado de prueba:** 9 sensores activos
- `invernadero-agua-temp` (WATER_QUALITY)
- `invernadero-aguaph` (WATER_QUALITY) 
- `agua-quality-01` (WATER_QUALITY)
- `temhum1`, `temhum2`, `temhum3` (TEMHUM)
- `luxometro` (LIGHT)
- `bmp280-1` (TEMP_PRESSURE)
- Sistema de tipos de sensores (SYSTEM)

### 📊 Tipos de Sensores Disponibles
```
- WATER_QUALITY: Sensores de calidad del agua (pH, EC, PPM)
- TEMHUM: Sensores de temperatura y humedad
- LIGHT: Sensores de luz/luxómetro
- TEMP_PRESSURE: Sensores BMP280 (temperatura/presión)
- SYSTEM: Sensores del sistema
```

### 📊 Datos de Sensores en Tiempo Real (NUEVO - Implementado y Funcional)
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

### 🔍 Historial de Sensor Específico (TemHum3)
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

---

## Consultas de Dispositivos

### 🔌 Obtener Todos los Dispositivos
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

**Resultado de prueba:** 10 dispositivos
- 4 Bombas de agua auto-detectadas (`invernadero-*`)
- Sensores actuadores
- Calefactores
- Ventiladores  
- Luces LED
- Bomba principal

### 🎛️ Tipos de Dispositivos Disponibles
```
- WATER_PUMP: Bombas de agua
- VENTILATOR: Ventiladores
- HEATER: Calefactores
- LIGHTS: Luces LED
- RELAY: Relés
- SENSOR_ACTUATOR: Sensores con actuador
```

### ⚡ Control de Dispositivos
```graphql
# Encender/Apagar dispositivo
mutation ToggleDevice($deviceId: ID!) {
  toggleDevice(id: $deviceId) {
    id
    name
    status
  }
}
```

**Ejemplo de prueba:** Ventilador ID "2"
```json
{
  "data": {
    "toggleDevice": {
      "id": "2",
      "name": "Ventilador de Circulación", 
      "status": "ON"
    }
  }
}
```

---

## Sistema de Automatización

### 🤖 Obtener Reglas de Automatización
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

**Reglas activas en producción:**
1. **🚨 Temperatura Crítica 5°C** (Prioridad 10) - 149 ejecuciones
2. **🔥 Calefactor Auto - Temp <10°C** (Prioridad 9) - 638 ejecuciones
3. **💧 BOMBA ON/OFF** - Estados claros (Prioridad 9) - 575 ejecuciones cada una
4. **🌪️ Ventilador Auto** - Control por temperatura (Prioridad 7)
5. **💡 Iluminación programada** - 17:00 ON, 22:00 OFF (Prioridad 6)

### 📊 Estadísticas de Automatización
- **Total de reglas**: 13 reglas activas
- **Más ejecutada**: Calefactor automático (638 veces)
- **Sistema crítico**: Alertas de temperatura baja funcionando

### 🚰 Historial de Uso de la Bomba de Agua

**Estado Actual de la Bomba Principal**
```graphql
query GetPumpDevice {
  device(id: "1") {
    id
    name
    type
    status
    description
  }
}
```

**✅ Respuesta Verificada:**
```json
{
  "data": {
    "device": {
      "id": "1",
      "name": "Bomba de Agua Principal",
      "type": "WATER_PUMP",
      "status": "ON",
      "description": "Bomba principal para sistema de riego"
    }
  }
}
```

**Historial de Activaciones de Bomba (vía notificaciones)**
```graphql
query GetPumpHistory {
  notifications(limit: 50) {
    edges {
      node {
        id
        title
        message
        severity
        createdAt
      }
    }
  }
}
```

**✅ Estadísticas de Bomba Verificadas:**
- **Regla 20** (BOMBA ON): 671 ejecuciones exitosas
- **Regla 21** (BOMBA OFF): 670 ejecuciones exitosas  
- **Patrón**: 15 min ON → 15 min OFF (24/7)
- **Total operaciones**: 1,341 ciclos automáticos

### 📖 Detalles de Reglas Específicas

**Reglas de Bomba con Estadísticas**
```graphql
query GetPumpRules {
  rules(enabled: true) {
    id
    name
    description
    triggerCount
    enabled
    priority
  }
}
```

**✅ Reglas de Bomba Verificadas:**
- **Regla ID 20**: "💧 BOMBA ON - Estado Claro" (671 triggers)
- **Regla ID 21**: "💧 BOMBA OFF - Estado Claro" (670 triggers)

### 🗑️ Eliminar Reglas

**Eliminar Regla por ID**
```graphql
mutation DeleteRuleByID($ruleId: ID!) {
  deleteRule(id: $ruleId)
}
```

**Ejemplos de uso:**

*Eliminar Regla 3*
```graphql
mutation {
  deleteRule(id: "3")
}
```

*Eliminar Regla 22*
```graphql
mutation {
  deleteRule(id: "22")
}
```

---

## Sistema de Notificaciones

### 📢 Obtener Notificaciones Recientes (Excluyendo el campo 'type' debido a inconsistencia)
```graphql
query GetNotifications($limit: Int = 5) {
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

**Resultado de prueba:**
```json
{
  "data": {
    "notifications": {
      "edges": [
        {
          "node": {
            "id": "4419",
            "title": "Rule: 🔥 Calefactor Auto - Temp <10°C",
            "message": "🔥 CALEFACTOR ACTIVADO: Temperatura 8.3°C por debajo de 10°C. Calefactor encendido automáticamente para mantener condiciones óptimas.",
            "severity": "MEDIUM",
            "isRead": false,
            "createdAt": "2025-07-12T05:20:45.535Z"
          }
        },
        {
          "node": {
            "id": "4418",
            "title": "Rule: 💧 BOMBA OFF - Estado Claro",
            "message": "💧 BOMBA APAGADA ❌\n\n🚰 ESTADO ACTUAL: INACTIVA - En pausa\n⏱️ DURACIÓN PAUSA: 15 minutos\n🔄 PRÓXIMO ESTADO: Se encenderá automáticamente\n📊 CICLO: 15min OFF → 15min ON (continuo 24h)",
            "severity": "MEDIUM",
            "isRead": false,
            "createdAt": "2025-07-12T05:20:45.036Z"
          }
        },
        {
          "node": {
            "id": "4417",
            "title": "Rule: ⚠️ Temperatura Baja 18°C",
            "message": "⚠️ TEMPERATURA BAJA: Temperatura actual 8.3°C, por debajo del rango óptimo (18-23°C). Considera activar calefacción para mantener el ambiente ideal para las plantas.",
            "severity": "MEDIUM",
            "isRead": false,
            "createdAt": "2025-07-12T05:20:44.231Z"
          }
        },
        {
          "node": {
            "id": "4416",
            "title": "Rule: 🌪️ Ventilador OFF - Temp <21°C",
            "message": "🌪️ VENTILADOR DESACTIVADO: Temperatura 8.3°C por debajo de 21°C. Ventilador apagado, temperatura estabilizada en rango óptimo.",
            "severity": "MEDIUM",
            "isRead": false,
            "createdAt": "2025-07-12T05:20:43.348Z"
          }
        },
        {
          "node": {
            "id": "4415",
            "title": "Rule: 💧 BOMBA OFF - Estado Claro",
            "message": "💧 BOMBA APAGADA ❌\n\n🚰 ESTADO ACTUAL: INACTIVA - En pausa\n⏱️ DURACIÓN PAUSA: 15 minutos\n🔄 PRÓXIMO ESTADO: Se encenderá automáticamente\n📊 CICLO: 15min OFF → 15min ON (continuo 24h)",
            "severity": "MEDIUM",
            "isRead": false,
            "createdAt": "2025-07-12T05:15:15.805Z"
          }
        }
      ],
      "totalCount": 4419,
      "unreadCount": 4419
    }
  }
}
```

**Estado actual:**
- **Total de notificaciones**: 4,968
- **No leídas**: 4,968
- **Última actividad**: Control automático de bomba (💧 BOMBA OFF - 2025-07-12T20:20)

### 📄 Consultar Plantillas de Notificación
```graphql
query {
  notificationTemplates {
    id
    name
    description
    type
  }
}
```

**Resultado de prueba:**
```json
{
  "data": {
    "notificationTemplates": []
  }
}
```
**Estado actual:** No se encontraron plantillas de notificación.

### 📝 Resumen de Operaciones Disponibles para Notificaciones

**Consultas (Queries):**
- `notifications(unread: Boolean, channel: NotificationChannel, limit: Int, offset: Int): NotificationConnection!`
  - Obtiene una lista paginada de notificaciones, con opciones para filtrar por estado de lectura y canal.
- `notification(id: ID!): Notification`
  - Obtiene una notificación específica por su ID.
- `notificationTemplates: [NotificationTemplate!]!`
  - Obtiene todas las plantillas de notificación.
- `notificationTemplate(id: ID!): NotificationTemplate`
  - Obtiene una plantilla de notificación específica por su ID.

**Mutaciones (Mutations):**
- `markNotificationRead(id: ID!): Notification!`
  - Marca una notificación específica como leída.
- `markAllNotificationsRead: Boolean!`
  - Marca todas las notificaciones como leídas.
- `deleteNotification(id: ID!): Boolean!`
  - Elimina una notificación específica.
- `sendNotification(input: SendNotificationInput!): Notification!`
  - Envía una notificación personalizada.
- `createNotificationTemplate(input: CreateTemplateInput!): NotificationTemplate!`
  - Crea una nueva plantilla de notificación.
- `updateNotificationTemplate(id: ID!, input: UpdateTemplateInput!): NotificationTemplate!`
  - Actualiza una plantilla de notificación existente.
- `deleteNotificationTemplate(id: ID!): Boolean!`
  - Elimina una plantilla de notificación.

**Suscripciones (Subscriptions):**
- `newNotification: Notification!`
  - Recibe notificaciones en tiempo real cuando se crea una nueva.
- `notificationUpdated: Notification!`
  - Recibe actualizaciones en tiempo real de notificaciones existentes.

### ✉️ Enviar Notificaciones

**Enviar Notificación a Webhook (General)**
```graphql
mutation {
  sendNotification(
    input: {
      title: "Alerta Aleatoria del Sistema",
      message: "Un evento inesperado ha ocurrido en el sector Gamma-7. Se requiere atención inmediata.",
      type: INFO_MESSAGE,
      severity: LOW,
      channel: WEBHOOK
    }
  ) {
    id
    title
    message
  }
}
```

**Enviar Notificación a Telegram vía Webhook**
```graphql
mutation {
  sendNotification(
    input: {
      title: "Notificación de Prueba Telegram",
      message: "Mensaje de prueba enviado a Telegram vía Webhook.",
      type: INFO_MESSAGE,
      severity: LOW,
      channel: WEBHOOK,
      canal: telegram,
      targetChannel: webhook
    }
  ) {
    id
    title
    message
  }
}
```

**Enviar Notificación a WhatsApp vía Webhook**
```graphql
mutation {
  sendNotification(
    input: {
      title: "Notificación de Prueba WhatsApp",
      message: "Mensaje de prueba enviado a WhatsApp vía Webhook.",
      type: INFO_MESSAGE,
      severity: LOW,
      channel: WEBHOOK,
      canal: whatsapp,
      targetChannel: webhook
    }
  ) {
    id
    title
    message
  }
}
```

---

## 🚀 Comandos cURL Actualizados para Pruebas

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
  -d '{"query":"query { sensors { id name type isOnline location } }"}'
```

### Datos de Sensores en Tiempo Real
```bash
TOKEN="tu_token_aqui"
curl -X POST https://postgres-bakend.2h4eh9.easypanel.host/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { latestSensorData { id timestamp temperatura humedad rssi } }"}'
```

### Estado de la Bomba de Agua
```bash
TOKEN="tu_token_aqui"
curl -X POST https://postgres-bakend.2h4eh9.easypanel.host/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { device(id: \"1\") { id name type status description } }"}'
```

### Historial de Bomba (vía notificaciones)
```bash
TOKEN="tu_token_aqui"
curl -X POST https://postgres-bakend.2h4eh9.easypanel.host/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { notifications(limit: 20) { edges { node { title createdAt } } } }"}'
```

### Reglas de Automatización con Estadísticas
```bash
TOKEN="tu_token_aqui"
curl -X POST https://postgres-bakend.2h4eh9.easypanel.host/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { rules(enabled: true) { id name triggerCount priority } }"}'
```

### Datos Meteorológicos en Tiempo Real
```bash
TOKEN="tu_token_aqui"
curl -X POST https://postgres-bakend.2h4eh9.easypanel.host/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"query":"query { getCurrentWeather { temperatura humedad presion receivedAt } }"}'
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

## 📈 Resumen de Actualizaciones Verificadas

### ✅ Nuevas Consultas Funcionales Documentadas:

1. **Datos de Sensores en Tiempo Real** (`latestSensorData`)
   - Implementación completamente funcional
   - 8 sensores enviando datos activos
   - Incluye temperatura, humedad, pH, EC, light, watts, RSSI

2. **Historial Completo de Bomba de Agua**
   - Estado actual del dispositivo
   - Historial vía notificaciones (1,341 operaciones)
   - Estadísticas de reglas (671 ON + 670 OFF)
   - Patrón de ciclos 15 min ON/OFF verificado

3. **Datos Meteorológicos en Tiempo Real**
   - `getCurrentWeather` funcional con datos actuales
   - Temperatura: 5.3°C, Humedad: 81%, Presión: 1018 hPa
   - Timestamps en tiempo real

4. **Estadísticas de Sistema Actualizadas**
   - 4,968 notificaciones totales (actualizado desde 4,419)
   - Sistema de bomba con 1,341 ciclos exitosos
   - Más de 4,000 ejecuciones de reglas total

### 🎯 Queries Críticas para Monitoreo del Invernadero:

- **Monitoreo de sensores**: `latestSensorData`
- **Control de bomba**: `device(id: "1")` + `notifications`
- **Estado del clima**: `getCurrentWeather`
- **Automatización**: `rules` con `triggerCount`
- **Actividad del sistema**: `notifications` con filtros

Todas las consultas han sido verificadas contra el servidor de producción y están documentadas con respuestas reales del sistema.
