const { gql } = require('apollo-server-express');
const sensorService = require('../services/sensorService');
const deviceService = require('../services/deviceService');
const weatherService = require('../services/weatherService');
const rulesEngineService = require('../services/rulesEngineService');
const notificationService = require('../services/notificationService');

describe('GraphQL Queries', () => {
  let query, mutate;

  beforeEach(() => {
    const { query: testQuery, mutate: testMutate } = createTestServer({
      user: mockUsers.admin
    });
    query = testQuery;
    mutate = testMutate;
  });

  describe('Health Query', () => {
    it('should return health status', async () => {
      const HEALTH_QUERY = gql`
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

      const response = await query({ query: HEALTH_QUERY });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.health).toMatchObject({
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

  describe('Sensor Queries', () => {
    beforeEach(() => {
      sensorService.getAllSensors.mockResolvedValue([
        mockSensorData.temhum1,
        mockSensorData.temhum2,
        mockSensorData.calidadAgua
      ]);
      sensorService.getSensorById.mockResolvedValue(mockSensorData.temhum1);
      sensorService.getLatestSensorData.mockResolvedValue([
        mockSensorData.temhum1.readings[0],
        mockSensorData.temhum2.readings[0]
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
      const SENSORS_QUERY = gql`
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

      const response = await query({ query: SENSORS_QUERY });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.sensors).toHaveLength(3);
      expect(response.data.sensors[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        type: expect.any(String),
        isOnline: expect.any(Boolean)
      });
    });

    it('should get sensor by id', async () => {
      const SENSOR_QUERY = gql`
        query($id: ID!) {
          sensor(id: $id) {
            id
            name
            type
            isOnline
            latestReading {
              temperatura
              humedad
              timestamp
            }
          }
        }
      `;

      const response = await query({
        query: SENSOR_QUERY,
        variables: { id: '1' }
      });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.sensor).toMatchObject({
        id: '1',
        name: 'Sensor TemHum1',
        type: 'TEMHUM1',
        isOnline: true
      });
    });

    it('should get latest sensor data', async () => {
      const LATEST_DATA_QUERY = gql`
        query {
          latestSensorData {
            id
            timestamp
            temperatura
            humedad
            sensor {
              name
              type
            }
          }
        }
      `;

      const response = await query({ query: LATEST_DATA_QUERY });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.latestSensorData).toHaveLength(2);
      expect(response.data.latestSensorData[0]).toMatchObject({
        temperatura: expect.any(Number),
        humedad: expect.any(Number),
        timestamp: expect.any(String)
      });
    });

    it('should get sensor readings with pagination', async () => {
      const SENSOR_READINGS_QUERY = gql`
        query($sensorId: ID!, $limit: Int, $offset: Int) {
          sensorReadings(sensorId: $sensorId, limit: $limit, offset: $offset) {
            edges {
              cursor
              node {
                id
                timestamp
                temperatura
                humedad
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
      `;

      const response = await query({
        query: SENSOR_READINGS_QUERY,
        variables: { sensorId: '1', limit: 10, offset: 0 }
      });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.sensorReadings).toMatchObject({
        edges: expect.any(Array),
        pageInfo: expect.objectContaining({
          hasNextPage: expect.any(Boolean),
          hasPreviousPage: expect.any(Boolean)
        }),
        totalCount: expect.any(Number)
      });
    });

    it('should get sensor statistics', async () => {
      const SENSOR_STATS_QUERY = gql`
        query($sensorId: ID!, $timeRange: TimeRange!) {
          sensorStats(sensorId: $sensorId, timeRange: $timeRange) {
            sensor {
              id
              name
            }
            timeRange {
              from
              to
            }
            temperaturaStats {
              min
              max
              avg
              count
            }
            totalReadings
            validReadings
            errorReadings
            dataQualityPercent
            uptimePercent
          }
        }
      `;

      const response = await query({
        query: SENSOR_STATS_QUERY,
        variables: {
          sensorId: '1',
          timeRange: {
            from: new Date('2023-01-01'),
            to: new Date('2023-12-31')
          }
        }
      });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.sensorStats).toMatchObject({
        sensor: expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String)
        }),
        totalReadings: expect.any(Number),
        validReadings: expect.any(Number),
        errorReadings: expect.any(Number),
        dataQualityPercent: expect.any(Number),
        uptimePercent: expect.any(Number)
      });
    });

    it('should filter sensors by type', async () => {
      sensorService.getAllSensors.mockResolvedValue([mockSensorData.temhum1]);

      const FILTERED_SENSORS_QUERY = gql`
        query($types: [SensorType!]) {
          sensors(types: $types) {
            id
            name
            type
          }
        }
      `;

      const response = await query({
        query: FILTERED_SENSORS_QUERY,
        variables: { types: ['TEMHUM1'] }
      });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.sensors).toHaveLength(1);
      expect(response.data.sensors[0].type).toBe('TEMHUM1');
    });

    it('should filter sensors by online status', async () => {
      sensorService.getAllSensors.mockResolvedValue([mockSensorData.temhum1]);

      const ONLINE_SENSORS_QUERY = gql`
        query($online: Boolean) {
          sensors(online: $online) {
            id
            name
            isOnline
          }
        }
      `;

      const response = await query({
        query: ONLINE_SENSORS_QUERY,
        variables: { online: true }
      });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.sensors.every(sensor => sensor.isOnline)).toBe(true);
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
      deviceService.getDeviceEvents.mockResolvedValue([
        {
          id: 1,
          deviceId: 1,
          eventType: 'STATE_CHANGE',
          timestamp: new Date(),
          data: { from: 'OFF', to: 'ON' }
        }
      ]);
    });

    it('should get all devices', async () => {
      const DEVICES_QUERY = gql`
        query {
          devices {
            id
            name
            type
            status
            isOnline
            lastSeen
          }
        }
      `;

      const response = await query({ query: DEVICES_QUERY });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.devices).toHaveLength(2);
      expect(response.data.devices[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        type: expect.any(String),
        status: expect.any(String),
        isOnline: expect.any(Boolean)
      });
    });

    it('should get device by id', async () => {
      const DEVICE_QUERY = gql`
        query($id: ID!) {
          device(id: $id) {
            id
            name
            type
            status
            configuration
            events(limit: 5) {
              id
              eventType
              timestamp
              data
            }
          }
        }
      `;

      const response = await query({
        query: DEVICE_QUERY,
        variables: { id: '1' }
      });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.device).toMatchObject({
        id: '1',
        name: 'Bomba de Agua',
        type: 'PUMP',
        status: 'ONLINE'
      });
    });

    it('should get devices by type', async () => {
      const DEVICES_BY_TYPE_QUERY = gql`
        query($type: DeviceType!) {
          devicesByType(type: $type) {
            id
            name
            type
          }
        }
      `;

      const response = await query({
        query: DEVICES_BY_TYPE_QUERY,
        variables: { type: 'PUMP' }
      });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.devicesByType).toHaveLength(1);
      expect(response.data.devicesByType[0].type).toBe('PUMP');
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
        windSpeed: 10.5,
        windDirection: 'NW',
        description: 'Partly cloudy',
        timestamp: new Date()
      });
      weatherService.getWeatherForecast.mockResolvedValue([
        {
          id: 1,
          date: new Date(),
          temperature: 25.0,
          humidity: 60,
          description: 'Sunny'
        }
      ]);
      weatherService.getWeatherHistory.mockResolvedValue([
        {
          id: 1,
          timestamp: new Date(),
          temperature: 20.0,
          humidity: 70
        }
      ]);
    });

    it('should get current weather', async () => {
      const CURRENT_WEATHER_QUERY = gql`
        query {
          currentWeather {
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

      const response = await query({ query: CURRENT_WEATHER_QUERY });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.currentWeather).toMatchObject({
        location: expect.any(String),
        temperature: expect.any(Number),
        humidity: expect.any(Number),
        pressure: expect.any(Number),
        windSpeed: expect.any(Number),
        windDirection: expect.any(String),
        description: expect.any(String)
      });
    });

    it('should get weather forecast', async () => {
      const WEATHER_FORECAST_QUERY = gql`
        query($days: Int) {
          weatherForecast(days: $days) {
            id
            date
            temperature
            humidity
            description
          }
        }
      `;

      const response = await query({
        query: WEATHER_FORECAST_QUERY,
        variables: { days: 5 }
      });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.weatherForecast).toHaveLength(1);
      expect(response.data.weatherForecast[0]).toMatchObject({
        temperature: expect.any(Number),
        humidity: expect.any(Number),
        description: expect.any(String)
      });
    });

    it('should get weather history', async () => {
      const WEATHER_HISTORY_QUERY = gql`
        query($timeRange: TimeRange!) {
          weatherHistory(timeRange: $timeRange) {
            id
            timestamp
            temperature
            humidity
          }
        }
      `;

      const response = await query({
        query: WEATHER_HISTORY_QUERY,
        variables: {
          timeRange: {
            from: new Date('2023-01-01'),
            to: new Date('2023-12-31')
          }
        }
      });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.weatherHistory).toHaveLength(1);
      expect(response.data.weatherHistory[0]).toMatchObject({
        timestamp: expect.any(String),
        temperature: expect.any(Number),
        humidity: expect.any(Number)
      });
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
          result: { action: 'device_turned_on', deviceId: 2 }
        }
      ]);
      rulesEngineService.getRuleStatistics.mockResolvedValue({
        rule: mockRuleData.temperatureRule,
        totalExecutions: 50,
        successfulExecutions: 48,
        failedExecutions: 2,
        averageExecutionTime: 125.5,
        lastExecution: new Date()
      });
    });

    it('should get all rules', async () => {
      const RULES_QUERY = gql`
        query {
          rules {
            id
            name
            description
            isActive
            conditions
            actions
            createdAt
            updatedAt
          }
        }
      `;

      const response = await query({ query: RULES_QUERY });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.rules).toHaveLength(1);
      expect(response.data.rules[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        isActive: expect.any(Boolean)
      });
    });

    it('should get rule by id', async () => {
      const RULE_QUERY = gql`
        query($id: ID!) {
          rule(id: $id) {
            id
            name
            description
            isActive
            conditions
            actions
            executions(limit: 10) {
              id
              timestamp
              success
              result
            }
            statistics {
              totalExecutions
              successfulExecutions
              failedExecutions
              averageExecutionTime
              lastExecution
            }
          }
        }
      `;

      const response = await query({
        query: RULE_QUERY,
        variables: { id: '1' }
      });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.rule).toMatchObject({
        id: '1',
        name: 'Control de Temperatura',
        description: expect.any(String),
        isActive: true
      });
    });

    it('should get active rules only', async () => {
      rulesEngineService.getAllRules.mockResolvedValue([
        { ...mockRuleData.temperatureRule, isActive: true }
      ]);

      const ACTIVE_RULES_QUERY = gql`
        query($isActive: Boolean) {
          rules(isActive: $isActive) {
            id
            name
            isActive
          }
        }
      `;

      const response = await query({
        query: ACTIVE_RULES_QUERY,
        variables: { isActive: true }
      });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.rules.every(rule => rule.isActive)).toBe(true);
    });
  });

  describe('Notification Queries', () => {
    beforeEach(() => {
      notificationService.getNotifications.mockResolvedValue([
        {
          id: 1,
          title: 'Test Notification',
          message: 'This is a test notification',
          type: 'INFO',
          priority: 'MEDIUM',
          isRead: false,
          timestamp: new Date()
        }
      ]);
      notificationService.getNotificationById.mockResolvedValue({
        id: 1,
        title: 'Test Notification',
        message: 'This is a test notification',
        type: 'INFO',
        priority: 'MEDIUM',
        isRead: false,
        timestamp: new Date()
      });
      notificationService.getNotificationTemplates.mockResolvedValue([
        {
          id: 1,
          name: 'Temperature Alert',
          subject: 'Temperature Alert',
          body: 'Temperature is {{temperature}}°C',
          variables: [{ name: 'temperature', type: 'NUMBER', required: true }]
        }
      ]);
    });

    it('should get notifications', async () => {
      const NOTIFICATIONS_QUERY = gql`
        query {
          notifications {
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

      const response = await query({ query: NOTIFICATIONS_QUERY });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.notifications).toHaveLength(1);
      expect(response.data.notifications[0]).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        message: expect.any(String),
        type: expect.any(String),
        priority: expect.any(String),
        isRead: expect.any(Boolean)
      });
    });

    it('should get notification by id', async () => {
      const NOTIFICATION_QUERY = gql`
        query($id: ID!) {
          notification(id: $id) {
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

      const response = await query({
        query: NOTIFICATION_QUERY,
        variables: { id: '1' }
      });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.notification).toMatchObject({
        id: '1',
        title: 'Test Notification',
        message: 'This is a test notification',
        type: 'INFO',
        priority: 'MEDIUM',
        isRead: false
      });
    });

    it('should get notification templates', async () => {
      const NOTIFICATION_TEMPLATES_QUERY = gql`
        query {
          notificationTemplates {
            id
            name
            subject
            body
            variables {
              name
              type
              required
            }
          }
        }
      `;

      const response = await query({ query: NOTIFICATION_TEMPLATES_QUERY });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.notificationTemplates).toHaveLength(1);
      expect(response.data.notificationTemplates[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        subject: expect.any(String),
        body: expect.any(String),
        variables: expect.any(Array)
      });
    });

    it('should filter notifications by type', async () => {
      notificationService.getNotifications.mockResolvedValue([
        {
          id: 1,
          title: 'Info Notification',
          type: 'INFO',
          priority: 'MEDIUM',
          isRead: false,
          timestamp: new Date()
        }
      ]);

      const FILTERED_NOTIFICATIONS_QUERY = gql`
        query($type: NotificationType) {
          notifications(type: $type) {
            id
            title
            type
          }
        }
      `;

      const response = await query({
        query: FILTERED_NOTIFICATIONS_QUERY,
        variables: { type: 'INFO' }
      });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.notifications).toHaveLength(1);
      expect(response.data.notifications[0].type).toBe('INFO');
    });

    it('should filter notifications by read status', async () => {
      notificationService.getNotifications.mockResolvedValue([
        {
          id: 1,
          title: 'Unread Notification',
          type: 'INFO',
          priority: 'MEDIUM',
          isRead: false,
          timestamp: new Date()
        }
      ]);

      const UNREAD_NOTIFICATIONS_QUERY = gql`
        query($isRead: Boolean) {
          notifications(isRead: $isRead) {
            id
            title
            isRead
          }
        }
      `;

      const response = await query({
        query: UNREAD_NOTIFICATIONS_QUERY,
        variables: { isRead: false }
      });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.notifications.every(notification => !notification.isRead)).toBe(true);
    });
  });

  describe('User Queries', () => {
    beforeEach(() => {
      // Mock user service methods would be added here
    });

    it('should get current user', async () => {
      const CURRENT_USER_QUERY = gql`
        query {
          me {
            id
            username
            email
            role
            isActive
            createdAt
          }
        }
      `;

      const response = await query({ query: CURRENT_USER_QUERY });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.me).toMatchObject({
        id: expect.any(String),
        username: expect.any(String),
        email: expect.any(String),
        role: expect.any(String),
        isActive: expect.any(Boolean)
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid sensor ID', async () => {
      sensorService.getSensorById.mockResolvedValue(null);

      const INVALID_SENSOR_QUERY = gql`
        query($id: ID!) {
          sensor(id: $id) {
            id
            name
          }
        }
      `;

      const response = await query({
        query: INVALID_SENSOR_QUERY,
        variables: { id: '999' }
      });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.sensor).toBeNull();
    });

    it('should handle service errors gracefully', async () => {
      sensorService.getAllSensors.mockRejectedValue(new Error('Database connection failed'));

      const SENSORS_QUERY = gql`
        query {
          sensors {
            id
            name
          }
        }
      `;

      const response = await query({ query: SENSORS_QUERY });
      
      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Database connection failed');
    });
  });
});