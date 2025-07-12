# API Documentation - Backend GraphQL IoT

## Overview

The GraphQL IoT Backend provides a comprehensive API for managing an IoT greenhouse monitoring system. This documentation covers all available queries, mutations, subscriptions, and types.

## GraphQL Endpoint

- **URL**: `http://localhost:4000/graphql`
- **WebSocket**: `ws://localhost:4000/graphql`
- **Playground**: Available in development mode

## Authentication

All requests require JWT authentication except for login and some public queries.

### Headers
```json
{
  "Authorization": "Bearer <your-jwt-token>"
}
```

### Authentication Flow
```graphql
# 1. Login
mutation Login {
  login(username: "admin", password: "password") {
    token
    refreshToken
    user {
      id
      username
      role
    }
    expiresIn
  }
}

# 2. Refresh Token
mutation RefreshToken {
  refreshToken(refreshToken: "your-refresh-token") {
    token
    refreshToken
    expiresIn
  }
}

# 3. Get Current User
query Me {
  me {
    id
    username
    email
    role
    firstName
    lastName
  }
}
```

## User Management

### User Queries
```graphql
# Get current user
query GetCurrentUser {
  me {
    id
    username
    email
    role
    firstName
    lastName
    isActive
    lastLogin
    configurations {
      id
      configName
      isActive
    }
    ownedDevices {
      id
      name
      status
    }
  }
}

# Get all users (admin only)
query GetAllUsers {
  users(role: ADMIN, active: true) {
    id
    username
    email
    role
    isActive
    createdAt
  }
}

# Get user by ID
query GetUser {
  user(id: "user-id") {
    id
    username
    email
    role
  }
}
```

### User Mutations
```graphql
# Register new user
mutation RegisterUser {
  register(input: {
    username: "newuser"
    email: "user@example.com"
    password: "StrongPassword123!"
    firstName: "John"
    lastName: "Doe"
  }) {
    success
    message
    user {
      id
      username
    }
    token
  }
}

# Update profile
mutation UpdateProfile {
  updateProfile(input: {
    firstName: "Jane"
    lastName: "Smith"
    email: "jane@example.com"
    timezone: "America/Santiago"
    notifications: {
      email: true
      push: true
      deviceAlerts: true
    }
  }) {
    id
    firstName
    lastName
    email
  }
}

# Change password
mutation ChangePassword {
  changePassword(
    currentPassword: "oldPassword"
    newPassword: "NewStrongPassword123!"
  )
}

# Update user role (admin only)
mutation UpdateUserRole {
  updateUserRole(userId: "user-id", role: EDITOR) {
    id
    username
    role
  }
}
```

## Sensor Data

### Sensor Queries
```graphql
# Get latest sensor data
query GetLatestSensorData {
  latestSensorData(sensorType: TEMHUM1) {
    timestamp
    temperature
    humidity
    heatIndex
    dewPoint
    rssi
    batteryLevel
    stats {
      temperatureMin
      temperatureMax
      temperatureAvg
      humidityMin
      humidityMax
      humidityAvg
    }
  }
}

# Get sensor history with pagination
query GetSensorHistory {
  sensorHistory(
    sensorType: CALIDAD_AGUA
    limit: 50
    offset: 0
    startDate: "2024-01-01T00:00:00Z"
    endDate: "2024-01-31T23:59:59Z"
  ) {
    edges {
      node {
        timestamp
        ph
        ec
        ppm
        temperature
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      totalCount
    }
  }
}

# Get sensor statistics
query GetSensorStats {
  sensorStatistics(
    sensorType: POWER_MONITOR
    startDate: "2024-01-01T00:00:00Z"
    endDate: "2024-01-31T23:59:59Z"
  ) {
    totalReadings
    dataQuality
    sensorUptime
    averageValues
    trendAnalysis {
      direction
      changeRate
      correlation
    }
  }
}

# Get chart data for sensors
query GetSensorChartData {
  sensorChartData(
    sensorType: TEMHUM2
    period: LAST_24_HOURS
    interval: HOURLY
  ) {
    labels
    datasets {
      field
      data
      backgroundColor
      borderColor
    }
  }
}
```

### Sensor Subscriptions
```graphql
# Subscribe to real-time sensor updates
subscription SensorDataUpdated {
  sensorDataUpdated(sensorType: TEMHUM1) {
    timestamp
    temperature
    humidity
    location
  }
}

# Subscribe to all sensor updates
subscription AllSensorUpdates {
  sensorDataUpdated {
    sensorType
    timestamp
    data
  }
}
```

## Device Management

### Device Queries
```graphql
# Get all devices
query GetDevices {
  devices(status: ACTIVE, type: WATER_PUMP) {
    id
    name
    type
    status
    location
    configuration
    capabilities {
      name
      type
      readable
      writable
      unit
      minValue
      maxValue
    }
    maintenanceStatus
    operatingHours
    owner {
      id
      username
    }
    lastEvent {
      id
      eventType
      triggeredAt
    }
  }
}

# Get device by ID
query GetDevice {
  device(id: "device-id") {
    id
    name
    type
    status
    description
    location
    configuration
    events(limit: 10) {
      id
      eventType
      previousValue
      newValue
      triggeredAt
      triggeredBy {
        id
        username
      }
    }
  }
}

# Get device history
query GetDeviceHistory {
  deviceHistory(deviceId: "device-id", limit: 50) {
    id
    eventType
    previousValue
    newValue
    triggeredAt
    success
    error
  }
}
```

### Device Mutations
```graphql
# Create new device
mutation CreateDevice {
  createDevice(input: {
    name: "Water Pump 1"
    type: WATER_PUMP
    description: "Main irrigation pump"
    location: "Section A"
    configuration: {
      maxFlowRate: 100
      autoShutoff: true
      safetyTimeout: 300
    }
  }) {
    id
    name
    type
    status
  }
}

# Update device
mutation UpdateDevice {
  updateDevice(id: "device-id", input: {
    name: "Updated Pump Name"
    location: "Section B"
    configuration: {
      maxFlowRate: 120
    }
  }) {
    id
    name
    location
    updatedAt
  }
}

# Control device
mutation ToggleDevice {
  toggleDevice(id: "device-id") {
    id
    status
    updatedAt
  }
}

mutation SetDeviceValue {
  setDeviceValue(id: "device-id", capability: "brightness", value: 75) {
    id
    status
    updatedAt
  }
}

# Delete device
mutation DeleteDevice {
  deleteDevice(id: "device-id")
}
```

### Device Subscriptions
```graphql
# Subscribe to device status changes
subscription DeviceStatusChanged {
  deviceStatusChanged(deviceId: "device-id") {
    id
    status
    updatedAt
  }
}

# Subscribe to device value changes
subscription DeviceValueChanged {
  deviceValueChanged {
    id
    capability
    previousValue
    newValue
    updatedAt
  }
}
```

## Rules Engine

### Rule Queries
```graphql
# Get all rules
query GetRules {
  rules(enabled: true, priority: HIGH) {
    id
    name
    description
    enabled
    priority
    conditions
    actions
    triggerCount
    lastExecution {
      id
      success
      triggeredAt
      executionTimeMs
    }
    createdBy {
      id
      username
    }
  }
}

# Get rule by ID
query GetRule {
  rule(id: "rule-id") {
    id
    name
    description
    enabled
    priority
    conditions
    actions
    cooldownPeriod
    maxExecutionsPerHour
    nextEvaluation
    statistics(timeRange: { from: "2024-01-01", to: "2024-01-31" }) {
      totalExecutions
      successfulExecutions
      failedExecutions
      averageExecutionTime
      executionHistory {
        timestamp
        executionCount
        success
      }
    }
  }
}

# Test rule conditions
query TestRule {
  testRule(id: "rule-id") {
    conditionsMet
    evaluationTime
    details {
      conditionIndex
      result
      actualValue
      expectedValue
    }
  }
}

# Validate rule
query ValidateRule {
  validateRule(input: {
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
        type: "device"
        deviceId: "fan-1"
        action: "turn_on"
      }
    ]
  }) {
    valid
    errors
    warnings
  }
}
```

### Rule Mutations
```graphql
# Create rule
mutation CreateRule {
  createRule(input: {
    name: "High Temperature Alert"
    description: "Turn on fan when temperature exceeds 30°C"
    enabled: true
    priority: HIGH
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
        type: "device"
        deviceId: "fan-1"
        action: "turn_on"
      },
      {
        type: "notification"
        notification: {
          title: "High Temperature"
          message: "Temperature is {{temperature}}°C"
          priority: "high"
          channels: ["webhook"]
        }
      }
    ]
    cooldownPeriod: 300
    maxExecutionsPerHour: 10
  }) {
    id
    name
    enabled
  }
}

# Update rule
mutation UpdateRule {
  updateRule(id: "rule-id", input: {
    enabled: false
    priority: MEDIUM
  }) {
    id
    enabled
    priority
    updatedAt
  }
}

# Trigger rule manually
mutation TriggerRule {
  triggerRule(id: "rule-id") {
    success
    executionId
    message
  }
}

# Enable/Disable rule
mutation EnableRule {
  enableRule(id: "rule-id") {
    id
    enabled
  }
}

# Delete rule
mutation DeleteRule {
  deleteRule(id: "rule-id")
}
```

## Notifications

### Notification Queries
```graphql
# Get notifications
query GetNotifications {
  notifications(unread: true, channel: EMAIL, limit: 20) {
    edges {
      node {
        id
        title
        message
        type
        severity
        channel
        isRead
        readAt
        user {
          id
          username
        }
        source
        deliveryStatus
        createdAt
      }
    }
    pageInfo {
      hasNextPage
      totalCount
      unreadCount
    }
  }
}

# Get notification templates
query GetNotificationTemplates {
  notificationTemplates {
    id
    name
    description
    type
    titleTemplate
    messageTemplate
    supportedChannels
    variables {
      name
      type
      description
      required
    }
    createdBy {
      id
      username
    }
  }
}
```

### Notification Mutations
```graphql
# Send custom notification
mutation SendNotification {
  sendNotification(input: {
    title: "Custom Alert"
    message: "This is a custom notification"
    type: WARNING
    severity: HIGH
    channel: WEBHOOK
    userId: "user-id"
    variables: {
      temperature: 35.5
      location: "Greenhouse A"
    }
  }) {
    id
    title
    deliveryStatus
    createdAt
  }
}

# Mark notification as read
mutation MarkNotificationRead {
  markNotificationRead(id: "notification-id") {
    id
    isRead
    readAt
  }
}

# Create notification template
mutation CreateNotificationTemplate {
  createNotificationTemplate(input: {
    name: "Temperature Alert Template"
    description: "Template for temperature alerts"
    type: SENSOR_ALERT
    titleTemplate: "Temperature Alert - {{location}}"
    messageTemplate: "Temperature is {{temperature}}°C in {{location}}"
    supportedChannels: [EMAIL, WEBHOOK]
    variables: [
      {
        name: "temperature"
        type: "number"
        description: "Current temperature"
        required: true
      },
      {
        name: "location"
        type: "string"
        description: "Location name"
        required: true
      }
    ]
  }) {
    id
    name
    createdAt
  }
}
```

### Notification Subscriptions
```graphql
# Subscribe to new notifications
subscription NewNotifications {
  newNotification {
    id
    title
    message
    type
    severity
    createdAt
  }
}

# Subscribe to notification updates
subscription NotificationUpdated {
  notificationUpdated {
    id
    isRead
    deliveryStatus
    updatedAt
  }
}
```

## Weather API

### Weather Queries
```graphql
# Get current weather
query GetCurrentWeather {
  getCurrentWeather(location: "Santiago, Chile") {
    id
    temperatura
    humedad
    condicion
    visibilidad
    vientoVelocidad
    vientoDireccion
    presion
    location {
      name
      country
      latitude
      longitude
      timezone
    }
    receivedAt
  }
}

# Get weather history
query GetWeatherHistory {
  getWeatherHistory(hours: 48, limit: 100) {
    edges {
      node {
        id
        temperatura
        humedad
        condicion
        receivedAt
      }
    }
    pageInfo {
      hasNextPage
      totalCount
    }
  }
}

# Get weather statistics
query GetWeatherStats {
  getWeatherStats(days: 7) {
    period
    totalReadings
    dailyStats {
      fecha
      temperatura {
        promedio
        minimo
        maximo
      }
      humedad {
        promedio
        minimo
        maximo
      }
    }
    overallStats {
      temperatura {
        promedio
        minimo
        maximo
      }
    }
  }
}
```

### Weather Mutations
```graphql
# Collect weather data
mutation CollectWeatherData {
  collectWeatherData(location: "Villarrica, Chile") {
    success
    message
    data {
      id
      temperatura
      humedad
      condicion
    }
    errors
  }
}

# Update weather configuration (admin only)
mutation UpdateWeatherConfig {
  updateWeatherConfig(input: {
    location: "Las Chilcas, Villarrica, Chile"
    apiKey: "new-api-key"
    enabled: true
  }) {
    success
    config {
      currentLocation
      isConfigured
      lastUpdated
    }
  }
}
```

## Health and System Status

### Health Queries
```graphql
# System health check
query HealthCheck {
  health {
    status
    timestamp
    version
    uptime
    services {
      database
      redis
      mqtt
      rulesEngine
      queueProcessor
    }
  }
}

# Service diagnostics
query ServiceDiagnostics {
  diagnostics {
    mqtt {
      connected
      lastMessage
      subscribedTopics
    }
    rules {
      activeRules
      lastEvaluation
      queuedActions
    }
    queue {
      pendingActions
      failedActions
      processingRate
    }
  }
}
```

## Error Handling

### Error Types
- `AuthenticationError`: User not authenticated
- `ForbiddenError`: Insufficient permissions
- `ValidationError`: Input validation failed
- `NotFoundError`: Resource not found
- `InternalError`: System error

### Error Response Format
```json
{
  "errors": [
    {
      "message": "Authentication required",
      "code": "AUTHENTICATION_ERROR",
      "path": ["me"]
    }
  ],
  "data": null
}
```

## Rate Limiting

- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 attempts per 15 minutes per IP
- **User-specific**: 1000 requests per hour per authenticated user

## Pagination

Connection-based pagination with cursors:

```graphql
query PaginatedQuery {
  items(first: 10, after: "cursor") {
    edges {
      cursor
      node {
        id
        name
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
```

## Real-time Subscriptions

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

### Subscription Patterns
- **Sensor Data**: Real-time sensor readings
- **Device Control**: Device status changes
- **Rule Execution**: Automation events
- **Notifications**: Alert delivery
- **System Events**: Health and diagnostics

## Examples and Use Cases

### Dashboard Data Loading
```graphql
query DashboardData {
  me {
    id
    username
    role
  }
  devices(status: ACTIVE) {
    id
    name
    status
    type
  }
  latestSensorData(sensorType: TEMHUM1) {
    temperature
    humidity
    timestamp
  }
  notifications(unread: true, limit: 5) {
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

### Automation Setup
```graphql
mutation SetupAutomation {
  createRule(input: {
    name: "Irrigation Control"
    conditions: [
      {
        type: "sensor"
        sensor: "calidad_agua"
        field: "ph"
        operator: "<"
        value: 6.0
      }
    ]
    actions: [
      {
        type: "device"
        deviceId: "water-pump-1"
        action: "turn_on"
        duration: 300
      }
    ]
  }) {
    id
    name
  }
}
```

### Real-time Monitoring
```graphql
subscription MonitorSystem {
  sensorDataUpdated {
    sensorType
    timestamp
    data
  }
  deviceStatusChanged {
    id
    status
    updatedAt
  }
  newNotification {
    title
    severity
    createdAt
  }
}
```

This documentation provides comprehensive coverage of the GraphQL IoT Backend API. For more detailed information about specific types and fields, use the GraphQL Playground introspection feature in development mode.