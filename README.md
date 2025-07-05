# IoT Greenhouse GraphQL Backend

A modern GraphQL API server for the IoT Greenhouse monitoring system, built with Apollo Server, Express, and PostgreSQL.

## Features

- **GraphQL API** with queries, mutations, and real-time subscriptions
- **JWT Authentication** with role-based access control
- **Real-time Data** from MQTT sensors with WebSocket subscriptions
- **Rules Engine** for automated device control and notifications
- **Queue System** with Redis Streams for critical operations
- **Multi-channel Notifications** (webhook, email, telegram, etc.)
- **Comprehensive Device Management** with status tracking
- **Historical Data** storage and analysis
- **Health Monitoring** and diagnostic endpoints

## Tech Stack

- **GraphQL**: Apollo Server 3.x with subscriptions
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis for session management and real-time data
- **MQTT**: Real-time sensor data ingestion
- **Queue**: Redis Streams for reliable action processing
- **Authentication**: JWT tokens with refresh token support
- **Real-time**: WebSocket subscriptions for live updates

## Project Structure

```
Backend_GraphQL_IoT/
├── src/
│   ├── config/
│   │   ├── database.js          # PostgreSQL connection
│   │   └── redis.js             # Redis connection
│   ├── schema/
│   │   ├── typeDefs/            # GraphQL schema definitions
│   │   └── resolvers/           # GraphQL resolvers
│   ├── services/                # Business logic services
│   ├── utils/                   # Utility functions
│   ├── middleware/              # Express middleware
│   ├── schema/                  # Schema index and loader
│   └── server.js                # Main server setup
├── .env.example                 # Environment variables template
├── package.json                 # Dependencies and scripts
└── index.js                     # Entry point
```

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- PostgreSQL 12+
- Redis 6+
- MQTT broker (Mosquitto recommended)

### Installation

1. **Clone and install dependencies**:
```bash
cd Backend_GraphQL_IoT
npm install
```

2. **Setup environment variables**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Database setup**:
```bash
# Run SQL scripts from the original backend
psql your_database < ../Backend_Inv_IoT/sql/create_users_table.sql
psql your_database < ../Backend_Inv_IoT/sql/create_devices_table.sql
# ... run all other SQL scripts
```

4. **Start the server**:
```bash
npm start
```

The GraphQL server will be available at:
- **GraphQL Playground**: http://localhost:4000/graphql
- **Health Check**: http://localhost:4000/health
- **WebSocket Subscriptions**: ws://localhost:4000/graphql

## Environment Variables

```env
# Server Configuration
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invernadero_iot
DB_USER=your_username
DB_PASSWORD=your_password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# MQTT
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_USERNAME=your_mqtt_username
MQTT_PASSWORD=your_mqtt_password

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d

# Notifications
WEBHOOK_URL=https://your-n8n-webhook-url
WEBHOOK_SECRET=your-webhook-secret

# Frontend
FRONTEND_URL=http://localhost:5173
```

## API Examples

### Authentication

```graphql
# Login
mutation {
  login(username: "admin", password: "password") {
    token
    refreshToken
    user {
      id
      username
      email
      role
    }
    expiresIn
  }
}

# Get current user
query {
  me {
    id
    username
    email
    role
  }
}
```

### Sensor Data

```graphql
# Get latest sensor data
query {
  latestSensorData(sensorType: TEMHUM1) {
    timestamp
    temperature
    humidity
  }
}

# Subscribe to real-time sensor updates
subscription {
  sensorDataUpdated(sensorType: TEMHUM1) {
    timestamp
    temperature
    humidity
  }
}
```

### Device Management

```graphql
# Get all devices
query {
  devices {
    id
    name
    type
    status
    room
    configuration
  }
}

# Update device status
mutation {
  updateDeviceStatus(id: "device-id", status: "on") {
    id
    status
    updatedAt
  }
}

# Subscribe to device updates
subscription {
  deviceUpdated {
    id
    name
    status
    updatedAt
  }
}
```

### Rules Engine

```graphql
# Get all rules
query {
  rules {
    id
    name
    description
    enabled
    priority
    conditions
    actions
    lastTriggered
  }
}

# Create a new rule
mutation {
  createRule(input: {
    name: "High Temperature Alert"
    description: "Alert when temperature exceeds 30°C"
    enabled: true
    priority: 2
    conditions: [
      {
        type: "sensor"
        sensor: "temhum1"
        field: "temperature"
        operator: ">"
        value: 30
      }
    ]
    actions: [
      {
        type: "notification"
        notification: {
          title: "High Temperature Alert"
          message: "Temperature is {{temperature}}°C"
          priority: "high"
          channels: ["webhook"]
        }
      }
    ]
  }) {
    id
    name
    enabled
  }
}
```

### Notifications

```graphql
# Send notification
mutation {
  sendNotification(input: {
    title: "Test Notification"
    message: "This is a test message"
    priority: "medium"
    channels: ["webhook"]
  }) {
    id
    success
    results
  }
}

# Get notification history
query {
  notifications(limit: 20) {
    edges {
      node {
        id
        title
        message
        status
        createdAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

## Real-time Subscriptions

The GraphQL server supports real-time subscriptions for:

- **Sensor data updates**: Live sensor readings
- **Device status changes**: Device state modifications
- **Rule triggers**: Automation rule executions
- **Notifications**: Real-time notification delivery
- **Queue events**: Action processing status

### WebSocket Connection

```javascript
import { createClient } from 'graphql-ws';

const client = createClient({
  url: 'ws://localhost:4000/graphql',
  connectionParams: {
    authorization: `Bearer ${token}`
  }
});
```

## Services Architecture

### MQTT Service
- Connects to MQTT broker
- Ingests real-time sensor data
- Caches data in Redis
- Publishes GraphQL subscriptions

### Rules Engine
- Evaluates automation rules every 30 seconds
- Supports complex conditions (sensor thresholds, time windows, trends)
- Executes actions (device control, notifications)
- Implements priority-based cooldowns

### Queue Service
- Redis Streams-based action queue
- Reliable processing with Dead Letter Queue
- Retry mechanisms for failed actions
- Real-time queue monitoring

### Notification Service
- Multi-channel notification delivery
- Template processing with variables
- Webhook integration (n8n compatible)
- Delivery tracking and status

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Test specific service
npm run test:mqtt
```

## Deployment

### Docker

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4000
CMD ["npm", "start"]
```

### Environment

For production deployment:
1. Set `NODE_ENV=production`
2. Use secure JWT secrets
3. Configure proper CORS origins
4. Set up SSL termination
5. Configure Redis persistence
6. Set up database backups

## API Documentation

The GraphQL schema is self-documenting. Visit the GraphQL Playground at `/graphql` to explore:
- All available queries, mutations, and subscriptions
- Complete type definitions
- Field descriptions and examples
- Real-time query testing

## Migration from REST

This GraphQL backend maintains compatibility with the existing REST API data structures while providing:
- More efficient data fetching
- Real-time subscriptions
- Type safety
- Better developer experience
- Reduced API calls

## Health Monitoring

- **Health endpoint**: `/health`
- **Service status**: MQTT, Rules Engine, Queue processor
- **GraphQL introspection**: Available in development
- **Error tracking**: Comprehensive logging

## Contributing

1. Follow the existing code structure
2. Add appropriate error handling
3. Write tests for new features
4. Update documentation
5. Maintain backward compatibility

## License

This project is part of the IoT Greenhouse monitoring system.