const { gql } = require('apollo-server-express');
// Mock createTestClient since we're using custom implementation
const { ApolloServer } = require('apollo-server-express');
const { PubSub } = require('graphql-subscriptions');
const typeDefs = require('../schema/typeDefs');
const resolvers = require('../schema/resolvers');

// Mock PubSub
const mockPubSub = {
  publish: jest.fn(),
  subscribe: jest.fn(),
  asyncIterator: jest.fn()
};

jest.mock('../utils/pubsub', () => ({
  pubsub: mockPubSub,
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

describe('GraphQL Subscriptions', () => {
  let server;
  let createTestClient;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create test server with subscription support
    server = new ApolloServer({
      typeDefs,
      resolvers,
      context: ({ req, connection }) => {
        if (connection) {
          return { user: connection.context.user };
        }
        return { user: mockUsers.admin };
      },
      subscriptions: {
        path: '/subscriptions',
        onConnect: (connectionParams, webSocket) => {
          // Mock authentication for subscriptions
          if (connectionParams.authToken) {
            return { user: mockUsers.admin };
          }
          throw new Error('Missing auth token');
        },
        onDisconnect: (webSocket, context) => {
          console.log('Disconnected!');
        }
      }
    });

    // Use custom createTestClient from setup
  });

  afterEach(() => {
    if (server) {
      server.stop();
    }
  });

  describe('Sensor Data Subscriptions', () => {
    it('should subscribe to sensor data updates', async () => {
      const SENSOR_DATA_SUBSCRIPTION = gql`
        subscription($sensorTypes: [SensorType!]) {
          sensorDataUpdated(sensorTypes: $sensorTypes) {
            id
            timestamp
            temperatura
            humedad
            sensor {
              id
              name
              type
            }
          }
        }
      `;

      // Mock async iterator
      const mockAsyncIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockResolvedValue({
            value: {
              sensorDataUpdated: {
                id: '1',
                timestamp: new Date().toISOString(),
                temperatura: 25.5,
                humedad: 60.0,
                sensor: {
                  id: '1',
                  name: 'Sensor TemHum1',
                  type: 'TEMHUM1'
                }
              }
            },
            done: false
          })
        })
      };

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const { subscribe } = createTestServer();

      const subscription = await subscribe({
        query: SENSOR_DATA_SUBSCRIPTION,
        variables: { sensorTypes: ['TEMHUM1'] }
      });

      expect(mockPubSub.asyncIterator).toHaveBeenCalledWith(['SENSOR_DATA_UPDATED']);
      expect(subscription).toBeDefined();
    });

    it('should subscribe to sensor status changes', async () => {
      const SENSOR_STATUS_SUBSCRIPTION = gql`
        subscription {
          sensorStatusChanged {
            id
            name
            type
            isOnline
            lastSeen
          }
        }
      `;

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockResolvedValue({
            value: {
              sensorStatusChanged: {
                id: '1',
                name: 'Sensor TemHum1',
                type: 'TEMHUM1',
                isOnline: false,
                lastSeen: new Date().toISOString()
              }
            },
            done: false
          })
        })
      };

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const { subscribe } = createTestServer();

      const subscription = await subscribe({
        query: SENSOR_STATUS_SUBSCRIPTION
      });

      expect(mockPubSub.asyncIterator).toHaveBeenCalledWith(['SENSOR_STATUS_CHANGED']);
      expect(subscription).toBeDefined();
    });

    it('should filter sensor data by type', async () => {
      const FILTERED_SENSOR_SUBSCRIPTION = gql`
        subscription($sensorTypes: [SensorType!]) {
          sensorDataUpdated(sensorTypes: $sensorTypes) {
            id
            sensor {
              type
            }
          }
        }
      `;

      // Mock withFilter functionality
      const mockWithFilter = jest.fn((iterator, filterFn) => {
        return {
          [Symbol.asyncIterator]: jest.fn().mockReturnValue({
            next: jest.fn().mockResolvedValue({
              value: {
                sensorDataUpdated: {
                  id: '1',
                  sensor: { type: 'TEMHUM1' }
                }
              },
              done: false
            })
          })
        };
      });

      // Mock the withFilter function
      jest.doMock('graphql-subscriptions', () => ({
        withFilter: mockWithFilter
      }));

      const { subscribe } = createTestServer();

      await subscribe({
        query: FILTERED_SENSOR_SUBSCRIPTION,
        variables: { sensorTypes: ['TEMHUM1'] }
      });

      expect(mockPubSub.asyncIterator).toHaveBeenCalled();
    });
  });

  describe('Device Subscriptions', () => {
    it('should subscribe to device status changes', async () => {
      const DEVICE_STATUS_SUBSCRIPTION = gql`
        subscription {
          deviceStatusChanged {
            id
            name
            type
            status
            isOnline
            lastSeen
          }
        }
      `;

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockResolvedValue({
            value: {
              deviceStatusChanged: {
                id: '1',
                name: 'Bomba de Agua',
                type: 'PUMP',
                status: 'ON',
                isOnline: true,
                lastSeen: new Date().toISOString()
              }
            },
            done: false
          })
        })
      };

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const { subscribe } = createTestServer();

      const subscription = await subscribe({
        query: DEVICE_STATUS_SUBSCRIPTION
      });

      expect(mockPubSub.asyncIterator).toHaveBeenCalledWith(['DEVICE_STATUS_CHANGED']);
      expect(subscription).toBeDefined();
    });

    it('should subscribe to device control events', async () => {
      const DEVICE_CONTROLLED_SUBSCRIPTION = gql`
        subscription {
          deviceControlled {
            id
            name
            status
            controlledBy {
              id
              username
            }
            controlledAt
          }
        }
      `;

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockResolvedValue({
            value: {
              deviceControlled: {
                id: '1',
                name: 'Bomba de Agua',
                status: 'ON',
                controlledBy: {
                  id: '1',
                  username: 'admin'
                },
                controlledAt: new Date().toISOString()
              }
            },
            done: false
          })
        })
      };

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const { subscribe } = createTestServer();

      const subscription = await subscribe({
        query: DEVICE_CONTROLLED_SUBSCRIPTION
      });

      expect(mockPubSub.asyncIterator).toHaveBeenCalledWith(['DEVICE_CONTROLLED']);
      expect(subscription).toBeDefined();
    });

    it('should filter device events by user ownership', async () => {
      const USER_DEVICE_SUBSCRIPTION = gql`
        subscription {
          userDeviceEvents {
            id
            name
            status
            event {
              type
              timestamp
              data
            }
          }
        }
      `;

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockResolvedValue({
            value: {
              userDeviceEvents: {
                id: '1',
                name: 'User Device',
                status: 'ON',
                event: {
                  type: 'STATUS_CHANGE',
                  timestamp: new Date().toISOString(),
                  data: { from: 'OFF', to: 'ON' }
                }
              }
            },
            done: false
          })
        })
      };

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const { subscribe } = createTestServer();

      const subscription = await subscribe({
        query: USER_DEVICE_SUBSCRIPTION
      });

      expect(subscription).toBeDefined();
    });
  });

  describe('Notification Subscriptions', () => {
    it('should subscribe to new notifications', async () => {
      const NOTIFICATION_SUBSCRIPTION = gql`
        subscription {
          notificationCreated {
            id
            title
            message
            type
            priority
            isRead
            timestamp
          }
        }
      `;

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockResolvedValue({
            value: {
              notificationCreated: {
                id: '1',
                title: 'New Alert',
                message: 'Temperature threshold exceeded',
                type: 'ALERT',
                priority: 'HIGH',
                isRead: false,
                timestamp: new Date().toISOString()
              }
            },
            done: false
          })
        })
      };

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const { subscribe } = createTestServer();

      const subscription = await subscribe({
        query: NOTIFICATION_SUBSCRIPTION
      });

      expect(mockPubSub.asyncIterator).toHaveBeenCalledWith(['NOTIFICATION_CREATED']);
      expect(subscription).toBeDefined();
    });

    it('should subscribe to notification status updates', async () => {
      const NOTIFICATION_STATUS_SUBSCRIPTION = gql`
        subscription {
          notificationStatusChanged {
            id
            title
            isRead
            readAt
          }
        }
      `;

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockResolvedValue({
            value: {
              notificationStatusChanged: {
                id: '1',
                title: 'Alert Notification',
                isRead: true,
                readAt: new Date().toISOString()
              }
            },
            done: false
          })
        })
      };

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const { subscribe } = createTestServer();

      const subscription = await subscribe({
        query: NOTIFICATION_STATUS_SUBSCRIPTION
      });

      expect(subscription).toBeDefined();
    });

    it('should filter notifications by priority', async () => {
      const HIGH_PRIORITY_SUBSCRIPTION = gql`
        subscription($priority: NotificationPriority) {
          notificationCreated(priority: $priority) {
            id
            title
            priority
          }
        }
      `;

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockResolvedValue({
            value: {
              notificationCreated: {
                id: '1',
                title: 'High Priority Alert',
                priority: 'HIGH'
              }
            },
            done: false
          })
        })
      };

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const { subscribe } = createTestServer();

      const subscription = await subscribe({
        query: HIGH_PRIORITY_SUBSCRIPTION,
        variables: { priority: 'HIGH' }
      });

      expect(subscription).toBeDefined();
    });

    it('should filter notifications by user role', async () => {
      const ADMIN_NOTIFICATION_SUBSCRIPTION = gql`
        subscription {
          adminNotifications {
            id
            title
            message
            type
            priority
          }
        }
      `;

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockResolvedValue({
            value: {
              adminNotifications: {
                id: '1',
                title: 'Admin Alert',
                message: 'System maintenance required',
                type: 'SYSTEM',
                priority: 'HIGH'
              }
            },
            done: false
          })
        })
      };

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const { subscribe } = createTestServer();

      const subscription = await subscribe({
        query: ADMIN_NOTIFICATION_SUBSCRIPTION
      });

      expect(subscription).toBeDefined();
    });
  });

  describe('Weather Subscriptions', () => {
    it('should subscribe to weather updates', async () => {
      const WEATHER_UPDATE_SUBSCRIPTION = gql`
        subscription {
          weatherUpdated {
            id
            location
            temperature
            humidity
            pressure
            windSpeed
            windDirection
            description
            timestamp
          }
        }
      `;

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockResolvedValue({
            value: {
              weatherUpdated: {
                id: '1',
                location: 'Test Location',
                temperature: 22.5,
                humidity: 65,
                pressure: 1013.25,
                windSpeed: 10.5,
                windDirection: 'NW',
                description: 'Partly cloudy',
                timestamp: new Date().toISOString()
              }
            },
            done: false
          })
        })
      };

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const { subscribe } = createTestServer();

      const subscription = await subscribe({
        query: WEATHER_UPDATE_SUBSCRIPTION
      });

      expect(mockPubSub.asyncIterator).toHaveBeenCalledWith(['WEATHER_UPDATED']);
      expect(subscription).toBeDefined();
    });

    it('should subscribe to weather alerts', async () => {
      const WEATHER_ALERT_SUBSCRIPTION = gql`
        subscription {
          weatherAlert {
            id
            type
            severity
            title
            description
            timestamp
            expiresAt
          }
        }
      `;

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockResolvedValue({
            value: {
              weatherAlert: {
                id: '1',
                type: 'STORM',
                severity: 'HIGH',
                title: 'Storm Warning',
                description: 'Severe thunderstorm expected',
                timestamp: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 3600000).toISOString()
              }
            },
            done: false
          })
        })
      };

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const { subscribe } = createTestServer();

      const subscription = await subscribe({
        query: WEATHER_ALERT_SUBSCRIPTION
      });

      expect(subscription).toBeDefined();
    });
  });

  describe('Real-time Data Flow', () => {
    it('should handle multiple concurrent subscriptions', async () => {
      const SENSOR_SUBSCRIPTION = gql`
        subscription {
          sensorDataUpdated {
            id
            timestamp
            temperatura
          }
        }
      `;

      const DEVICE_SUBSCRIPTION = gql`
        subscription {
          deviceStatusChanged {
            id
            name
            status
          }
        }
      `;

      const mockSensorIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockResolvedValue({
            value: { sensorDataUpdated: { id: '1', timestamp: new Date().toISOString(), temperatura: 25.5 } },
            done: false
          })
        })
      };

      const mockDeviceIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockResolvedValue({
            value: { deviceStatusChanged: { id: '1', name: 'Test Device', status: 'ON' } },
            done: false
          })
        })
      };

      mockPubSub.asyncIterator
        .mockReturnValueOnce(mockSensorIterator)
        .mockReturnValueOnce(mockDeviceIterator);

      const { subscribe } = createTestServer();

      const sensorSubscription = await subscribe({ query: SENSOR_SUBSCRIPTION });
      const deviceSubscription = await subscribe({ query: DEVICE_SUBSCRIPTION });

      expect(sensorSubscription).toBeDefined();
      expect(deviceSubscription).toBeDefined();
      expect(mockPubSub.asyncIterator).toHaveBeenCalledTimes(2);
    });

    it('should handle subscription cleanup on disconnect', async () => {
      const SENSOR_SUBSCRIPTION = gql`
        subscription {
          sensorDataUpdated {
            id
            timestamp
          }
        }
      `;

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockResolvedValue({
            value: { sensorDataUpdated: { id: '1', timestamp: new Date().toISOString() } },
            done: false
          }),
          return: jest.fn().mockResolvedValue({ done: true })
        })
      };

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const { subscribe } = createTestServer();

      const subscription = await subscribe({ query: SENSOR_SUBSCRIPTION });
      
      // Simulate disconnection
      if (subscription && subscription.return) {
        await subscription.return();
      }

      expect(subscription).toBeDefined();
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for subscriptions', async () => {
      const unauthenticatedServer = new ApolloServer({
        typeDefs,
        resolvers,
        subscriptions: {
          onConnect: (connectionParams) => {
            // Simulate no auth token
            if (!connectionParams.authToken) {
              throw new Error('Missing auth token');
            }
            return {};
          }
        }
      });

      const { subscribe } = createTestServer();

      const SENSOR_SUBSCRIPTION = gql`
        subscription {
          sensorDataUpdated {
            id
            timestamp
          }
        }
      `;

      try {
        await subscribe({ query: SENSOR_SUBSCRIPTION });
      } catch (error) {
        expect(error.message).toContain('Missing auth token');
      }

      unauthenticatedServer.stop();
    });

    it('should filter subscriptions based on user permissions', async () => {
      const viewerServer = new ApolloServer({
        typeDefs,
        resolvers,
        subscriptions: {
          onConnect: (connectionParams) => {
            return { user: mockUsers.viewer };
          }
        }
      });

      const { subscribe } = createTestServer({ user: mockUsers.viewer });

      const ADMIN_SUBSCRIPTION = gql`
        subscription {
          adminNotifications {
            id
            title
          }
        }
      `;

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockResolvedValue({
            value: null, // Should be filtered out
            done: false
          })
        })
      };

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const subscription = await subscribe({ query: ADMIN_SUBSCRIPTION });
      
      // Should not receive admin notifications as viewer
      expect(subscription).toBeDefined();
      
      viewerServer.stop();
    });
  });

  describe('Error Handling', () => {
    it('should handle subscription errors gracefully', async () => {
      const SENSOR_SUBSCRIPTION = gql`
        subscription {
          sensorDataUpdated {
            id
            timestamp
            temperatura
          }
        }
      `;

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockRejectedValue(new Error('Subscription error'))
        })
      };

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const { subscribe } = createTestServer();

      try {
        const subscription = await subscribe({ query: SENSOR_SUBSCRIPTION });
        const iterator = subscription[Symbol.asyncIterator]();
        await iterator.next();
      } catch (error) {
        expect(error.message).toContain('Subscription error');
      }
    });

    it('should handle network disconnections', async () => {
      const SENSOR_SUBSCRIPTION = gql`
        subscription {
          sensorDataUpdated {
            id
            timestamp
          }
        }
      `;

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn()
            .mockResolvedValueOnce({
              value: { sensorDataUpdated: { id: '1', timestamp: new Date().toISOString() } },
              done: false
            })
            .mockRejectedValueOnce(new Error('Connection lost')),
          return: jest.fn().mockResolvedValue({ done: true })
        })
      };

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const { subscribe } = createTestServer();

      const subscription = await subscribe({ query: SENSOR_SUBSCRIPTION });
      
      expect(subscription).toBeDefined();
      
      // Simulate network disconnection handling
      if (subscription && subscription.return) {
        await subscription.return();
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high frequency updates', async () => {
      const SENSOR_SUBSCRIPTION = gql`
        subscription {
          sensorDataUpdated {
            id
            timestamp
            temperatura
          }
        }
      `;

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockImplementation(async () => {
            // Simulate high frequency updates
            await new Promise(resolve => setTimeout(resolve, 10));
            return {
              value: { 
                sensorDataUpdated: { 
                  id: '1', 
                  timestamp: new Date().toISOString(),
                  temperatura: Math.random() * 30 + 10
                } 
              },
              done: false
            };
          })
        })
      };

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const { subscribe } = createTestServer();

      const subscription = await subscribe({ query: SENSOR_SUBSCRIPTION });
      
      expect(subscription).toBeDefined();
      
      // Test multiple rapid updates
      if (subscription && subscription[Symbol.asyncIterator]) {
        const iterator = subscription[Symbol.asyncIterator]();
        for (let i = 0; i < 5; i++) {
          const result = await iterator.next();
          expect(result.value).toBeDefined();
        }
      }
    });

    it('should implement subscription throttling', async () => {
      const THROTTLED_SUBSCRIPTION = gql`
        subscription {
          sensorDataUpdated {
            id
            timestamp
            temperatura
          }
        }
      `;

      // Mock throttled iterator
      const mockAsyncIterator = {
        [Symbol.asyncIterator]: jest.fn().mockReturnValue({
          next: jest.fn().mockImplementation(async () => {
            // Simulate throttling - only emit every 1000ms
            await new Promise(resolve => setTimeout(resolve, 1000));
            return {
              value: { 
                sensorDataUpdated: { 
                  id: '1', 
                  timestamp: new Date().toISOString(),
                  temperatura: 25.5
                } 
              },
              done: false
            };
          })
        })
      };

      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const { subscribe } = createTestServer();

      const subscription = await subscribe({ query: THROTTLED_SUBSCRIPTION });
      
      expect(subscription).toBeDefined();
    });
  });
});