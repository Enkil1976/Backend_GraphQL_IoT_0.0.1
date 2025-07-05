# Testing Guide - Backend GraphQL IoT

## Overview

This guide covers comprehensive testing strategies for the GraphQL IoT Backend, including unit tests, integration tests, performance tests, and security tests.

## Test Structure

```
Backend_GraphQL_IoT/
├── src/
│   └── tests/
│       ├── unit/
│       │   ├── services/
│       │   ├── resolvers/
│       │   └── utils/
│       ├── integration/
│       │   ├── graphql/
│       │   ├── mqtt/
│       │   └── database/
│       ├── e2e/
│       │   └── workflows/
│       ├── performance/
│       │   └── load-tests/
│       └── security/
│           └── vulnerability-tests/
├── test-config/
│   ├── jest.config.js
│   ├── setup.js
│   └── teardown.js
└── test-data/
    ├── fixtures/
    └── mocks/
```

## Testing Dependencies

### Install Testing Framework

```bash
# Core testing dependencies
npm install --save-dev jest supertest graphql-request
npm install --save-dev @apollo/server-testing
npm install --save-dev redis-memory-server
npm install --save-dev mongodb-memory-server

# Additional testing utilities
npm install --save-dev faker @faker-js/faker
npm install --save-dev nock # HTTP mocking
npm install --save-dev ws # WebSocket testing
npm install --save-dev artillery # Load testing

# Test coverage
npm install --save-dev nyc
```

### Jest Configuration

Create `jest.config.js`:

```javascript
module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/**/*.test.js',
    '!src/server.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/test-config/setup.js'],
  globalTeardown: '<rootDir>/test-config/teardown.js',
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.js',
    '<rootDir>/src/**/*.test.js'
  ],
  testTimeout: 30000,
  verbose: true
};
```

## Unit Tests

### Service Layer Testing

#### Auth Service Tests

```javascript
// src/tests/unit/services/authService.test.js
const authService = require('../../../services/authService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('AuthService', () => {
  describe('validatePassword', () => {
    test('should validate correct password', async () => {
      const password = 'testPassword123';
      const hashedPassword = await bcrypt.hash(password, 12);
      
      const result = await authService.validatePassword(password, hashedPassword);
      expect(result).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword';
      const hashedPassword = await bcrypt.hash(password, 12);
      
      const result = await authService.validatePassword(wrongPassword, hashedPassword);
      expect(result).toBe(false);
    });
  });

  describe('generateToken', () => {
    test('should generate valid JWT token', () => {
      const user = { id: 1, username: 'testuser', role: 'admin' };
      const token = authService.generateToken(user);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(user.id);
      expect(decoded.username).toBe(user.username);
      expect(decoded.role).toBe(user.role);
    });
  });

  describe('hasRole', () => {
    test('should validate admin role correctly', () => {
      expect(authService.hasRole('admin', 'admin')).toBe(true);
      expect(authService.hasRole('admin', 'editor')).toBe(true);
      expect(authService.hasRole('admin', 'operator')).toBe(true);
      expect(authService.hasRole('admin', 'viewer')).toBe(true);
    });

    test('should validate editor role correctly', () => {
      expect(authService.hasRole('editor', 'admin')).toBe(false);
      expect(authService.hasRole('editor', 'editor')).toBe(true);
      expect(authService.hasRole('editor', 'operator')).toBe(true);
      expect(authService.hasRole('editor', 'viewer')).toBe(true);
    });
  });
});
```

#### Device Service Tests

```javascript
// src/tests/unit/services/deviceService.test.js
const deviceService = require('../../../services/deviceService');
const { query } = require('../../../config/database');

// Mock database queries
jest.mock('../../../config/database');

describe('DeviceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDevices', () => {
    test('should return all devices when no filters provided', async () => {
      const mockDevices = [
        { id: 1, name: 'Device 1', status: 'active' },
        { id: 2, name: 'Device 2', status: 'inactive' }
      ];
      
      query.mockResolvedValue({ rows: mockDevices });
      
      const result = await deviceService.getDevices();
      
      expect(result).toEqual(mockDevices);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM devices'),
        []
      );
    });

    test('should filter devices by status', async () => {
      const mockDevices = [
        { id: 1, name: 'Device 1', status: 'active' }
      ];
      
      query.mockResolvedValue({ rows: mockDevices });
      
      const result = await deviceService.getDevices({ status: 'active' });
      
      expect(result).toEqual(mockDevices);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['active']
      );
    });
  });

  describe('createDevice', () => {
    test('should create device with valid data', async () => {
      const deviceData = {
        name: 'Test Device',
        type: 'WATER_PUMP',
        description: 'Test description'
      };
      
      const mockCreatedDevice = {
        id: 1,
        ...deviceData,
        status: 'inactive',
        created_at: new Date()
      };
      
      query.mockResolvedValue({ rows: [mockCreatedDevice] });
      
      const result = await deviceService.createDevice(deviceData);
      
      expect(result).toEqual(mockCreatedDevice);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO devices'),
        expect.arrayContaining([deviceData.name, deviceData.type])
      );
    });
  });
});
```

### Resolver Testing

#### Query Resolver Tests

```javascript
// src/tests/unit/resolvers/Query/devices.test.js
const deviceResolvers = require('../../../../schema/resolvers/Query/devices');
const deviceService = require('../../../../services/deviceService');
const { AuthenticationError, ForbiddenError } = require('apollo-server-express');

jest.mock('../../../../services/deviceService');

describe('Device Query Resolvers', () => {
  const mockContext = {
    user: { id: 1, username: 'testuser', role: 'admin' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('devices', () => {
    test('should return devices for authenticated user', async () => {
      const mockDevices = [
        { id: 1, name: 'Device 1' },
        { id: 2, name: 'Device 2' }
      ];
      
      deviceService.getDevices.mockResolvedValue(mockDevices);
      
      const result = await deviceResolvers.devices(null, {}, mockContext);
      
      expect(result).toEqual(mockDevices);
      expect(deviceService.getDevices).toHaveBeenCalledWith({});
    });

    test('should throw authentication error for unauthenticated user', async () => {
      const unauthenticatedContext = { user: null };
      
      await expect(
        deviceResolvers.devices(null, {}, unauthenticatedContext)
      ).rejects.toThrow(AuthenticationError);
    });

    test('should filter devices by status', async () => {
      const mockDevices = [{ id: 1, name: 'Active Device', status: 'active' }];
      
      deviceService.getDevices.mockResolvedValue(mockDevices);
      
      const result = await deviceResolvers.devices(
        null, 
        { status: 'active' }, 
        mockContext
      );
      
      expect(result).toEqual(mockDevices);
      expect(deviceService.getDevices).toHaveBeenCalledWith({ status: 'active' });
    });
  });
});
```

#### Mutation Resolver Tests

```javascript
// src/tests/unit/resolvers/Mutation/auth.test.js
const authResolvers = require('../../../../schema/resolvers/Mutation/auth');
const authService = require('../../../../services/authService');
const { UserInputError } = require('apollo-server-express');

jest.mock('../../../../services/authService');

describe('Auth Mutation Resolvers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    test('should login successfully with valid credentials', async () => {
      const mockAuthResult = {
        success: true,
        user: { id: 1, username: 'testuser', role: 'admin' },
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600
      };
      
      authService.login.mockResolvedValue(mockAuthResult);
      
      const result = await authResolvers.login(
        null,
        { input: { username: 'testuser', password: 'password' } },
        {}
      );
      
      expect(result).toEqual(mockAuthResult);
      expect(authService.login).toHaveBeenCalledWith('testuser', 'password');
    });

    test('should throw error for missing credentials', async () => {
      await expect(
        authResolvers.login(
          null,
          { input: { username: '', password: '' } },
          {}
        )
      ).rejects.toThrow(UserInputError);
    });
  });

  describe('register', () => {
    test('should register new user successfully', async () => {
      const mockRegisterResult = {
        success: true,
        message: 'Registration successful',
        user: { id: 1, username: 'newuser', email: 'test@example.com' },
        token: 'mock-jwt-token'
      };
      
      authService.register.mockResolvedValue(mockRegisterResult);
      
      const input = {
        username: 'newuser',
        email: 'test@example.com',
        password: 'SecurePassword123!'
      };
      
      const result = await authResolvers.register(null, { input }, {});
      
      expect(result).toEqual(mockRegisterResult);
      expect(authService.register).toHaveBeenCalledWith(input);
    });
  });
});
```

## Integration Tests

### GraphQL API Integration Tests

```javascript
// src/tests/integration/graphql/auth.integration.test.js
const { createTestClient } = require('apollo-server-testing');
const { gql } = require('apollo-server-express');
const { createApolloServer } = require('../../../server');

describe('Auth GraphQL Integration', () => {
  let server;
  let testClient;

  beforeAll(async () => {
    server = createApolloServer();
    testClient = createTestClient(server);
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('Login Mutation', () => {
    const LOGIN_MUTATION = gql`
      mutation Login($username: String!, $password: String!) {
        login(username: $username, password: $password) {
          success
          token
          user {
            id
            username
            role
          }
        }
      }
    `;

    test('should login with valid credentials', async () => {
      const { mutate } = testClient;
      
      const result = await mutate({
        mutation: LOGIN_MUTATION,
        variables: {
          username: 'admin',
          password: 'password'
        }
      });

      expect(result.errors).toBeUndefined();
      expect(result.data.login.success).toBe(true);
      expect(result.data.login.token).toBeDefined();
      expect(result.data.login.user.username).toBe('admin');
    });

    test('should fail with invalid credentials', async () => {
      const { mutate } = testClient;
      
      const result = await mutate({
        mutation: LOGIN_MUTATION,
        variables: {
          username: 'admin',
          password: 'wrongpassword'
        }
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain('Invalid credentials');
    });
  });

  describe('Protected Queries', () => {
    const ME_QUERY = gql`
      query Me {
        me {
          id
          username
          email
          role
        }
      }
    `;

    test('should return user data when authenticated', async () => {
      // First login to get token
      const loginResult = await testClient.mutate({
        mutation: LOGIN_MUTATION,
        variables: { username: 'admin', password: 'password' }
      });

      const token = loginResult.data.login.token;

      // Then query with token
      const { query } = createTestClient(server, {
        req: { headers: { authorization: `Bearer ${token}` } }
      });

      const result = await query({ query: ME_QUERY });

      expect(result.errors).toBeUndefined();
      expect(result.data.me.username).toBe('admin');
    });

    test('should fail when not authenticated', async () => {
      const { query } = testClient;
      
      const result = await query({ query: ME_QUERY });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].extensions.code).toBe('UNAUTHENTICATED');
    });
  });
});
```

### Database Integration Tests

```javascript
// src/tests/integration/database/user.integration.test.js
const { query } = require('../../../config/database');
const authService = require('../../../services/authService');

describe('User Database Integration', () => {
  beforeEach(async () => {
    // Clean up test data
    await query('DELETE FROM users WHERE username LIKE $1', ['test_%']);
  });

  afterAll(async () => {
    // Final cleanup
    await query('DELETE FROM users WHERE username LIKE $1', ['test_%']);
  });

  describe('User Registration', () => {
    test('should create user in database', async () => {
      const userData = {
        username: 'test_user',
        email: 'test@example.com',
        password: 'SecurePassword123!'
      };

      const result = await authService.register(userData);

      expect(result.success).toBe(true);
      expect(result.user.username).toBe(userData.username);

      // Verify user exists in database
      const dbResult = await query(
        'SELECT * FROM users WHERE username = $1',
        [userData.username]
      );

      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].email).toBe(userData.email);
    });

    test('should prevent duplicate usernames', async () => {
      const userData = {
        username: 'test_duplicate',
        email: 'test1@example.com',
        password: 'SecurePassword123!'
      };

      // Create first user
      await authService.register(userData);

      // Try to create duplicate
      const duplicateData = {
        ...userData,
        email: 'test2@example.com'
      };

      await expect(authService.register(duplicateData))
        .rejects.toThrow('Username already exists');
    });
  });

  describe('User Authentication', () => {
    beforeEach(async () => {
      // Create test user
      await authService.register({
        username: 'test_auth_user',
        email: 'auth@example.com',
        password: 'SecurePassword123!'
      });
    });

    test('should authenticate valid user', async () => {
      const result = await authService.login('test_auth_user', 'SecurePassword123!');

      expect(result.success).toBe(true);
      expect(result.user.username).toBe('test_auth_user');
      expect(result.token).toBeDefined();
    });

    test('should reject invalid password', async () => {
      await expect(authService.login('test_auth_user', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });
  });
});
```

### MQTT Integration Tests

```javascript
// src/tests/integration/mqtt/mqtt.integration.test.js
const mqtt = require('mqtt');
const { mqttService } = require('../../../services/mqttService');
const { pubsub } = require('../../../utils/pubsub');

describe('MQTT Integration', () => {
  let client;
  let receivedMessages = [];

  beforeAll(async () => {
    // Connect test MQTT client
    client = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883');
    
    await new Promise((resolve) => {
      client.on('connect', resolve);
    });

    // Subscribe to test events
    pubsub.asyncIterator(['SENSOR_DATA_UPDATED']).next().then((message) => {
      receivedMessages.push(message.value);
    });
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  describe('Sensor Data Processing', () => {
    test('should process TemHum1 data correctly', async () => {
      const testData = {
        temperatura: 25.5,
        humedad: 65.2,
        heatindex: 27.3,
        dewpoint: 18.1,
        rssi: -45,
        boot: 1,
        mem: 45000
      };

      // Publish test message
      client.publish('Invernadero/TemHum1/data', JSON.stringify(testData));

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify data was processed
      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].sensorDataUpdated.temperatura).toBe(testData.temperatura);
    });

    test('should handle invalid JSON gracefully', async () => {
      const invalidJson = '{"temperatura": 25.5, "humedad":}';

      // This should not crash the service
      client.publish('Invernadero/TemHum1/data', invalidJson);

      await new Promise(resolve => setTimeout(resolve, 500));

      // Service should still be running
      expect(mqttService.isConnected()).toBe(true);
    });
  });

  describe('Device Control', () => {
    test('should handle device control messages', async () => {
      const deviceMessage = {
        bombaSw: true
      };

      client.publish('Invernadero/Bomba/sw', JSON.stringify(deviceMessage));

      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify device state was updated
      // This would typically check database or cache
    });
  });
});
```

## End-to-End Tests

### Complete Workflow Tests

```javascript
// src/tests/e2e/workflows/sensor-to-rule-execution.e2e.test.js
const { createTestClient } = require('apollo-server-testing');
const { gql } = require('apollo-server-express');
const mqtt = require('mqtt');
const { createApolloServer } = require('../../../server');

describe('E2E: Sensor Data to Rule Execution', () => {
  let server;
  let testClient;
  let mqttClient;
  let authToken;

  beforeAll(async () => {
    server = createApolloServer();
    testClient = createTestClient(server);
    
    // Connect MQTT client
    mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL);
    await new Promise((resolve) => {
      mqttClient.on('connect', resolve);
    });

    // Login to get auth token
    const loginResult = await testClient.mutate({
      mutation: gql`
        mutation {
          login(username: "admin", password: "password") {
            token
          }
        }
      `
    });
    authToken = loginResult.data.login.token;

    // Create authenticated test client
    testClient = createTestClient(server, {
      req: { headers: { authorization: `Bearer ${authToken}` } }
    });
  });

  afterAll(async () => {
    if (mqttClient) await mqttClient.end();
    if (server) await server.stop();
  });

  test('should trigger rule when sensor threshold exceeded', async () => {
    // 1. Create a rule that triggers on high temperature
    const createRuleResult = await testClient.mutate({
      mutation: gql`
        mutation CreateRule($input: CreateRuleInput!) {
          createRule(input: $input) {
            id
            name
            enabled
          }
        }
      `,
      variables: {
        input: {
          name: 'High Temperature Test Rule',
          description: 'Test rule for E2E testing',
          enabled: true,
          priority: 'HIGH',
          conditions: [
            {
              type: 'sensor',
              sensor: 'temhum1',
              field: 'temperatura',
              operator: '>',
              value: 30
            }
          ],
          actions: [
            {
              type: 'notification',
              notification: {
                title: 'High Temperature Alert',
                message: 'Temperature exceeded 30°C: {{temperatura}}°C',
                priority: 'high',
                channels: ['webhook']
              }
            }
          ]
        }
      }
    });

    expect(createRuleResult.errors).toBeUndefined();
    const ruleId = createRuleResult.data.createRule.id;

    // 2. Publish sensor data that exceeds threshold
    const sensorData = {
      temperatura: 35.5,
      humedad: 45.2,
      heatindex: 38.1,
      dewpoint: 20.5,
      rssi: -55,
      boot: 1,
      mem: 44000
    };

    mqttClient.publish('Invernadero/TemHum1/data', JSON.stringify(sensorData));

    // 3. Wait for rule evaluation
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 4. Verify rule was triggered
    const ruleExecutions = await testClient.query({
      query: gql`
        query GetRuleExecutions($ruleId: ID!) {
          ruleExecutions(ruleId: $ruleId, limit: 1) {
            id
            success
            triggeredAt
            evaluationResult {
              conditionsMet
            }
          }
        }
      `,
      variables: { ruleId }
    });

    expect(ruleExecutions.errors).toBeUndefined();
    expect(ruleExecutions.data.ruleExecutions).toHaveLength(1);
    expect(ruleExecutions.data.ruleExecutions[0].success).toBe(true);
    expect(ruleExecutions.data.ruleExecutions[0].evaluationResult.conditionsMet).toBe(true);

    // 5. Clean up - disable rule
    await testClient.mutate({
      mutation: gql`
        mutation DisableRule($id: ID!) {
          disableRule(id: $id) {
            id
            enabled
          }
        }
      `,
      variables: { id: ruleId }
    });
  });
});
```

## Performance Tests

### Load Testing with Artillery

Create `artillery-config.yml`:

```yaml
config:
  target: 'http://localhost:4000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Load test"
    - duration: 60
      arrivalRate: 100
      name: "Stress test"
  processor: "./performance-test-processor.js"

scenarios:
  - name: "Health Check"
    weight: 10
    requests:
      - get:
          url: "/health"

  - name: "GraphQL Authentication"
    weight: 20
    requests:
      - post:
          url: "/graphql"
          json:
            query: |
              mutation {
                login(username: "{{ username }}", password: "{{ password }}") {
                  token
                  user { id username }
                }
              }
          beforeRequest: "setAuthVariables"
          capture:
            - json: "$.data.login.token"
              as: "authToken"

  - name: "GraphQL Sensor Query"
    weight: 40
    requests:
      - post:
          url: "/graphql"
          headers:
            Authorization: "Bearer {{ authToken }}"
          json:
            query: |
              query {
                latestSensorData(sensorType: TEMHUM1) {
                  timestamp
                  temperatura
                  humedad
                }
              }

  - name: "GraphQL Device Query"
    weight: 30
    requests:
      - post:
          url: "/graphql"
          headers:
            Authorization: "Bearer {{ authToken }}"
          json:
            query: |
              query {
                devices(limit: 20) {
                  id
                  name
                  status
                  type
                }
              }
```

Performance test processor (`performance-test-processor.js`):

```javascript
module.exports = {
  setAuthVariables: (requestParams, context, ee, next) => {
    context.vars.username = 'admin';
    context.vars.password = 'password';
    return next();
  }
};
```

### Memory and CPU Profiling

```javascript
// src/tests/performance/profiling.test.js
const { performance } = require('perf_hooks');
const { createTestClient } = require('apollo-server-testing');
const { gql } = require('apollo-server-express');

describe('Performance Profiling', () => {
  let testClient;

  beforeAll(async () => {
    const server = createApolloServer();
    testClient = createTestClient(server);
  });

  test('should handle concurrent sensor queries efficiently', async () => {
    const query = gql`
      query {
        latestSensorData(sensorType: TEMHUM1) {
          timestamp
          temperatura
          humedad
        }
      }
    `;

    const startTime = performance.now();
    
    // Execute 100 concurrent queries
    const promises = Array(100).fill().map(() => 
      testClient.query({ query })
    );

    const results = await Promise.all(promises);
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Assert performance requirements
    expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds
    expect(results.every(r => !r.errors)).toBe(true);
    
    console.log(`Processed 100 concurrent queries in ${totalTime}ms`);
  });

  test('should handle memory efficiently with large datasets', async () => {
    const query = gql`
      query {
        sensorHistory(sensorType: TEMHUM1, limit: 1000) {
          edges {
            node {
              timestamp
              temperatura
              humedad
            }
          }
        }
      }
    `;

    const beforeMemory = process.memoryUsage();
    
    const result = await testClient.query({ query });
    
    const afterMemory = process.memoryUsage();
    const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;

    expect(result.errors).toBeUndefined();
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Should use less than 50MB
    
    console.log(`Memory increase: ${memoryIncrease / 1024 / 1024}MB`);
  });
});
```

## Security Tests

### Authentication and Authorization Tests

```javascript
// src/tests/security/auth.security.test.js
const { createTestClient } = require('apollo-server-testing');
const { gql } = require('apollo-server-express');
const jwt = require('jsonwebtoken');

describe('Security: Authentication & Authorization', () => {
  let testClient;

  beforeAll(async () => {
    const server = createApolloServer();
    testClient = createTestClient(server);
  });

  describe('JWT Token Security', () => {
    test('should reject tampered tokens', async () => {
      const validToken = jwt.sign(
        { userId: 1, username: 'admin', role: 'admin' },
        'wrong-secret'
      );

      const { query } = createTestClient(server, {
        req: { headers: { authorization: `Bearer ${validToken}` } }
      });

      const result = await query({
        query: gql`query { me { id } }`
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].extensions.code).toBe('UNAUTHENTICATED');
    });

    test('should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        { 
          userId: 1, 
          username: 'admin', 
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
        },
        process.env.JWT_SECRET
      );

      const { query } = createTestClient(server, {
        req: { headers: { authorization: `Bearer ${expiredToken}` } }
      });

      const result = await query({
        query: gql`query { me { id } }`
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain('token expired');
    });
  });

  describe('Role-Based Access Control', () => {
    test('should prevent unauthorized user management operations', async () => {
      // Create token with viewer role
      const viewerToken = jwt.sign(
        { userId: 2, username: 'viewer', role: 'viewer' },
        process.env.JWT_SECRET
      );

      const { mutate } = createTestClient(server, {
        req: { headers: { authorization: `Bearer ${viewerToken}` } }
      });

      const result = await mutate({
        mutation: gql`
          mutation {
            updateUserRole(userId: "1", role: ADMIN) {
              id
              role
            }
          }
        `
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].extensions.code).toBe('FORBIDDEN');
    });

    test('should allow admin operations for admin users', async () => {
      const adminToken = jwt.sign(
        { userId: 1, username: 'admin', role: 'admin' },
        process.env.JWT_SECRET
      );

      const { query } = createTestClient(server, {
        req: { headers: { authorization: `Bearer ${adminToken}` } }
      });

      const result = await query({
        query: gql`
          query {
            users {
              id
              username
              role
            }
          }
        `
      });

      expect(result.errors).toBeUndefined();
      expect(result.data.users).toBeDefined();
    });
  });
});
```

### Input Validation Security Tests

```javascript
// src/tests/security/input-validation.security.test.js
const { createTestClient } = require('apollo-server-testing');
const { gql } = require('apollo-server-express');

describe('Security: Input Validation', () => {
  let testClient;
  let authToken;

  beforeAll(async () => {
    const server = createApolloServer();
    testClient = createTestClient(server);

    // Get auth token
    const loginResult = await testClient.mutate({
      mutation: gql`
        mutation {
          login(username: "admin", password: "password") {
            token
          }
        }
      `
    });
    authToken = loginResult.data.login.token;

    testClient = createTestClient(server, {
      req: { headers: { authorization: `Bearer ${authToken}` } }
    });
  });

  describe('XSS Prevention', () => {
    test('should sanitize malicious script inputs', async () => {
      const maliciousInput = '<script>alert("xss")</script>';
      
      const result = await testClient.mutate({
        mutation: gql`
          mutation CreateDevice($input: CreateDeviceInput!) {
            createDevice(input: $input) {
              id
              name
              description
            }
          }
        `,
        variables: {
          input: {
            name: maliciousInput,
            type: 'LIGHTS',
            description: maliciousInput
          }
        }
      });

      expect(result.errors).toBeUndefined();
      expect(result.data.createDevice.name).not.toContain('<script>');
      expect(result.data.createDevice.description).not.toContain('<script>');
    });
  });

  describe('SQL Injection Prevention', () => {
    test('should prevent SQL injection in search queries', async () => {
      const sqlInjection = "'; DROP TABLE users; --";
      
      const result = await testClient.query({
        query: gql`
          query SearchDevices($name: String!) {
            devices(name: $name) {
              id
              name
            }
          }
        `,
        variables: {
          name: sqlInjection
        }
      });

      // Should not crash and should return safe results
      expect(result.errors).toBeUndefined();
      expect(result.data.devices).toBeDefined();
    });
  });

  describe('Password Security', () => {
    test('should enforce strong password requirements', async () => {
      const weakPassword = '123';
      
      const result = await testClient.mutate({
        mutation: gql`
          mutation Register($input: RegisterInput!) {
            register(input: $input) {
              success
              message
            }
          }
        `,
        variables: {
          input: {
            username: 'testuser',
            email: 'test@example.com',
            password: weakPassword
          }
        }
      });

      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain('Password must be at least 12 characters');
    });
  });
});
```

## Test Data Management

### Test Fixtures

```javascript
// test-data/fixtures/users.js
module.exports = {
  admin: {
    username: 'admin',
    email: 'admin@example.com',
    password: 'AdminPassword123!',
    role: 'admin'
  },
  editor: {
    username: 'editor',
    email: 'editor@example.com',
    password: 'EditorPassword123!',
    role: 'editor'
  },
  viewer: {
    username: 'viewer',
    email: 'viewer@example.com',
    password: 'ViewerPassword123!',
    role: 'viewer'
  }
};
```

```javascript
// test-data/fixtures/devices.js
module.exports = {
  waterPump: {
    name: 'Water Pump 1',
    type: 'WATER_PUMP',
    description: 'Main irrigation pump',
    location: 'Section A',
    configuration: {
      maxFlowRate: 100,
      autoShutoff: true
    }
  },
  lights: {
    name: 'LED Lights 1',
    type: 'LIGHTS',
    description: 'Main grow lights',
    location: 'Section B',
    configuration: {
      maxBrightness: 100,
      colorSpectrum: 'full'
    }
  }
};
```

### Mock Data Generation

```javascript
// test-data/generators/sensorData.js
const { faker } = require('@faker-js/faker');

function generateTemHumData(count = 100) {
  return Array(count).fill().map(() => ({
    timestamp: faker.date.recent(),
    temperatura: faker.datatype.float({ min: 15, max: 35, precision: 0.1 }),
    humedad: faker.datatype.float({ min: 30, max: 90, precision: 0.1 }),
    heatindex: faker.datatype.float({ min: 15, max: 40, precision: 0.1 }),
    dewpoint: faker.datatype.float({ min: 5, max: 25, precision: 0.1 }),
    rssi: faker.datatype.number({ min: -90, max: -30 }),
    boot: faker.datatype.number({ min: 1, max: 100 }),
    mem: faker.datatype.number({ min: 20000, max: 50000 })
  }));
}

function generateWaterQualityData(count = 50) {
  return Array(count).fill().map(() => ({
    timestamp: faker.date.recent(),
    ph: faker.datatype.float({ min: 5.5, max: 8.5, precision: 0.1 }),
    ec: faker.datatype.number({ min: 800, max: 1500 }),
    ppm: faker.datatype.number({ min: 400, max: 1000 }),
    temperature: faker.datatype.float({ min: 18, max: 28, precision: 0.1 })
  }));
}

module.exports = {
  generateTemHumData,
  generateWaterQualityData
};
```

## Test Configuration

### Setup and Teardown

```javascript
// test-config/setup.js
const { query } = require('../src/config/database');

module.exports = async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  
  // Create test database tables if they don't exist
  try {
    await query('SELECT 1 FROM users LIMIT 1');
  } catch (error) {
    console.log('Setting up test database...');
    // Run database setup scripts
    // This would typically run your SQL migration files
  }

  // Insert test users
  const testUsers = require('../test-data/fixtures/users');
  for (const user of Object.values(testUsers)) {
    try {
      await query(
        'INSERT INTO users (username, email, password, role, is_active) VALUES ($1, $2, $3, $4, $5)',
        [user.username, user.email, user.password, user.role, true]
      );
    } catch (error) {
      // User might already exist
    }
  }
};
```

```javascript
// test-config/teardown.js
const { query } = require('../src/config/database');

module.exports = async () => {
  // Clean up test data
  await query('DELETE FROM users WHERE username LIKE $1', ['test_%']);
  await query('DELETE FROM devices WHERE name LIKE $1', ['test_%']);
  await query('DELETE FROM rules WHERE name LIKE $1', ['test_%']);
  
  console.log('Test cleanup completed');
};
```

## Running Tests

### NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest src/tests/unit",
    "test:integration": "jest src/tests/integration",
    "test:e2e": "jest src/tests/e2e",
    "test:security": "jest src/tests/security",
    "test:performance": "artillery run artillery-config.yml",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "test:ci": "jest --ci --coverage --watchAll=false"
  }
}
```

### Test Execution Commands

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:security

# Run tests with coverage
npm run test:coverage

# Run performance tests
npm run test:performance

# Run tests in watch mode
npm run test:watch

# Run tests for CI
npm run test:ci
```

### Continuous Integration

Example GitHub Actions workflow (`.github/workflows/test.yml`):

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: invernadero_iot_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '16'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run unit tests
      run: npm run test:unit
      env:
        PG_URI: postgresql://postgres:postgres@localhost:5432/invernadero_iot_test
        REDIS_URL: redis://localhost:6379
        JWT_SECRET: test-jwt-secret-for-ci
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        PG_URI: postgresql://postgres:postgres@localhost:5432/invernadero_iot_test
        REDIS_URL: redis://localhost:6379
        JWT_SECRET: test-jwt-secret-for-ci
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
```

This comprehensive testing guide covers all aspects of testing the GraphQL IoT Backend, from unit tests to end-to-end workflows, performance testing, and security validation. The testing strategy ensures code quality, reliability, and security of the IoT system.