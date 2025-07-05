const sensorService = require('../services/sensorService');
const deviceService = require('../services/deviceService');
const authService = require('../services/authService');
const weatherService = require('../services/weatherService');
const rulesEngineService = require('../services/rulesEngineService');
const notificationService = require('../services/notificationService');

// Import resolvers
const Query = require('../schema/resolvers/Query');
const Mutation = require('../schema/resolvers/Mutation');
const { User } = require('../schema/resolvers/types/User');
const { Sensor, SensorReading } = require('../schema/resolvers/types/Sensor');
const { Device } = require('../schema/resolvers/types/Device');
const { Rule } = require('../schema/resolvers/types/Rule');
const { Notification } = require('../schema/resolvers/types/Notification');

describe('GraphQL Resolvers', () => {
  let mockContext;

  beforeEach(() => {
    mockContext = {
      user: mockUsers.admin,
      req: { user: mockUsers.admin }
    };
    jest.clearAllMocks();
  });

  describe('Query Resolvers', () => {
    describe('Health Query', () => {
      it('should return system health status', async () => {
        const result = await Query.health({}, {}, mockContext);
        
        expect(result).toMatchObject({
          status: expect.any(String),
          timestamp: expect.any(Date),
          services: expect.objectContaining({
            database: expect.any(String),
            redis: expect.any(String),
            mqtt: expect.any(String)
          })
        });
      });
    });

    describe('Sensor Queries', () => {
      beforeEach(() => {
        sensorService.getAllSensors.mockResolvedValue([
          mockSensorData.temhum1,
          mockSensorData.temhum2,
          mockSensorData.calidadAgua
        ]);
        sensorService.getSensorById.mockResolvedValue(mockSensorData.temhum1);
        sensorService.getLatestSensorData.mockResolvedValue([
          mockSensorData.temhum1.readings[0]
        ]);
        sensorService.getSensorReadings.mockResolvedValue({
          edges: [
            {
              cursor: 'cursor1',
              node: mockSensorData.temhum1.readings[0]
            }
          ],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: 'cursor1',
            endCursor: 'cursor1'
          },
          totalCount: 1
        });
        sensorService.getSensorStatistics.mockResolvedValue({
          sensor: mockSensorData.temhum1,
          timeRange: { from: new Date(), to: new Date() },
          temperaturaStats: { min: 20, max: 30, avg: 25, count: 100 },
          totalReadings: 100,
          validReadings: 98,
          errorReadings: 2,
          dataQualityPercent: 98.0,
          uptimePercent: 95.0
        });
      });

      it('should get all sensors', async () => {
        const result = await Query.sensors({}, {}, mockContext);
        
        expect(sensorService.getAllSensors).toHaveBeenCalledWith({});
        expect(result).toHaveLength(3);
        expect(result[0]).toMatchObject({
          id: expect.any(Number),
          name: expect.any(String),
          type: expect.any(String)
        });
      });

      it('should get sensors with filters', async () => {
        const args = { types: ['TEMHUM1'], online: true };
        await Query.sensors({}, args, mockContext);
        
        expect(sensorService.getAllSensors).toHaveBeenCalledWith(args);
      });

      it('should get sensor by id', async () => {
        const args = { id: '1' };
        const result = await Query.sensor({}, args, mockContext);
        
        expect(sensorService.getSensorById).toHaveBeenCalledWith('1');
        expect(result).toEqual(mockSensorData.temhum1);
      });

      it('should get latest sensor data', async () => {
        const args = { types: ['TEMHUM1'] };
        const result = await Query.latestSensorData({}, args, mockContext);
        
        expect(sensorService.getLatestSensorData).toHaveBeenCalledWith(args.types);
        expect(result).toHaveLength(1);
      });

      it('should get sensor readings with pagination', async () => {
        const args = { sensorId: '1', limit: 10, offset: 0 };
        const result = await Query.sensorReadings({}, args, mockContext);
        
        expect(sensorService.getSensorReadings).toHaveBeenCalledWith('1', {
          limit: 10,
          offset: 0
        });
        expect(result).toMatchObject({
          edges: expect.any(Array),
          pageInfo: expect.any(Object),
          totalCount: expect.any(Number)
        });
      });

      it('should get sensor statistics', async () => {
        const args = {
          sensorId: '1',
          timeRange: { from: new Date('2023-01-01'), to: new Date('2023-12-31') }
        };
        const result = await Query.sensorStats({}, args, mockContext);
        
        expect(sensorService.getSensorStatistics).toHaveBeenCalledWith('1', args.timeRange);
        expect(result).toMatchObject({
          sensor: expect.any(Object),
          timeRange: expect.any(Object),
          totalReadings: expect.any(Number)
        });
      });
    });

    describe('Device Queries', () => {
      beforeEach(() => {
        deviceService.getAllDevices.mockResolvedValue([
          mockDeviceData.bomba,
          mockDeviceData.calefactor
        ]);
        deviceService.getDeviceById.mockResolvedValue(mockDeviceData.bomba);
        deviceService.getDevicesByType.mockResolvedValue([mockDeviceData.bomba]);
      });

      it('should get all devices', async () => {
        const result = await Query.devices({}, {}, mockContext);
        
        expect(deviceService.getAllDevices).toHaveBeenCalledWith({});
        expect(result).toHaveLength(2);
      });

      it('should get device by id', async () => {
        const args = { id: '1' };
        const result = await Query.device({}, args, mockContext);
        
        expect(deviceService.getDeviceById).toHaveBeenCalledWith('1');
        expect(result).toEqual(mockDeviceData.bomba);
      });

      it('should get devices by type', async () => {
        const args = { type: 'PUMP' };
        const result = await Query.devicesByType({}, args, mockContext);
        
        expect(deviceService.getDevicesByType).toHaveBeenCalledWith('PUMP');
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('PUMP');
      });
    });

    describe('Weather Queries', () => {
      beforeEach(() => {
        weatherService.getCurrentWeather.mockResolvedValue({
          id: 1,
          location: 'Test Location',
          temperature: 22.5,
          humidity: 65,
          pressure: 1013.25,
          timestamp: new Date()
        });
        weatherService.getWeatherForecast.mockResolvedValue([
          { id: 1, date: new Date(), temperature: 25.0, humidity: 60 }
        ]);
        weatherService.getWeatherHistory.mockResolvedValue([
          { id: 1, timestamp: new Date(), temperature: 20.0, humidity: 70 }
        ]);
      });

      it('should get current weather', async () => {
        const result = await Query.currentWeather({}, {}, mockContext);
        
        expect(weatherService.getCurrentWeather).toHaveBeenCalled();
        expect(result).toMatchObject({
          location: expect.any(String),
          temperature: expect.any(Number),
          humidity: expect.any(Number)
        });
      });

      it('should get weather forecast', async () => {
        const args = { days: 5 };
        const result = await Query.weatherForecast({}, args, mockContext);
        
        expect(weatherService.getWeatherForecast).toHaveBeenCalledWith(5);
        expect(result).toHaveLength(1);
      });

      it('should get weather history', async () => {
        const args = { timeRange: { from: new Date('2023-01-01'), to: new Date('2023-12-31') } };
        const result = await Query.weatherHistory({}, args, mockContext);
        
        expect(weatherService.getWeatherHistory).toHaveBeenCalledWith(args.timeRange);
        expect(result).toHaveLength(1);
      });
    });

    describe('Rule Queries', () => {
      beforeEach(() => {
        rulesEngineService.getAllRules.mockResolvedValue([mockRuleData.temperatureRule]);
        rulesEngineService.getRuleById.mockResolvedValue(mockRuleData.temperatureRule);
        rulesEngineService.getRuleExecutions.mockResolvedValue([
          {
            id: 1,
            ruleId: 1,
            timestamp: new Date(),
            success: true,
            result: { action: 'device_turned_on' }
          }
        ]);
      });

      it('should get all rules', async () => {
        const result = await Query.rules({}, {}, mockContext);
        
        expect(rulesEngineService.getAllRules).toHaveBeenCalledWith({});
        expect(result).toHaveLength(1);
      });

      it('should get rule by id', async () => {
        const args = { id: '1' };
        const result = await Query.rule({}, args, mockContext);
        
        expect(rulesEngineService.getRuleById).toHaveBeenCalledWith('1');
        expect(result).toEqual(mockRuleData.temperatureRule);
      });

      it('should filter active rules', async () => {
        const args = { isActive: true };
        await Query.rules({}, args, mockContext);
        
        expect(rulesEngineService.getAllRules).toHaveBeenCalledWith(args);
      });
    });

    describe('Notification Queries', () => {
      beforeEach(() => {
        notificationService.getNotifications.mockResolvedValue([
          {
            id: 1,
            title: 'Test Notification',
            message: 'Test message',
            type: 'INFO',
            priority: 'MEDIUM',
            isRead: false,
            timestamp: new Date()
          }
        ]);
        notificationService.getNotificationById.mockResolvedValue({
          id: 1,
          title: 'Test Notification',
          message: 'Test message',
          type: 'INFO',
          priority: 'MEDIUM',
          isRead: false,
          timestamp: new Date()
        });
      });

      it('should get notifications', async () => {
        const result = await Query.notifications({}, {}, mockContext);
        
        expect(notificationService.getNotifications).toHaveBeenCalledWith({});
        expect(result).toHaveLength(1);
      });

      it('should get notification by id', async () => {
        const args = { id: '1' };
        const result = await Query.notification({}, args, mockContext);
        
        expect(notificationService.getNotificationById).toHaveBeenCalledWith('1');
        expect(result).toMatchObject({
          id: 1,
          title: 'Test Notification'
        });
      });

      it('should filter notifications by type', async () => {
        const args = { type: 'INFO' };
        await Query.notifications({}, args, mockContext);
        
        expect(notificationService.getNotifications).toHaveBeenCalledWith(args);
      });
    });

    describe('User Queries', () => {
      it('should get current user', async () => {
        const result = await Query.me({}, {}, mockContext);
        
        expect(result).toEqual(mockUsers.admin);
      });

      it('should require authentication', async () => {
        const unauthenticatedContext = { user: null };
        
        await expect(Query.me({}, {}, unauthenticatedContext))
          .rejects.toThrow('Authentication required');
      });
    });
  });

  describe('Mutation Resolvers', () => {
    describe('Authentication Mutations', () => {
      beforeEach(() => {
        authService.login.mockResolvedValue({
          user: mockUsers.admin,
          token: 'mock-token',
          refreshToken: 'mock-refresh-token'
        });
        authService.register.mockResolvedValue({
          user: { ...mockUsers.admin, id: 4 },
          token: 'mock-token',
          refreshToken: 'mock-refresh-token'
        });
        authService.refreshToken.mockResolvedValue({
          token: 'new-token',
          refreshToken: 'new-refresh-token'
        });
      });

      it('should login user', async () => {
        const args = { username: 'admin', password: 'password' };
        const result = await Mutation.login({}, args, mockContext);
        
        expect(authService.login).toHaveBeenCalledWith('admin', 'password');
        expect(result).toMatchObject({
          user: expect.any(Object),
          token: expect.any(String),
          refreshToken: expect.any(String)
        });
      });

      it('should register user', async () => {
        const args = {
          input: {
            username: 'newuser',
            email: 'newuser@test.com',
            password: 'password123',
            role: 'viewer'
          }
        };
        const result = await Mutation.register({}, args, mockContext);
        
        expect(authService.register).toHaveBeenCalledWith(args.input);
        expect(result).toMatchObject({
          user: expect.any(Object),
          token: expect.any(String),
          refreshToken: expect.any(String)
        });
      });

      it('should refresh token', async () => {
        const args = { refreshToken: 'mock-refresh-token' };
        const result = await Mutation.refreshToken({}, args, mockContext);
        
        expect(authService.refreshToken).toHaveBeenCalledWith('mock-refresh-token');
        expect(result).toMatchObject({
          token: expect.any(String),
          refreshToken: expect.any(String)
        });
      });
    });

    describe('Device Control Mutations', () => {
      beforeEach(() => {
        deviceService.createDevice.mockResolvedValue({
          id: 3,
          name: 'New Device',
          type: 'SENSOR',
          status: 'ONLINE',
          createdAt: new Date()
        });
        deviceService.updateDevice.mockResolvedValue({
          ...mockDeviceData.bomba,
          name: 'Updated Device'
        });
        deviceService.deleteDevice.mockResolvedValue(true);
        deviceService.controlDevice.mockResolvedValue({
          success: true,
          message: 'Device controlled',
          newStatus: 'ON'
        });
      });

      it('should create device', async () => {
        const args = {
          input: {
            name: 'New Device',
            type: 'SENSOR',
            description: 'Test device'
          }
        };
        const result = await Mutation.createDevice({}, args, mockContext);
        
        expect(deviceService.createDevice).toHaveBeenCalledWith(args.input);
        expect(result).toMatchObject({
          id: expect.any(Number),
          name: 'New Device',
          type: 'SENSOR'
        });
      });

      it('should update device', async () => {
        const args = {
          id: '1',
          input: { name: 'Updated Device' }
        };
        const result = await Mutation.updateDevice({}, args, mockContext);
        
        expect(deviceService.updateDevice).toHaveBeenCalledWith('1', args.input);
        expect(result.name).toBe('Updated Device');
      });

      it('should delete device', async () => {
        const args = { id: '1' };
        const result = await Mutation.deleteDevice({}, args, mockContext);
        
        expect(deviceService.deleteDevice).toHaveBeenCalledWith('1');
        expect(result).toBe(true);
      });

      it('should control device', async () => {
        const args = {
          id: '1',
          action: 'turn_on',
          parameters: { duration: 300 }
        };
        const result = await Mutation.controlDevice({}, args, mockContext);
        
        expect(deviceService.controlDevice).toHaveBeenCalledWith('1', 'turn_on', { duration: 300 });
        expect(result).toMatchObject({
          success: true,
          message: expect.any(String),
          newStatus: expect.any(String)
        });
      });
    });

    describe('Rule Management Mutations', () => {
      beforeEach(() => {
        rulesEngineService.createRule.mockResolvedValue({
          id: 2,
          name: 'New Rule',
          isActive: true,
          conditions: { sensor: 'temhum1' },
          actions: [{ type: 'notification' }],
          createdAt: new Date()
        });
        rulesEngineService.updateRule.mockResolvedValue({
          ...mockRuleData.temperatureRule,
          name: 'Updated Rule'
        });
        rulesEngineService.deleteRule.mockResolvedValue(true);
        rulesEngineService.executeRule.mockResolvedValue({
          success: true,
          result: { executed: true }
        });
        rulesEngineService.toggleRule.mockResolvedValue({
          ...mockRuleData.temperatureRule,
          isActive: false
        });
      });

      it('should create rule', async () => {
        const args = {
          input: {
            name: 'New Rule',
            conditions: { sensor: 'temhum1' },
            actions: [{ type: 'notification' }]
          }
        };
        const result = await Mutation.createRule({}, args, mockContext);
        
        expect(rulesEngineService.createRule).toHaveBeenCalledWith(args.input);
        expect(result).toMatchObject({
          id: expect.any(Number),
          name: 'New Rule',
          isActive: true
        });
      });

      it('should update rule', async () => {
        const args = {
          id: '1',
          input: { name: 'Updated Rule' }
        };
        const result = await Mutation.updateRule({}, args, mockContext);
        
        expect(rulesEngineService.updateRule).toHaveBeenCalledWith('1', args.input);
        expect(result.name).toBe('Updated Rule');
      });

      it('should execute rule', async () => {
        const args = { id: '1' };
        const result = await Mutation.executeRule({}, args, mockContext);
        
        expect(rulesEngineService.executeRule).toHaveBeenCalledWith('1');
        expect(result).toMatchObject({
          success: true,
          result: expect.any(Object)
        });
      });

      it('should toggle rule', async () => {
        const args = { id: '1' };
        const result = await Mutation.toggleRule({}, args, mockContext);
        
        expect(rulesEngineService.toggleRule).toHaveBeenCalledWith('1');
        expect(result).toMatchObject({
          id: expect.any(Number),
          isActive: expect.any(Boolean)
        });
      });
    });

    describe('Notification Mutations', () => {
      beforeEach(() => {
        notificationService.createNotification.mockResolvedValue({
          id: 2,
          title: 'New Notification',
          message: 'Test message',
          type: 'INFO',
          priority: 'MEDIUM',
          isRead: false,
          timestamp: new Date()
        });
        notificationService.markAsRead.mockResolvedValue({
          id: 1,
          isRead: true,
          readAt: new Date()
        });
        notificationService.sendNotification.mockResolvedValue({
          success: true,
          message: 'Notification sent'
        });
      });

      it('should create notification', async () => {
        const args = {
          input: {
            title: 'New Notification',
            message: 'Test message',
            type: 'INFO',
            priority: 'MEDIUM'
          }
        };
        const result = await Mutation.createNotification({}, args, mockContext);
        
        expect(notificationService.createNotification).toHaveBeenCalledWith(args.input);
        expect(result).toMatchObject({
          id: expect.any(Number),
          title: 'New Notification',
          isRead: false
        });
      });

      it('should mark notification as read', async () => {
        const args = { id: '1' };
        const result = await Mutation.markNotificationAsRead({}, args, mockContext);
        
        expect(notificationService.markAsRead).toHaveBeenCalledWith('1');
        expect(result.isRead).toBe(true);
      });

      it('should send notification', async () => {
        const args = {
          input: {
            title: 'Alert',
            message: 'System alert',
            type: 'ALERT',
            priority: 'HIGH',
            recipients: ['admin@test.com']
          }
        };
        const result = await Mutation.sendNotification({}, args, mockContext);
        
        expect(notificationService.sendNotification).toHaveBeenCalledWith(args.input);
        expect(result).toMatchObject({
          success: true,
          message: expect.any(String)
        });
      });
    });
  });

  describe('Type Resolvers', () => {
    describe('User Type Resolvers', () => {
      it('should resolve user devices', async () => {
        deviceService.getDevicesByUserId.mockResolvedValue([mockDeviceData.bomba]);
        
        const result = await User.devices(mockUsers.admin, {}, mockContext);
        
        expect(deviceService.getDevicesByUserId).toHaveBeenCalledWith(mockUsers.admin.id);
        expect(result).toHaveLength(1);
      });

      it('should resolve user notifications', async () => {
        notificationService.getNotificationsByUserId.mockResolvedValue([
          { id: 1, title: 'User Notification', isRead: false }
        ]);
        
        const result = await User.notifications(mockUsers.admin, {}, mockContext);
        
        expect(notificationService.getNotificationsByUserId).toHaveBeenCalledWith(mockUsers.admin.id);
        expect(result).toHaveLength(1);
      });

      it('should resolve user configurations', async () => {
        const mockConfig = {
          userId: mockUsers.admin.id,
          theme: 'dark',
          language: 'es',
          notifications: { email: true, push: false }
        };
        
        const userService = require('../services/userService');
        userService.getUserConfiguration = jest.fn().mockResolvedValue(mockConfig);
        
        const result = await User.configuration(mockUsers.admin, {}, mockContext);
        
        expect(userService.getUserConfiguration).toHaveBeenCalledWith(mockUsers.admin.id);
        expect(result).toEqual(mockConfig);
      });
    });

    describe('Sensor Type Resolvers', () => {
      it('should resolve sensor latest reading', async () => {
        sensorService.getLatestReading.mockResolvedValue(mockSensorData.temhum1.readings[0]);
        
        const result = await Sensor.latestReading(mockSensorData.temhum1, {}, mockContext);
        
        expect(sensorService.getLatestReading).toHaveBeenCalledWith(mockSensorData.temhum1.id);
        expect(result).toEqual(mockSensorData.temhum1.readings[0]);
      });

      it('should resolve sensor readings with pagination', async () => {
        const mockReadings = [mockSensorData.temhum1.readings[0]];
        sensorService.getSensorReadingsList.mockResolvedValue(mockReadings);
        
        const args = { limit: 10, from: new Date('2023-01-01'), to: new Date('2023-12-31') };
        const result = await Sensor.readings(mockSensorData.temhum1, args, mockContext);
        
        expect(sensorService.getSensorReadingsList).toHaveBeenCalledWith(
          mockSensorData.temhum1.id,
          args
        );
        expect(result).toEqual(mockReadings);
      });

      it('should resolve sensor statistics', async () => {
        const mockStats = {
          sensor: mockSensorData.temhum1,
          timeRange: { from: new Date(), to: new Date() },
          temperaturaStats: { min: 20, max: 30, avg: 25 },
          totalReadings: 100
        };
        sensorService.getSensorStatistics.mockResolvedValue(mockStats);
        
        const args = { timeRange: { from: new Date('2023-01-01'), to: new Date('2023-12-31') } };
        const result = await Sensor.stats(mockSensorData.temhum1, args, mockContext);
        
        expect(sensorService.getSensorStatistics).toHaveBeenCalledWith(
          mockSensorData.temhum1.id,
          args.timeRange
        );
        expect(result).toEqual(mockStats);
      });
    });

    describe('SensorReading Type Resolvers', () => {
      it('should resolve sensor reading sensor', async () => {
        sensorService.getSensorById.mockResolvedValue(mockSensorData.temhum1);
        
        const reading = { ...mockSensorData.temhum1.readings[0], sensorId: 1 };
        const result = await SensorReading.sensor(reading, {}, mockContext);
        
        expect(sensorService.getSensorById).toHaveBeenCalledWith(1);
        expect(result).toEqual(mockSensorData.temhum1);
      });
    });

    describe('Device Type Resolvers', () => {
      it('should resolve device events', async () => {
        const mockEvents = [
          {
            id: 1,
            deviceId: mockDeviceData.bomba.id,
            eventType: 'STATE_CHANGE',
            timestamp: new Date(),
            data: { from: 'OFF', to: 'ON' }
          }
        ];
        deviceService.getDeviceEvents.mockResolvedValue(mockEvents);
        
        const args = { limit: 10 };
        const result = await Device.events(mockDeviceData.bomba, args, mockContext);
        
        expect(deviceService.getDeviceEvents).toHaveBeenCalledWith(
          mockDeviceData.bomba.id,
          args
        );
        expect(result).toEqual(mockEvents);
      });

      it('should resolve device owner', async () => {
        const mockOwner = { ...mockUsers.admin, id: mockDeviceData.bomba.ownerId };
        const userService = require('../services/userService');
        userService.getUserById = jest.fn().mockResolvedValue(mockOwner);
        
        const device = { ...mockDeviceData.bomba, ownerId: 1 };
        const result = await Device.owner(device, {}, mockContext);
        
        expect(userService.getUserById).toHaveBeenCalledWith(1);
        expect(result).toEqual(mockOwner);
      });
    });

    describe('Rule Type Resolvers', () => {
      it('should resolve rule executions', async () => {
        const mockExecutions = [
          {
            id: 1,
            ruleId: mockRuleData.temperatureRule.id,
            timestamp: new Date(),
            success: true,
            result: { action: 'executed' }
          }
        ];
        rulesEngineService.getRuleExecutions.mockResolvedValue(mockExecutions);
        
        const args = { limit: 10 };
        const result = await Rule.executions(mockRuleData.temperatureRule, args, mockContext);
        
        expect(rulesEngineService.getRuleExecutions).toHaveBeenCalledWith(
          mockRuleData.temperatureRule.id,
          args
        );
        expect(result).toEqual(mockExecutions);
      });

      it('should resolve rule statistics', async () => {
        const mockStats = {
          rule: mockRuleData.temperatureRule,
          totalExecutions: 50,
          successfulExecutions: 48,
          failedExecutions: 2,
          averageExecutionTime: 125.5
        };
        rulesEngineService.getRuleStatistics.mockResolvedValue(mockStats);
        
        const result = await Rule.statistics(mockRuleData.temperatureRule, {}, mockContext);
        
        expect(rulesEngineService.getRuleStatistics).toHaveBeenCalledWith(
          mockRuleData.temperatureRule.id
        );
        expect(result).toEqual(mockStats);
      });
    });

    describe('Notification Type Resolvers', () => {
      it('should resolve notification template', async () => {
        const mockTemplate = {
          id: 1,
          name: 'Alert Template',
          subject: 'Alert',
          body: 'Alert message'
        };
        notificationService.getNotificationTemplate.mockResolvedValue(mockTemplate);
        
        const notification = { id: 1, templateId: 1 };
        const result = await Notification.template(notification, {}, mockContext);
        
        expect(notificationService.getNotificationTemplate).toHaveBeenCalledWith(1);
        expect(result).toEqual(mockTemplate);
      });

      it('should resolve notification recipient', async () => {
        const mockRecipient = mockUsers.viewer;
        const userService = require('../services/userService');
        userService.getUserById = jest.fn().mockResolvedValue(mockRecipient);
        
        const notification = { id: 1, recipientId: 3 };
        const result = await Notification.recipient(notification, {}, mockContext);
        
        expect(userService.getUserById).toHaveBeenCalledWith(3);
        expect(result).toEqual(mockRecipient);
      });
    });
  });

  describe('Error Handling in Resolvers', () => {
    it('should handle service errors gracefully', async () => {
      sensorService.getAllSensors.mockRejectedValue(new Error('Database connection failed'));
      
      await expect(Query.sensors({}, {}, mockContext))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle not found errors', async () => {
      sensorService.getSensorById.mockResolvedValue(null);
      
      const result = await Query.sensor({}, { id: '999' }, mockContext);
      expect(result).toBeNull();
    });

    it('should handle authorization errors', async () => {
      const unauthorizedContext = { user: null };
      
      await expect(Mutation.createDevice({}, { input: {} }, unauthorizedContext))
        .rejects.toThrow('Authentication required');
    });

    it('should handle insufficient permissions', async () => {
      const viewerContext = { user: mockUsers.viewer };
      
      await expect(Mutation.deleteDevice({}, { id: '1' }, viewerContext))
        .rejects.toThrow('Insufficient permissions');
    });
  });

  describe('Data Validation in Resolvers', () => {
    it('should validate input parameters', async () => {
      const invalidArgs = { id: '' };
      
      await expect(Query.sensor({}, invalidArgs, mockContext))
        .rejects.toThrow('Invalid sensor ID');
    });

    it('should validate required fields in mutations', async () => {
      const invalidInput = { input: { type: 'SENSOR' } }; // Missing name
      
      await expect(Mutation.createDevice({}, invalidInput, mockContext))
        .rejects.toThrow('Device name is required');
    });

    it('should validate enum values', async () => {
      const invalidInput = { input: { name: 'Test', type: 'INVALID_TYPE' } };
      
      await expect(Mutation.createDevice({}, invalidInput, mockContext))
        .rejects.toThrow('Invalid device type');
    });
  });

  describe('Performance and Caching', () => {
    it('should use caching for frequently accessed data', async () => {
      // Mock cache hit
      const cacheService = require('../services/cacheService');
      cacheService.get = jest.fn().mockResolvedValue(mockSensorData.temhum1);
      
      const result = await Query.sensor({}, { id: '1' }, mockContext);
      
      expect(cacheService.get).toHaveBeenCalledWith('sensor:1');
      expect(sensorService.getSensorById).not.toHaveBeenCalled();
      expect(result).toEqual(mockSensorData.temhum1);
    });

    it('should handle cache misses', async () => {
      const cacheService = require('../services/cacheService');
      cacheService.get = jest.fn().mockResolvedValue(null);
      cacheService.set = jest.fn().mockResolvedValue(true);
      
      sensorService.getSensorById.mockResolvedValue(mockSensorData.temhum1);
      
      const result = await Query.sensor({}, { id: '1' }, mockContext);
      
      expect(cacheService.get).toHaveBeenCalledWith('sensor:1');
      expect(sensorService.getSensorById).toHaveBeenCalledWith('1');
      expect(cacheService.set).toHaveBeenCalledWith('sensor:1', mockSensorData.temhum1);
      expect(result).toEqual(mockSensorData.temhum1);
    });
  });
});