# GraphQL API Documentation for Frontend Development

**Production API Endpoint**: `https://postgres-bakend.2h4eh9.easypanel.host/graphql`

**Health Check**: `https://postgres-bakend.2h4eh9.easypanel.host/health`

## ✅ READY FOR FRONTEND DEVELOPMENT

The API is fully operational and production-ready as of **January 8, 2025**.

### Quick Start Checklist
- ✅ **Authentication**: JWT tokens working
- ✅ **Real-time Sensor Data**: Temperature/humidity data available
- ✅ **Device Control**: 5 devices with real-time status
- ✅ **Notifications**: 590+ notifications with pagination
- ✅ **Health Monitoring**: All services operational
- ✅ **Error Handling**: Proper error responses
- ✅ **CORS**: Configured for frontend integration

### Production Status Summary
| Feature | Status | Notes |
|---------|--------|-------|
| Authentication | ✅ Working | JWT tokens, role-based access |
| Sensor Data (TEMHUM1/2) | ✅ Working | Live temperature/humidity data |
| Sensor Data (Water Quality) | ✅ Working | pH, EC, PPM measurements |
| Sensor Data (Light) | ⚠️ Ready | Tables created, awaiting MQTT data |
| Sensor Data (Power) | ⚠️ Ready | Tables created, awaiting MQTT data |
| Device Management | ✅ Working | 5 devices with real-time control |
| Notifications | ✅ Working | 590+ notifications, pagination |
| Rules Engine | ✅ Working | Automated rules with priorities |
| Health Monitoring | ✅ Working | System status endpoints |
| WebSocket Subscriptions | ✅ Working | Real-time updates |

## Authentication

### Login
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

**Response Example:**
```json
{
  "data": {
    "login": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "1",
        "username": "admin",
        "email": "admin@iot-greenhouse.com",
        "role": "ADMIN"
      }
    }
  }
}
```

### Authentication Headers
```
Authorization: Bearer <your_jwt_token>
```

### Current User Information
```graphql
query {
  me {
    id
    username
    email
    role
  }
}
```

## Sensor Data

### Latest Sensor Readings

#### Temperature and Humidity Sensors
```graphql
# Sensor TEMHUM1
query {
  latestSensorData(types: [TEMHUM1]) {
    timestamp
    temperatura
    humedad
  }
}

# Sensor TEMHUM2
query {
  latestSensorData(types: [TEMHUM2]) {
    timestamp
    temperatura
    humedad
  }
}
```

**Response Example (Live Production Data):**
```json
{
  "data": {
    "latestSensorData": [
      {
        "timestamp": "2025-07-08T21:47:11.833Z",
        "temperatura": 14.2,
        "humedad": 80.5
      },
      {
        "timestamp": "2025-07-08T21:47:08.439Z",
        "temperatura": 14.1,
        "humedad": 80.7
      }
    ]
  }
}
```

#### Water Quality Sensor
```graphql
query {
  latestSensorData(types: [CALIDAD_AGUA]) {
    timestamp
    ph
    ec
    ppm
  }
}
```

**Response Example:**
```json
{
  "data": {
    "latestSensorData": [
      {
        "timestamp": "2025-07-08T16:29:03.815Z",
        "ph": 5,
        "ec": 1000,
        "ppm": 1000
      }
    ]
  }
}
```

### Available Sensor Types
- `TEMHUM1` - Temperature/Humidity Sensor 1
- `TEMHUM2` - Temperature/Humidity Sensor 2
- `CALIDAD_AGUA` - Water Quality Sensor
- `LUXOMETRO` - Light Sensor
- `POWER_MONITOR` - Power Consumption Monitor

## Device Management

### Get All Devices
```graphql
query {
  devices {
    id
    name
    type
    status
    location
  }
}
```

**Response Example (Live Production Data):**
```json
{
  "data": {
    "devices": [
      {
        "id": "5",
        "name": "Calefactor de Agua",
        "type": "RELAY",
        "status": "OFFLINE",
        "location": null
      },
      {
        "id": "4",
        "name": "Calefactor Nocturno",
        "type": "HEATER",
        "status": "ON",
        "location": null
      },
      {
        "id": "3",
        "name": "Lámpara LED Crecimiento",
        "type": "LIGHTS",
        "status": "ON",
        "location": null
      },
      {
        "id": "2",
        "name": "Ventilador de Circulación",
        "type": "VENTILATOR",
        "status": "OFF",
        "location": null
      },
      {
        "id": "1",
        "name": "Bomba de Agua Principal",
        "type": "WATER_PUMP",
        "status": "ON",
        "location": null
      }
    ]
  }
}
```

### Device Control

#### Toggle Device Status
```graphql
mutation {
  toggleDevice(id: "2") {
    id
    name
    status
  }
}
```

#### Turn Device On
```graphql
mutation {
  turnOnDevice(id: "2") {
    id
    name
    status
  }
}
```

#### Turn Device Off
```graphql
mutation {
  turnOffDevice(id: "2") {
    id
    name
    status
  }
}
```

### Device Types
- `WATER_PUMP` - Bomba de Agua
- `VENTILATOR` - Ventilador
- `HEATER` - Calefactor
- `LIGHTS` - Iluminación LED
- `RELAY` - Relé genérico

### Device Status Values
- `ON` - Encendido
- `OFF` - Apagado
- `OFFLINE` - Sin conexión
- `ERROR` - Error
- `MAINTENANCE` - Mantenimiento

## Rules Engine

### Get All Rules
```graphql
query {
  rules {
    id
    name
    enabled
    priority
    description
  }
}
```

**Response Example:**
```json
{
  "data": {
    "rules": [
      {
        "id": "1",
        "name": "🚨 Temperatura Crítica 5°C",
        "enabled": true,
        "priority": 10,
        "description": "Alerta crítica por temperatura extremadamente baja"
      },
      {
        "id": "21",
        "name": "💧 BOMBA OFF - Estado Claro",
        "enabled": true,
        "priority": 9,
        "description": "Notificación específica cuando la bomba se apaga"
      }
    ]
  }
}
```

### Rule Priority Levels
- **10**: Crítico
- **9**: Muy Alto
- **8**: Alto
- **7**: Medio-Alto
- **6**: Medio
- **5**: Medio-Bajo

## User Management

### Get All Users
```graphql
query {
  users {
    id
    username
    email
    role
  }
}
```

### User Roles
- `ADMIN` - Administrador completo
- `USER` - Usuario estándar
- `VIEWER` - Solo lectura

## Health Monitoring

### System Health
```graphql
query {
  health {
    status
    timestamp
  }
}
```

**Response Example:**
```json
{
  "data": {
    "health": {
      "status": "OK",
      "timestamp": "2025-07-08T16:45:43.304Z"
    }
  }
}
```

## Real-time Subscriptions

### WebSocket Connection
```javascript
// Using graphql-ws
import { createClient } from 'graphql-ws';

const client = createClient({
  url: 'wss://postgres-bakend.2h4eh9.easypanel.host/graphql',
  connectionParams: {
    authorization: `Bearer ${token}`
  }
});
```

### Available Subscriptions
```graphql
# Sensor data updates
subscription {
  sensorDataUpdated(sensorTypes: [TEMHUM1]) {
    timestamp
    temperatura
    humedad
  }
}

# Device status changes
subscription {
  deviceStatusChanged {
    id
    name
    status
    updatedAt
  }
}
```

## Error Handling

### Common Error Codes
- `UNAUTHENTICATED` - Token inválido o faltante
- `FORBIDDEN` - Sin permisos suficientes
- `GRAPHQL_VALIDATION_FAILED` - Query malformada
- `INTERNAL_SERVER_ERROR` - Error interno del servidor

### Authentication Error Example
```json
{
  "errors": [
    {
      "message": "You must be logged in to view sensor data",
      "code": "UNAUTHENTICATED",
      "path": ["latestSensorData"]
    }
  ],
  "data": null
}
```

## Rate Limiting

The API implements rate limiting:
- **Window**: 15 minutes
- **Max Requests**: 100 per window
- **Headers**: Check `X-RateLimit-*` headers in responses

## Development Notes

### Token Expiration
- Access tokens expire in 1 hour
- Implement token refresh logic in your application
- Monitor for `UNAUTHENTICATED` errors

### Field Availability
Some fields may not be available in all queries. If you encounter `Cannot query field` errors, check the schema or remove the problematic field.

### Introspection
GraphQL introspection is disabled in production. Use this documentation for available fields and types.

### CORS
The API is configured to accept requests from common development origins. Ensure your frontend URL is in the allowed origins list.

## Frontend Integration Examples

### React with Apollo Client
```javascript
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: 'https://postgres-bakend.2h4eh9.easypanel.host/graphql',
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  }
});

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache()
});
```

### Fetch API Example
```javascript
const query = `
  query {
    devices {
      id
      name
      status
    }
  }
`;

const response = await fetch('https://postgres-bakend.2h4eh9.easypanel.host/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ query })
});

const data = await response.json();
```

## ✅ NOTIFICATIONS SYSTEM (UPDATED - WORKING)

### Get Notifications with Pagination
```graphql
query {
  notifications(limit: 10, offset: 0) {
    edges {
      node {
        id
        title
        message
        createdAt
        type
        channel
        isRead
        readAt
        deliveryStatus
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
    unreadCount
  }
}
```

**Response Example:**
```json
{
  "data": {
    "notifications": {
      "edges": [
        {
          "node": {
            "id": "590",
            "title": "Rule: ⚠️ Temperatura Baja 18°C",
            "message": "⚠️ TEMPERATURA BAJA: Temperatura actual 14.5°C, por debajo del rango óptimo (18-23°C).",
            "createdAt": "2025-07-08T21:45:42.832Z",
            "type": "ALERT",
            "channel": "WEBHOOK",
            "isRead": false,
            "readAt": null,
            "deliveryStatus": "SENT"
          }
        }
      ],
      "pageInfo": {
        "hasNextPage": true,
        "hasPreviousPage": false,
        "startCursor": "abc123",
        "endCursor": "xyz789"
      },
      "totalCount": 590,
      "unreadCount": 45
    }
  }
}
```

### Get Single Notification
```graphql
query {
  notification(id: "590") {
    id
    title
    message
    createdAt
    type
    channel
    isRead
    readAt
    deliveryStatus
    deliveredAt
    user {
      id
      username
    }
  }
}
```

### Filter Notifications
```graphql
# Get only unread notifications
query {
  notifications(unread: true, limit: 5) {
    edges {
      node {
        id
        title
        message
        createdAt
      }
    }
    unreadCount
  }
}

# Get notifications by channel
query {
  notifications(channel: "WEBHOOK", limit: 10) {
    edges {
      node {
        id
        title
        channel
        deliveryStatus
      }
    }
  }
}
```

### Mark Notification as Read
```graphql
mutation {
  markNotificationAsRead(id: "590") {
    id
    isRead
    readAt
  }
}
```

### Notification Types
- `ALERT` - Alertas del sistema
- `INFO_MESSAGE` - Mensajes informativos
- `WARNING` - Advertencias
- `ERROR` - Errores del sistema

### Notification Channels
- `WEBHOOK` - Webhook (n8n → WhatsApp)
- `EMAIL` - Correo electrónico
- `TELEGRAM` - Telegram
- `PUSH` - Notificaciones push

### Delivery Status
- `PENDING` - Pendiente de envío
- `SENT` - Enviado exitosamente
- `FAILED` - Error en el envío
- `DELIVERED` - Entregado y confirmado

## ✅ UPDATED SENSOR DATA STATUS

### Working Sensors (Live Data Available)
```graphql
# ✅ Temperature/Humidity Sensors - WORKING
query {
  latestSensorData(types: [TEMHUM1, TEMHUM2]) {
    timestamp
    temperatura
    humedad
  }
}

# ✅ Water Quality Sensor - WORKING
query {
  latestSensorData(types: [CALIDAD_AGUA]) {
    timestamp
    ph
    ec
    ppm
  }
}
```

### Sensors Ready for Data (Tables Created)
```graphql
# ⚠️ Light Sensor - Table ready, awaiting MQTT data
query {
  latestSensorData(types: [LUXOMETRO]) {
    timestamp
    light
    whiteLight
    rawLight
  }
}

# ⚠️ Power Monitor - Table ready, awaiting MQTT data
query {
  latestSensorData(types: [POWER_MONITOR]) {
    timestamp
    watts
    voltage
    current
    frequency
    powerFactor
  }
}
```

## ✅ PRODUCTION DEPLOYMENT STATUS

### API Health Check
```graphql
query {
  health {
    status
    timestamp
    services {
      database
      mqtt
      redis
    }
  }
}
```

**Current Status:**
- **Database**: OK
- **MQTT**: OK
- **Redis**: OK
- **API**: Fully operational

### Latest Test Results (January 8, 2025)
- ✅ **Authentication**: Working (JWT tokens)
- ✅ **Notifications**: 590 notifications, pagination working
- ✅ **Sensor Data**: Live temperature/humidity data
- ✅ **Device Management**: 5 devices with real-time status
- ✅ **Health Monitoring**: All services operational
- ✅ **Database**: All migrations applied successfully

## Known Limitations

1. **LUXOMETRO/POWER_MONITOR**: Tables exist but no sensor data yet (requires MQTT configuration)
2. **Real-time Subscriptions**: WebSocket connection requires proper reconnection logic
3. **Notification Templates**: Advanced template features may need additional UI integration