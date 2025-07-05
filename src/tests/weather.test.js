const weatherService = require('../services/weatherService');
const { ApolloServer } = require('apollo-server-express');
const typeDefs = require('../schema/typeDefs');
const resolvers = require('../schema/resolvers');

// Mock external dependencies
jest.mock('axios');
jest.mock('../config/database');
jest.mock('../config/redis');

describe('Weather API', () => {
  let server;

  beforeAll(async () => {
    server = new ApolloServer({
      typeDefs,
      resolvers,
      context: ({ req }) => ({
        user: { id: 1, username: 'testuser', role: 'admin' }
      })
    });
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe('Weather Service', () => {
    test('should create weather service instance', () => {
      expect(weatherService).toBeDefined();
      expect(typeof weatherService.getCurrentWeather).toBe('function');
      expect(typeof weatherService.collectWeatherData).toBe('function');
      expect(typeof weatherService.getLatestWeather).toBe('function');
    });

    test('should check if service is configured', () => {
      const isConfigured = weatherService.isConfigured();
      expect(typeof isConfigured).toBe('boolean');
    });

    test('should get weather configuration', () => {
      const config = weatherService.getWeatherConfig();
      expect(config).toHaveProperty('isConfigured');
      expect(config).toHaveProperty('hasApiKey');
      expect(config).toHaveProperty('currentLocation');
      expect(config).toHaveProperty('defaultLocation');
      expect(config).toHaveProperty('apiProvider');
      expect(config).toHaveProperty('status');
    });

    test('should calculate dew point correctly', () => {
      const dewPoint = weatherService.calculateDewPoint(25, 60);
      expect(typeof dewPoint).toBe('number');
      expect(dewPoint).toBeCloseTo(16.7, 1);
    });

    test('should format database record correctly', () => {
      const mockRecord = {
        id: 1,
        temperatura: 25.5,
        humedad: 65,
        sensacion_termica: 27.2,
        punto_rocio: 18.5,
        presion: 1013.2,
        velocidad_viento: 5.5,
        direccion_viento: 'NE',
        visibilidad: 10,
        uv_index: 7,
        condicion: 'Partially cloudy',
        icono: '//cdn.weatherapi.com/weather/64x64/day/116.png',
        calidad_aire_pm2_5: 15,
        calidad_aire_pm10: 25,
        location_name: 'Test City',
        location_lat: -39.2794,
        location_lon: -72.2109,
        received_at: new Date('2024-01-01T12:00:00Z')
      };

      const formatted = weatherService.formatDatabaseRecord(mockRecord);
      
      expect(formatted).toHaveProperty('id', '1');
      expect(formatted).toHaveProperty('temperatura', 25.5);
      expect(formatted).toHaveProperty('humedad', 65);
      expect(formatted.location).toHaveProperty('name', 'Test City');
      expect(formatted.location).toHaveProperty('latitude', -39.2794);
      expect(formatted.location).toHaveProperty('longitude', -72.2109);
      expect(formatted).toHaveProperty('source', 'Database');
    });
  });

  describe('GraphQL Schema', () => {
    test('should have weather type definitions', () => {
      expect(typeDefs).toBeDefined();
      expect(Array.isArray(typeDefs)).toBe(true);
    });

    test('should have weather resolvers', () => {
      expect(resolvers).toBeDefined();
      expect(resolvers.Query).toHaveProperty('getCurrentWeather');
      expect(resolvers.Query).toHaveProperty('getLatestWeather');
      expect(resolvers.Query).toHaveProperty('getWeatherHistory');
      expect(resolvers.Query).toHaveProperty('getWeatherChartData');
      expect(resolvers.Query).toHaveProperty('getWeatherStats');
      expect(resolvers.Query).toHaveProperty('getWeatherConfig');
      
      expect(resolvers.Mutation).toHaveProperty('collectWeatherData');
      expect(resolvers.Mutation).toHaveProperty('updateWeatherConfig');
      expect(resolvers.Mutation).toHaveProperty('testWeatherLocation');
      
      expect(resolvers.Subscription).toHaveProperty('weatherDataUpdated');
      expect(resolvers.Subscription).toHaveProperty('weatherConfigChanged');
    });
  });

  describe('Weather Resolvers', () => {
    const mockContext = {
      user: { id: 1, username: 'admin', role: 'admin' }
    };

    test('getCurrentWeather resolver should be callable', () => {
      const resolver = resolvers.Query.getCurrentWeather;
      expect(typeof resolver).toBe('function');
    });

    test('getWeatherConfig resolver should require admin role', () => {
      const resolver = resolvers.Query.getWeatherConfig;
      const nonAdminContext = {
        user: { id: 2, username: 'user', role: 'viewer' }
      };

      expect(async () => {
        await resolver(null, {}, nonAdminContext);
      }).rejects.toThrow();
    });

    test('collectWeatherData mutation should require editor or admin role', () => {
      const resolver = resolvers.Mutation.collectWeatherData;
      const viewerContext = {
        user: { id: 2, username: 'user', role: 'viewer' }
      };

      expect(async () => {
        await resolver(null, { location: 'test' }, viewerContext);
      }).rejects.toThrow();
    });
  });

  describe('PubSub Integration', () => {
    test('should have PubSub instance', () => {
      const pubsub = weatherService.getPubSub();
      expect(pubsub).toBeDefined();
      expect(typeof pubsub.publish).toBe('function');
      expect(typeof pubsub.asyncIterator).toBe('function');
    });
  });
});

describe('Weather GraphQL Queries', () => {
  // These tests would require a running server with database
  // For now, we'll just test the resolver functions exist

  test('Weather queries should be defined', () => {
    const weatherQueries = [
      'getCurrentWeather',
      'getLatestWeather', 
      'getWeatherHistory',
      'getWeatherChartData',
      'getWeatherStats',
      'getWeatherConfig'
    ];

    weatherQueries.forEach(query => {
      expect(resolvers.Query[query]).toBeDefined();
      expect(typeof resolvers.Query[query]).toBe('function');
    });
  });

  test('Weather mutations should be defined', () => {
    const weatherMutations = [
      'collectWeatherData',
      'updateWeatherConfig',
      'testWeatherLocation'
    ];

    weatherMutations.forEach(mutation => {
      expect(resolvers.Mutation[mutation]).toBeDefined();
      expect(typeof resolvers.Mutation[mutation]).toBe('function');
    });
  });

  test('Weather subscriptions should be defined', () => {
    const weatherSubscriptions = [
      'weatherDataUpdated',
      'weatherConfigChanged'
    ];

    weatherSubscriptions.forEach(subscription => {
      expect(resolvers.Subscription[subscription]).toBeDefined();
      expect(typeof resolvers.Subscription[subscription].subscribe).toBe('function');
    });
  });
});

// Integration test examples (commented out as they require real API keys and database)
/*
describe('Weather API Integration Tests', () => {
  test('should fetch current weather from API', async () => {
    if (!process.env.WEATHER_API_KEY) {
      console.log('Skipping API test - no API key provided');
      return;
    }

    const weatherData = await weatherService.getCurrentWeather('London');
    expect(weatherData).toHaveProperty('temperatura');
    expect(weatherData).toHaveProperty('humedad');
    expect(weatherData).toHaveProperty('location');
    expect(weatherData.location).toHaveProperty('name');
  });

  test('should collect and save weather data', async () => {
    if (!process.env.WEATHER_API_KEY) {
      console.log('Skipping database test - no API key provided');
      return;
    }

    const result = await weatherService.collectWeatherData('London');
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('data');
    expect(result.data).toHaveProperty('temperatura');
  });
});
*/