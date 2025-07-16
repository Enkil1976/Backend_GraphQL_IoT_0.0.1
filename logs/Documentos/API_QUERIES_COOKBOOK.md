# API GraphQL IoT - Cookbook de Consultas

## 🏠 Dashboard Principal del Invernadero

### Vista General del Sistema
```graphql
query DashboardOverview {
  # Estado de todos los sensores
  sensors {
    id
    name
    type
    isOnline
    location
  }
  
  # Estado de todos los dispositivos
  devices {
    id
    name
    type
    status
  }
  
  # Reglas activas
  rules(enabled: true) {
    id
    name
    priority
    triggerCount
    lastTriggered
  }
  
  # Notificaciones recientes
  notifications(limit: 5) {
    edges {
      node {
        id
        title
        severity
        createdAt
        isRead
      }
    }
    unreadCount
  }
}
```

---

## 🌡️ Monitoreo de Temperatura y Humedad

### Sensores de Clima Activos
```graphql
query ClimateMonitoring {
  sensors(types: [TEMHUM]) {
    id
    name
    hardwareId
    isOnline
    location
    mqttTopic
  }
}
```

### Control de Ventilación
```graphql
# Consultar estado del ventilador
query VentilatorStatus {
  devices(type: VENTILATOR) {
    id
    name
    status
    lastSeen
  }
}

# Encender ventilador manualmente
mutation TurnOnVentilator {
  toggleDevice(id: "2") {
    id
    name
    status
  }
}
```

### Reglas de Temperatura
```graphql
query TemperatureRules {
  rules(enabled: true) {
    id
    name
    description
    priority
    triggerCount
    enabled
  }
}
```

---

## 💧 Sistema de Riego y Calidad del Agua

### Monitoreo de Calidad del Agua
```graphql
query WaterQualityMonitoring {
  sensors(types: [WATER_QUALITY]) {
    id
    name
    hardwareId
    type
    isOnline
    mqttTopic
    location
  }
}
```

### Control de Bombas de Agua
```graphql
# Estado de todas las bombas
query WaterPumpStatus {
  devices(type: WATER_PUMP) {
    id
    name
    deviceId
    status
    lastSeen
  }
}

# Controlar bomba principal
mutation ToggleMainPump {
  toggleDevice(id: "1") {
    id
    name
    status
  }
}
```

### Reglas del Sistema de Riego
```graphql
query IrrigationRules {
  rules(enabled: true) {
    id
    name
    description
    priority
    triggerCount
    lastTriggered
  }
}
```

---

## 🔥 Sistema de Calefacción

### Control de Calefactores
```graphql
# Estado de calefactores
query HeatingStatus {
  devices(type: HEATER) {
    id
    name
    status
    lastSeen
  }
}

# Estado de relés de calefacción
query HeatingRelays {
  devices(type: RELAY) {
    id
    name
    deviceId
    status
  }
}

# Activar calefactor manualmente
mutation TurnOnHeater {
  toggleDevice(id: "4") {
    id
    name
    status
  }
}
```

---

## 💡 Sistema de Iluminación

### Control de Luces LED
```graphql
# Estado de iluminación
query LightingStatus {
  devices(type: LIGHTS) {
    id
    name
    status
    lastSeen
  }
}

# Sensores de luz
query LightSensors {
  sensors(types: [LIGHT]) {
    id
    name
    isOnline
    location
  }
}

# Control manual de luces
mutation ToggleLights {
  toggleDevice(id: "3") {
    id
    name
    status
  }
}
```

---

## 🚨 Sistema de Alertas y Notificaciones

### Alertas Críticas Recientes
```graphql
query CriticalAlerts {
  notifications(limit: 10) {
    edges {
      node {
        id
        title
        message
        severity
        createdAt
        isRead
      }
    }
    totalCount
    unreadCount
  }
}
```

### Marcar Notificación como Leída
```graphql
mutation MarkNotificationRead($notificationId: ID!) {
  markNotificationRead(id: $notificationId) {
    id
    isRead
    readAt
  }
}
```

### Reglas de Alerta por Prioridad
```graphql
query HighPriorityRules {
  rules(enabled: true) {
    id
    name
    description
    priority
    triggerCount
    lastTriggered
  }
}
```

---

## 🤖 Gestión de Automatización

### Crear Regla de Temperatura
```graphql
mutation CreateTemperatureRule {
  createRule(input: {
    name: "Control Automático Ventilador 25°C"
    description: "Encender ventilador cuando temperatura supere 25°C"
    enabled: true
    priority: 7
    cooldownMinutes: 5
    conditions: {
      operator: AND
      rules: [{
        type: SENSOR
        sensorId: "6"
        field: "temperatura"
        operator: GT
        value: 25.0
        dataAgeMinutes: 5
      }]
    }
    actions: [{
      type: DEVICE_CONTROL
      deviceId: "2"
      action: TURN_ON
    }]
  }) {
    id
    name
    enabled
    priority
  }
}
```

### Deshabilitar Regla
```graphql
mutation DisableRule($ruleId: ID!) {
  updateRule(id: $ruleId, input: { enabled: false }) {
    id
    name
    enabled
  }
}
```

---

## 🔧 Administración del Sistema

### Estado de Todos los Sensores
```graphql
query SystemSensorsOverview {
  sensors {
    id
    name
    hardwareId
    type
    isOnline
    location
    mqttTopic
    createdAt
    updatedAt
  }
}
```

### Estado de Todos los Dispositivos
```graphql
query SystemDevicesOverview {
  devices {
    id
    name
    deviceId
    type
    status
    description
    createdAt
    updatedAt
  }
}
```

### Usuario Actual
```graphql
query CurrentUser {
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

---

## 📊 Consultas de Datos Históricos

### Intentar Obtener Datos Recientes
```graphql
query LatestSensorData {
  latestSensorData {
    id
    timestamp
    temperatura
    humedad
    ph
    ec
    light
    watts
  }
}
```

### Historial de Sensor Específico
```graphql
query SensorHistory($sensorId: ID!, $limit: Int = 50) {
  sensorReadings(sensorId: $sensorId, limit: $limit) {
    edges {
      node {
        id
        timestamp
        temperatura
        humedad
        ph
        ec
        light
        rssi
        rawData
      }
    }
    totalCount
  }
}
```

---

## 🔄 Operaciones de Batch (Múltiples Dispositivos)

### Control de Múltiples Dispositivos
```graphql
# Encender calefactor y apagar ventilador simultáneamente
mutation WinterMode {
  heater: toggleDevice(id: "4") {
    id
    name
    status
  }
  
  fan: toggleDevice(id: "2") {
    id
    name  
    status
  }
}
```

### Estado de Dispositivos de Clima
```graphql
query ClimateDevicesStatus {
  heaters: devices(type: HEATER) {
    id
    name
    status
  }
  
  ventilators: devices(type: VENTILATOR) {
    id
    name
    status
  }
  
  lights: devices(type: LIGHTS) {
    id
    name
    status
  }
}
```

---

## 📱 Consultas para App Mobile

### Dashboard Simplificado
```graphql
query MobileDashboard {
  sensors {
    id
    name
    type
    isOnline
  }
  
  devices {
    id
    name
    type
    status
  }
  
  notifications(limit: 3) {
    edges {
      node {
        id
        title
        severity
        createdAt
      }
    }
    unreadCount
  }
}
```

### Control Rápido de Dispositivos
```graphql
query QuickControls {
  mainPump: devices(deviceId: "bomba_agua_01") {
    id
    name
    status
  }
  
  ventilator: devices(type: VENTILATOR) {
    id
    name
    status
  }
  
  heater: devices(type: HEATER) {
    id
    name
    status
  }
}
```

---

## 🔍 Consultas de Diagnóstico

### Verificar Conectividad MQTT
```graphql
query MQTTConnectivity {
  sensors {
    id
    name
    mqttTopic
    isOnline
    location
  }
}
```

### Reglas con Mayor Actividad
```graphql
query MostActiveRules {
  rules(enabled: true) {
    id
    name
    triggerCount
    lastTriggered
    priority
  }
}
```

### Dispositivos Offline
```graphql
query OfflineDevices {
  devices {
    id
    name
    status
    lastSeen
  }
}
```

---

## 🚀 Subscriptions (Tiempo Real)

### Actualizaciones de Sensores en Tiempo Real
```graphql
subscription SensorUpdates {
  sensorDataUpdated {
    id
    timestamp
    temperatura
    humedad
    ph
    ec
    light
    rawData
  }
}
```

### Cambios de Estado de Dispositivos
```graphql
subscription DeviceUpdates {
  deviceStatusChanged {
    id
    status
    lastSeen
  }
}
```

### Nuevas Notificaciones
```graphql
subscription NewNotifications {
  newNotification {
    id
    title
    message
    severity
    createdAt
  }
}
```

---

## 💡 Tips de Uso

### Autenticación en Headers
```javascript
// Para todas las consultas autenticadas
headers: {
  "Authorization": "Bearer YOUR_JWT_TOKEN",
  "Content-Type": "application/json"
}
```

### Variables de Consulta
```javascript
// Ejemplo con variables
const GET_SENSOR = gql`
  query GetSensor($sensorId: ID!) {
    sensor(id: $sensorId) {
      id
      name
      type
      isOnline
    }
  }
`;

// Variables
{
  "sensorId": "6"
}
```

### Manejo de Errores
```javascript
// Verificar errores en respuesta
if (response.errors) {
  console.error('GraphQL Errors:', response.errors);
  // Manejar errores específicos
  response.errors.forEach(error => {
    if (error.extensions?.code === 'UNAUTHENTICATED') {
      // Redirigir a login
    }
  });
}
```

---

## 📋 Checklist de Funcionalidades

### ✅ Funcionalidades Verificadas
- [x] Autenticación con admin/admin123
- [x] Consulta de sensores (9 sensores activos)
- [x] Consulta de dispositivos (10 dispositivos)
- [x] Control de dispositivos (toggle funcional)
- [x] Sistema de reglas (13 reglas activas)
- [x] Notificaciones (4,364 total)
- [x] MQTT auto-discovery funcionando
- [x] Ciclos automáticos de bomba

### ⚠️ Limitaciones Conocidas
- [ ] Datos históricos de sensores (vacíos)
- [ ] Campo `isOnline` en dispositivos (null error)
- [ ] Introspección de schema (deshabilitada)
- [ ] Algunos enums incompatibles

Esta guía proporciona consultas prácticas y funcionales verificadas contra el backend de producción en https://postgres-bakend.2h4eh9.easypanel.host/