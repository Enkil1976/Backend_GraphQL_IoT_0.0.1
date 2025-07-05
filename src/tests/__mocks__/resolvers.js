// Mock resolvers for testing
const mockResolvers = {
  Query: {
    health: () => ({
      status: 'healthy',
      timestamp: new Date(),
      services: {
        database: 'connected',
        redis: 'connected',
        mqtt: 'connected'
      }
    }),
    me: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      return context.user;
    },
    sensors: () => [],
    sensor: () => null,
    devices: () => [],
    device: () => null,
    notifications: () => [],
    notification: () => null,
    rules: () => [],
    rule: () => null,
    getCurrentWeather: () => ({
      id: '1',
      location: 'Test Location',
      temperature: 22.5,
      humidity: 65,
      pressure: 1013.25,
      timestamp: new Date()
    }),
    getLatestWeather: () => [],
    getWeatherHistory: () => ({
      edges: [],
      pageInfo: { hasNextPage: false, hasPreviousPage: false },
      totalCount: 0
    }),
    getWeatherChartData: () => [],
    getWeatherStats: () => ({
      averageTemperature: 20.0,
      averageHumidity: 60.0,
      minTemperature: 15.0,
      maxTemperature: 25.0
    }),
    getWeatherConfig: () => ({
      location: 'Santiago, Chile',
      updateInterval: 1800,
      apiKey: 'test-key'
    })
  },
  Mutation: {
    login: () => {
      throw new Error('Authentication required');
    },
    register: () => {
      throw new Error('Authentication required');
    },
    refreshToken: () => {
      throw new Error('Authentication required');
    },
    createDevice: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      if (!['admin', 'editor'].includes(context.user.role)) {
        throw new Error('Insufficient permissions');
      }
      return { id: '1', ...args.input };
    },
    updateDevice: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      if (!['admin', 'editor'].includes(context.user.role)) {
        throw new Error('Insufficient permissions');
      }
      return { id: args.id, ...args.input };
    },
    deleteDevice: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      if (context.user.role !== 'admin') {
        throw new Error('Insufficient permissions');
      }
      return true;
    },
    controlDevice: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      if (context.user.role === 'viewer') {
        throw new Error('Insufficient permissions');
      }
      return { success: true, message: 'Device controlled', newStatus: 'ON' };
    },
    createRule: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      if (!['admin', 'editor'].includes(context.user.role)) {
        throw new Error('Insufficient permissions');
      }
      return { id: '1', ...args.input };
    },
    updateRule: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      if (!['admin', 'editor'].includes(context.user.role)) {
        throw new Error('Insufficient permissions');
      }
      return { id: args.id, ...args.input };
    },
    deleteRule: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      if (!['admin', 'editor'].includes(context.user.role)) {
        throw new Error('Insufficient permissions');
      }
      return true;
    },
    executeRule: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      return { success: true, result: {} };
    },
    toggleRule: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      if (!['admin', 'editor'].includes(context.user.role)) {
        throw new Error('Insufficient permissions');
      }
      return { id: args.id, isActive: true };
    },
    createNotification: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      if (context.user.role === 'viewer') {
        throw new Error('Insufficient permissions');
      }
      return { id: '1', ...args.input, isRead: false, timestamp: new Date() };
    },
    markNotificationAsRead: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      return { id: args.id, isRead: true };
    },
    deleteNotification: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      return true;
    },
    sendNotification: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      return { success: true, message: 'Notification sent' };
    },
    createNotificationTemplate: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      return { id: '1', ...args.input, createdAt: new Date() };
    },
    collectWeatherData: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      return { 
        success: true, 
        message: 'Weather data collected',
        data: {
          temperature: 22.5,
          humidity: 65,
          pressure: 1013.25
        }
      };
    },
    updateWeatherConfig: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      return { 
        success: true,
        message: 'Weather config updated',
        config: args.input
      };
    },
    updateUser: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      return { ...context.user, ...args.input };
    },
    updateUserConfiguration: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      return { userId: context.user.id, ...args.input };
    },
    changePassword: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Authentication required');
      }
      return true;
    }
  },
  Subscription: {
    sensorDataUpdated: {
      subscribe: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.resolve({ done: true, value: null })
        })
      })
    },
    sensorStatusChanged: {
      subscribe: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.resolve({ done: true, value: null })
        })
      })
    },
    deviceStatusChanged: {
      subscribe: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.resolve({ done: true, value: null })
        })
      })
    },
    deviceControlled: {
      subscribe: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.resolve({ done: true, value: null })
        })
      })
    },
    notificationCreated: {
      subscribe: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.resolve({ done: true, value: null })
        })
      })
    },
    weatherUpdated: {
      subscribe: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.resolve({ done: true, value: null })
        })
      })
    }
  }
};

module.exports = mockResolvers;