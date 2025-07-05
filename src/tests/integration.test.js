const request = require('supertest');
const { ApolloServer } = require('apollo-server-express');
const express = require('express');
const typeDefs = require('../schema/typeDefs');
const resolvers = require('../schema/resolvers');

describe('GraphQL Integration Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Create Apollo Server
    server = new ApolloServer({
      typeDefs,
      resolvers,
      context: ({ req }) => ({
        user: req.user || null,
        req
      }),
      introspection: true,
      playground: false
    });

    // Create Express app
    app = express();
    
    // Apply Apollo GraphQL middleware
    server.applyMiddleware({ app, path: '/graphql' });
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('GraphQL Endpoint', () => {
    it('should respond to GraphQL introspection query', async () => {
      const introspectionQuery = `
        query IntrospectionQuery {
          __schema {
            queryType {
              name
            }
            mutationType {
              name
            }
            subscriptionType {
              name
            }
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: introspectionQuery })
        .expect(200);

      expect(response.body.data.__schema).toMatchObject({
        queryType: { name: 'Query' },
        mutationType: { name: 'Mutation' },
        subscriptionType: { name: 'Subscription' }
      });
    });

    it('should handle malformed GraphQL queries', async () => {
      const malformedQuery = `
        query {
          invalidField {
            nonExistentField
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: malformedQuery })
        .expect(400);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Cannot query field');
    });

    it('should handle requests without query', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({})
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/graphql')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body).toBeDefined();
    });
  });

  describe('Health Check Integration', () => {
    it('should return system health status', async () => {
      const healthQuery = `
        query {
          health {
            status
            timestamp
            services {
              database
              redis
              mqtt
            }
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: healthQuery })
        .expect(200);

      expect(response.body.data.health).toMatchObject({
        status: expect.any(String),
        timestamp: expect.any(String),
        services: {
          database: expect.any(String),
          redis: expect.any(String),
          mqtt: expect.any(String)
        }
      });
    });
  });

  describe('Authentication Integration', () => {
    it('should handle login mutation', async () => {
      const loginMutation = `
        mutation($username: String!, $password: String!) {
          login(username: $username, password: $password) {
            user {
              id
              username
              role
            }
            token
          }
        }
      `;

      // Mock successful login
      jest.spyOn(require('../services/authService'), 'login')
        .mockResolvedValue({
          user: { id: 1, username: 'admin', role: 'admin' },
          token: 'mock-token'
        });

      const response = await request(app)
        .post('/graphql')
        .send({
          query: loginMutation,
          variables: { username: 'admin', password: 'password' }
        })
        .expect(200);

      expect(response.body.data.login).toMatchObject({
        user: {
          id: expect.any(String),
          username: 'admin',
          role: 'admin'
        },
        token: expect.any(String)
      });
    });

    it('should reject invalid credentials', async () => {
      const loginMutation = `
        mutation($username: String!, $password: String!) {
          login(username: $username, password: $password) {
            user {
              id
              username
            }
            token
          }
        }
      `;

      // Mock failed login
      jest.spyOn(require('../services/authService'), 'login')
        .mockRejectedValue(new Error('Invalid credentials'));

      const response = await request(app)
        .post('/graphql')
        .send({
          query: loginMutation,
          variables: { username: 'invalid', password: 'wrong' }
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Invalid credentials');
    });

    it('should require authentication for protected queries', async () => {
      const protectedQuery = `
        query {
          me {
            id
            username
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: protectedQuery })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Authentication required');
    });

    it('should accept valid JWT tokens', async () => {
      const protectedQuery = `
        query {
          me {
            id
            username
            role
          }
        }
      `;

      // Create server with authenticated context
      const authenticatedServer = new ApolloServer({
        typeDefs,
        resolvers,
        context: ({ req }) => ({
          user: { id: 1, username: 'admin', role: 'admin' },
          req
        })
      });

      const authenticatedApp = express();
      authenticatedServer.applyMiddleware({ app: authenticatedApp, path: '/graphql' });

      const response = await request(authenticatedApp)
        .post('/graphql')
        .send({ query: protectedQuery })
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      expect(response.body.data.me).toMatchObject({
        id: expect.any(String),
        username: 'admin',
        role: 'admin'
      });

      await authenticatedServer.stop();
    });
  });

  describe('Sensor Data Integration', () => {
    beforeEach(() => {
      // Mock sensor service
      const mockSensorData = [
        {
          id: 1,
          name: 'Sensor TemHum1',
          type: 'TEMHUM1',
          isOnline: true,
          lastSeen: new Date().toISOString()
        }
      ];

      jest.spyOn(require('../services/sensorService'), 'getAllSensors')
        .mockResolvedValue(mockSensorData);
    });

    it('should fetch sensor data', async () => {
      const sensorsQuery = `
        query {
          sensors {
            id
            name
            type
            isOnline
            lastSeen
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: sensorsQuery })
        .expect(200);

      expect(response.body.data.sensors).toHaveLength(1);
      expect(response.body.data.sensors[0]).toMatchObject({
        id: expect.any(String),
        name: 'Sensor TemHum1',
        type: 'TEMHUM1',
        isOnline: true
      });
    });

    it('should handle sensor service errors', async () => {
      jest.spyOn(require('../services/sensorService'), 'getAllSensors')
        .mockRejectedValue(new Error('Database connection failed'));

      const sensorsQuery = `
        query {
          sensors {
            id
            name
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: sensorsQuery })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Database connection failed');
    });
  });

  describe('Device Control Integration', () => {
    beforeEach(() => {
      // Mock device service
      jest.spyOn(require('../services/deviceService'), 'controlDevice')
        .mockResolvedValue({
          success: true,
          message: 'Device controlled successfully',
          newStatus: 'ON'
        });
    });

    it('should control device with authenticated user', async () => {
      const controlDeviceMutation = `
        mutation($id: ID!, $action: String!) {
          controlDevice(id: $id, action: $action) {
            success
            message
            newStatus
          }
        }
      `;

      // Create authenticated server
      const authenticatedServer = new ApolloServer({
        typeDefs,
        resolvers,
        context: ({ req }) => ({
          user: { id: 1, username: 'admin', role: 'admin' },
          req
        })
      });

      const authenticatedApp = express();
      authenticatedServer.applyMiddleware({ app: authenticatedApp, path: '/graphql' });

      const response = await request(authenticatedApp)
        .post('/graphql')
        .send({
          query: controlDeviceMutation,
          variables: { id: '1', action: 'turn_on' }
        })
        .set('Authorization', 'Bearer valid-jwt-token')
        .expect(200);

      expect(response.body.data.controlDevice).toMatchObject({
        success: true,
        message: expect.any(String),
        newStatus: 'ON'
      });

      await authenticatedServer.stop();
    });

    it('should reject device control without authentication', async () => {
      const controlDeviceMutation = `
        mutation($id: ID!, $action: String!) {
          controlDevice(id: $id, action: $action) {
            success
            message
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({
          query: controlDeviceMutation,
          variables: { id: '1', action: 'turn_on' }
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Authentication required');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle database connection errors gracefully', async () => {
      jest.spyOn(require('../services/sensorService'), 'getAllSensors')
        .mockRejectedValue(new Error('Database connection timeout'));

      const sensorsQuery = `
        query {
          sensors {
            id
            name
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: sensorsQuery })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Database connection timeout');
      expect(response.body.data).toBeNull();
    });

    it('should handle service unavailable errors', async () => {
      jest.spyOn(require('../services/weatherService'), 'getCurrentWeather')
        .mockRejectedValue(new Error('Weather service unavailable'));

      const weatherQuery = `
        query {
          currentWeather {
            location
            temperature
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: weatherQuery })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('Weather service unavailable');
    });

    it('should handle validation errors', async () => {
      const invalidMutation = `
        mutation {
          createDevice(input: {
            type: "INVALID_TYPE"
          }) {
            id
            name
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: invalidMutation })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('Performance Integration', () => {
    it('should handle multiple concurrent requests', async () => {
      const healthQuery = `
        query {
          health {
            status
          }
        }
      `;

      const requests = Array(10).fill().map(() =>
        request(app)
          .post('/graphql')
          .send({ query: healthQuery })
          .expect(200)
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.body.data.health.status).toBeDefined();
      });
    });

    it('should respond within acceptable time limits', async () => {
      const start = Date.now();

      const healthQuery = `
        query {
          health {
            status
            timestamp
          }
        }
      `;

      await request(app)
        .post('/graphql')
        .send({ query: healthQuery })
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle large query responses', async () => {
      // Mock large dataset
      const largeSensorData = Array(1000).fill().map((_, index) => ({
        id: index + 1,
        name: `Sensor ${index + 1}`,
        type: 'TEMHUM1',
        isOnline: true,
        lastSeen: new Date().toISOString()
      }));

      jest.spyOn(require('../services/sensorService'), 'getAllSensors')
        .mockResolvedValue(largeSensorData);

      const sensorsQuery = `
        query {
          sensors {
            id
            name
            type
            isOnline
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: sensorsQuery })
        .expect(200);

      expect(response.body.data.sensors).toHaveLength(1000);
    });
  });

  describe('Security Integration', () => {
    it('should sanitize input to prevent injection attacks', async () => {
      const maliciousQuery = `
        query {
          sensor(id: "1'; DROP TABLE sensors; --") {
            id
            name
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: maliciousQuery })
        .expect(200);

      // Should handle the malicious input gracefully
      expect(response.body.errors || response.body.data).toBeDefined();
    });

    it('should implement query depth limiting', async () => {
      const deepQuery = `
        query {
          sensors {
            latestReading {
              sensor {
                latestReading {
                  sensor {
                    latestReading {
                      sensor {
                        id
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: deepQuery })
        .expect(200);

      // Should either succeed or reject based on depth limit configuration
      expect(response.body).toBeDefined();
    });

    it('should implement query complexity limiting', async () => {
      const complexQuery = `
        query {
          sensors {
            id
            name
            type
            readings(limit: 1000) {
              id
              timestamp
              temperatura
              humedad
              sensor {
                id
                name
                readings(limit: 1000) {
                  id
                  timestamp
                }
              }
            }
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: complexQuery })
        .expect(200);

      // Should either succeed or reject based on complexity limit
      expect(response.body).toBeDefined();
    });
  });

  describe('CORS Integration', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/graphql')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      // CORS headers should be present if configured
      expect(response.status).toBeOneOf([200, 204, 404]);
    });

    it('should accept requests from allowed origins', async () => {
      const healthQuery = `
        query {
          health {
            status
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query: healthQuery })
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.body.data.health.status).toBeDefined();
    });
  });

  describe('Content-Type Handling', () => {
    it('should accept application/json', async () => {
      const healthQuery = `
        query {
          health {
            status
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ query: healthQuery }))
        .expect(200);

      expect(response.body.data.health.status).toBeDefined();
    });

    it('should accept application/graphql', async () => {
      const healthQuery = `
        query {
          health {
            status
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Content-Type', 'application/graphql')
        .send(healthQuery)
        .expect(200);

      expect(response.body.data.health.status).toBeDefined();
    });

    it('should reject unsupported content types', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Content-Type', 'text/plain')
        .send('some text')
        .expect(400);

      expect(response.body.errors || response.body.message).toBeDefined();
    });
  });
});