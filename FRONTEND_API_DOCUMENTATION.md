# GraphQL API Documentation for Frontend Development

**Production API Endpoint**: `https://postgres-bakend.2h4eh9.easypanel.host/graphql`

**Health Check**: `https://postgres-bakend.2h4eh9.easypanel.host/health`

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

**Response Example:**
```json
{
  "data": {
    "latestSensorData": [
      {
        "timestamp": "2025-07-08T17:12:03.165Z",
        "temperatura": 25.8,
        "humedad": 57.1
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

**Response Example:**
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
        "status": "OFFLINE",
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

## Known Issues

1. **Notifications Query**: The `notifications` query has server-side issues. Use alternative endpoints or wait for fixes.
2. **Schema Fields**: Some documented fields may not be available. Always test queries before implementing.
3. **Real-time Data**: WebSocket subscriptions require proper connection handling and reconnection logic.