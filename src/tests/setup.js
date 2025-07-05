const { ApolloServer } = require('apollo-server-express');
const { GraphQLRequest } = require('graphql-request');
const typeDefs = require('../schema/typeDefs');
// Use mock resolvers for testing
const resolvers = require('./__mocks__/resolvers');

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret';

// Mock services
jest.mock('../services/sensorService');
jest.mock('../services/deviceService');
jest.mock('../services/authService');
jest.mock('../services/notificationService');
jest.mock('../services/weatherService');
jest.mock('../services/rulesEngineService');
// Skip userService and cacheService mocks since they don't exist yet

// Mock database and Redis
jest.mock('../config/database');
jest.mock('../config/redis', () => ({
  redis: {
    duplicate: jest.fn(() => ({
      on: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      quit: jest.fn()
    })),
    on: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    quit: jest.fn()
  }
}));

// Mock PubSub
jest.mock('../utils/pubsub', () => ({
  pubsub: {
    publish: jest.fn(),
    subscribe: jest.fn(),
    asyncIterator: jest.fn()
  },
  SENSOR_EVENTS: {
    DATA_UPDATED: 'SENSOR_DATA_UPDATED',
    STATUS_CHANGED: 'SENSOR_STATUS_CHANGED'
  },
  DEVICE_EVENTS: {
    STATUS_CHANGED: 'DEVICE_STATUS_CHANGED',
    CONTROLLED: 'DEVICE_CONTROLLED'
  },
  NOTIFICATION_EVENTS: {
    CREATED: 'NOTIFICATION_CREATED',
    SENT: 'NOTIFICATION_SENT'
  },
  WEATHER_EVENTS: {
    UPDATED: 'WEATHER_UPDATED'
  }
}));

// Create test server
const createTestServer = (context = {}) => {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => ({
      ...context,
      req,
      user: context.user || null
    }),
    introspection: true,
    playground: false
  });

  // Mock createTestClient functionality
  return {
    query: async ({ query, variables = {} }) => {
      try {
        const result = await server.executeOperation({
          query: query.loc ? query.loc.source.body : query,
          variables
        });
        return result;
      } catch (error) {
        return { errors: [error] };
      }
    },
    mutate: async ({ mutation, variables = {} }) => {
      try {
        const result = await server.executeOperation({
          query: mutation.loc ? mutation.loc.source.body : mutation,
          variables
        });
        return result;
      } catch (error) {
        return { errors: [error] };
      }
    },
    subscribe: async ({ query, variables = {} }) => {
      // Mock subscription - return async iterator
      return {
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.resolve({ done: true, value: null })
        })
      };
    }
  };
};

// Mock user contexts
const mockUsers = {
  admin: {
    id: 1,
    username: 'admin',
    email: 'admin@test.com',
    role: 'admin',
    isActive: true
  },
  editor: {
    id: 2,
    username: 'editor',
    email: 'editor@test.com',
    role: 'editor',
    isActive: true
  },
  viewer: {
    id: 3,
    username: 'viewer',
    email: 'viewer@test.com',
    role: 'viewer',
    isActive: true
  },
  operator: {
    id: 4,
    username: 'operator',
    email: 'operator@test.com',
    role: 'operator',
    isActive: true
  }
};

// Mock data
const mockSensorData = {
  temhum1: {
    id: 1,
    name: 'Sensor TemHum1',
    type: 'TEMHUM1',
    isOnline: true,
    lastSeen: new Date(),
    readings: [
      {
        id: 1,
        timestamp: new Date(),
        temperatura: 25.5,
        humedad: 60.0,
        heatIndex: 26.8,
        dewPoint: 17.2,
        rssi: -45
      }
    ]
  },
  temhum2: {
    id: 2,
    name: 'Sensor TemHum2',
    type: 'TEMHUM2',
    isOnline: true,
    lastSeen: new Date(),
    readings: [
      {
        id: 2,
        timestamp: new Date(),
        temperatura: 24.8,
        humedad: 65.0,
        heatIndex: 26.2,
        dewPoint: 18.1,
        rssi: -42
      }
    ]
  },
  calidadAgua: {
    id: 3,
    name: 'Sensor Calidad Agua',
    type: 'CALIDAD_AGUA',
    isOnline: true,
    lastSeen: new Date(),
    readings: [
      {
        id: 3,
        timestamp: new Date(),
        ph: 7.2,
        ec: 1.8,
        ppm: 1200,
        temperaturaAgua: 22.5
      }
    ]
  }
};

const mockDeviceData = {
  bomba: {
    id: 1,
    name: 'Bomba de Agua',
    type: 'PUMP',
    status: 'ONLINE',
    isOnline: true,
    lastSeen: new Date(),
    configuration: {
      minOnTime: 30,
      maxOnTime: 300,
      cooldownTime: 60
    }
  },
  calefactor: {
    id: 2,
    name: 'Calefactor',
    type: 'HEATER',
    status: 'ONLINE',
    isOnline: true,
    lastSeen: new Date(),
    configuration: {
      targetTemp: 25.0,
      maxTemp: 35.0,
      hysteresis: 2.0
    }
  }
};

const mockRuleData = {
  temperatureRule: {
    id: 1,
    name: 'Control de Temperatura',
    description: 'Activar calefactor cuando temperatura baja',
    isActive: true,
    conditions: {
      sensor: 'temhum1',
      field: 'temperatura',
      operator: 'lt',
      value: 20.0
    },
    actions: [
      {
        type: 'device_control',
        deviceId: 2,
        action: 'turn_on'
      }
    ]
  }
};

global.createTestServer = createTestServer;
global.mockUsers = mockUsers;
global.mockSensorData = mockSensorData;
global.mockDeviceData = mockDeviceData;
global.mockRuleData = mockRuleData;

// Clean up after tests
afterEach(() => {
  jest.clearAllMocks();
});