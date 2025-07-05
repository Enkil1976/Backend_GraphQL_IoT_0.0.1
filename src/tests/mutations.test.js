const { gql } = require('apollo-server-express');
const authService = require('../services/authService');
const deviceService = require('../services/deviceService');
const weatherService = require('../services/weatherService');
const rulesEngineService = require('../services/rulesEngineService');
const notificationService = require('../services/notificationService');

describe('GraphQL Mutations', () => {
  let query, mutate;

  beforeEach(() => {
    const { query: testQuery, mutate: testMutate } = createTestServer({
      user: mockUsers.admin
    });
    query = testQuery;
    mutate = testMutate;
  });

  describe('Authentication Mutations', () => {
    beforeEach(() => {
      authService.login.mockResolvedValue({
        user: mockUsers.admin,
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token'
      });
      authService.register.mockResolvedValue({
        user: { ...mockUsers.admin, id: 4 },
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token'
      });
      authService.refreshToken.mockResolvedValue({
        token: 'new-jwt-token',
        refreshToken: 'new-refresh-token'
      });
    });

    it('should login user with valid credentials', async () => {
      const LOGIN_MUTATION = gql`
        mutation($username: String!, $password: String!) {
          login(username: $username, password: $password) {
            user {
              id
              username
              email
              role
              isActive
            }
            token
            refreshToken
          }
        }
      `;

      const response = await mutate({
        mutation: LOGIN_MUTATION,
        variables: {
          username: 'admin',
          password: 'password'
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.login).toMatchObject({
        user: {
          id: expect.any(String),
          username: 'admin',
          email: 'admin@test.com',
          role: 'admin',
          isActive: true
        },
        token: expect.any(String),
        refreshToken: expect.any(String)
      });
      expect(authService.login).toHaveBeenCalledWith('admin', 'password');
    });

    it('should register new user', async () => {
      const REGISTER_MUTATION = gql`
        mutation($input: RegisterInput!) {
          register(input: $input) {
            user {
              id
              username
              email
              role
              isActive
            }
            token
            refreshToken
          }
        }
      `;

      const response = await mutate({
        mutation: REGISTER_MUTATION,
        variables: {
          input: {
            username: 'newuser',
            email: 'newuser@test.com',
            password: 'securepassword123',
            role: 'viewer'
          }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.register).toMatchObject({
        user: {
          id: expect.any(String),
          username: expect.any(String),
          email: expect.any(String),
          role: expect.any(String),
          isActive: expect.any(Boolean)
        },
        token: expect.any(String),
        refreshToken: expect.any(String)
      });
    });

    it('should refresh access token', async () => {
      const REFRESH_TOKEN_MUTATION = gql`
        mutation($refreshToken: String!) {
          refreshToken(refreshToken: $refreshToken) {
            token
            refreshToken
          }
        }
      `;

      const response = await mutate({
        mutation: REFRESH_TOKEN_MUTATION,
        variables: {
          refreshToken: 'mock-refresh-token'
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.refreshToken).toMatchObject({
        token: expect.any(String),
        refreshToken: expect.any(String)
      });
    });

    it('should handle invalid login credentials', async () => {
      authService.login.mockRejectedValue(new Error('Invalid credentials'));

      const LOGIN_MUTATION = gql`
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

      const response = await mutate({
        mutation: LOGIN_MUTATION,
        variables: {
          username: 'invalid',
          password: 'wrong'
        }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Invalid credentials');
    });
  });

  describe('Device Control Mutations', () => {
    beforeEach(() => {
      deviceService.createDevice.mockResolvedValue({
        id: 3,
        name: 'New Device',
        type: 'SENSOR',
        status: 'ONLINE',
        isOnline: true,
        configuration: {},
        createdAt: new Date(),
        updatedAt: new Date()
      });
      deviceService.updateDevice.mockResolvedValue({
        ...mockDeviceData.bomba,
        name: 'Updated Bomba'
      });
      deviceService.deleteDevice.mockResolvedValue(true);
      deviceService.controlDevice.mockResolvedValue({
        success: true,
        message: 'Device controlled successfully',
        newStatus: 'ON'
      });
    });

    it('should create new device', async () => {
      const CREATE_DEVICE_MUTATION = gql`
        mutation($input: DeviceInput!) {
          createDevice(input: $input) {
            id
            name
            type
            status
            isOnline
            configuration
            createdAt
            updatedAt
          }
        }
      `;

      const response = await mutate({
        mutation: CREATE_DEVICE_MUTATION,
        variables: {
          input: {
            name: 'New Device',
            type: 'SENSOR',
            description: 'Test device',
            configuration: { interval: 30 }
          }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.createDevice).toMatchObject({
        id: expect.any(String),
        name: 'New Device',
        type: 'SENSOR',
        status: expect.any(String),
        isOnline: expect.any(Boolean)
      });
    });

    it('should update existing device', async () => {
      const UPDATE_DEVICE_MUTATION = gql`
        mutation($id: ID!, $input: DeviceUpdateInput!) {
          updateDevice(id: $id, input: $input) {
            id
            name
            type
            status
            configuration
            updatedAt
          }
        }
      `;

      const response = await mutate({
        mutation: UPDATE_DEVICE_MUTATION,
        variables: {
          id: '1',
          input: {
            name: 'Updated Bomba',
            configuration: { minOnTime: 60 }
          }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.updateDevice).toMatchObject({
        id: '1',
        name: 'Updated Bomba',
        type: expect.any(String),
        status: expect.any(String)
      });
    });

    it('should delete device', async () => {
      const DELETE_DEVICE_MUTATION = gql`
        mutation($id: ID!) {
          deleteDevice(id: $id)
        }
      `;

      const response = await mutate({
        mutation: DELETE_DEVICE_MUTATION,
        variables: { id: '1' }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.deleteDevice).toBe(true);
    });

    it('should control device', async () => {
      const CONTROL_DEVICE_MUTATION = gql`
        mutation($id: ID!, $action: String!, $parameters: JSON) {
          controlDevice(id: $id, action: $action, parameters: $parameters) {
            success
            message
            newStatus
          }
        }
      `;

      const response = await mutate({
        mutation: CONTROL_DEVICE_MUTATION,
        variables: {
          id: '1',
          action: 'turn_on',
          parameters: { duration: 300 }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.controlDevice).toMatchObject({
        success: true,
        message: expect.any(String),
        newStatus: expect.any(String)
      });
    });

    it('should handle device control errors', async () => {
      deviceService.controlDevice.mockRejectedValue(new Error('Device offline'));

      const CONTROL_DEVICE_MUTATION = gql`
        mutation($id: ID!, $action: String!) {
          controlDevice(id: $id, action: $action) {
            success
            message
          }
        }
      `;

      const response = await mutate({
        mutation: CONTROL_DEVICE_MUTATION,
        variables: {
          id: '999',
          action: 'turn_on'
        }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Device offline');
    });
  });

  describe('Rule Management Mutations', () => {
    beforeEach(() => {
      rulesEngineService.createRule.mockResolvedValue({
        id: 2,
        name: 'New Rule',
        description: 'Test rule',
        isActive: true,
        conditions: { sensor: 'temhum1', operator: 'gt', value: 30 },
        actions: [{ type: 'notification', message: 'Temperature high' }],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      rulesEngineService.updateRule.mockResolvedValue({
        ...mockRuleData.temperatureRule,
        name: 'Updated Rule'
      });
      rulesEngineService.deleteRule.mockResolvedValue(true);
      rulesEngineService.executeRule.mockResolvedValue({
        success: true,
        result: { executed: true, actions: 1 }
      });
      rulesEngineService.toggleRule.mockResolvedValue({
        ...mockRuleData.temperatureRule,
        isActive: false
      });
    });

    it('should create new rule', async () => {
      const CREATE_RULE_MUTATION = gql`
        mutation($input: RuleInput!) {
          createRule(input: $input) {
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

      const response = await mutate({
        mutation: CREATE_RULE_MUTATION,
        variables: {
          input: {
            name: 'New Rule',
            description: 'Test rule',
            conditions: { sensor: 'temhum1', operator: 'gt', value: 30 },
            actions: [{ type: 'notification', message: 'Temperature high' }]
          }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.createRule).toMatchObject({
        id: expect.any(String),
        name: 'New Rule',
        description: 'Test rule',
        isActive: true
      });
    });

    it('should update existing rule', async () => {
      const UPDATE_RULE_MUTATION = gql`
        mutation($id: ID!, $input: RuleUpdateInput!) {
          updateRule(id: $id, input: $input) {
            id
            name
            description
            isActive
            conditions
            actions
            updatedAt
          }
        }
      `;

      const response = await mutate({
        mutation: UPDATE_RULE_MUTATION,
        variables: {
          id: '1',
          input: {
            name: 'Updated Rule',
            description: 'Updated description'
          }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.updateRule).toMatchObject({
        id: '1',
        name: 'Updated Rule',
        description: expect.any(String)
      });
    });

    it('should delete rule', async () => {
      const DELETE_RULE_MUTATION = gql`
        mutation($id: ID!) {
          deleteRule(id: $id)
        }
      `;

      const response = await mutate({
        mutation: DELETE_RULE_MUTATION,
        variables: { id: '1' }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.deleteRule).toBe(true);
    });

    it('should execute rule manually', async () => {
      const EXECUTE_RULE_MUTATION = gql`
        mutation($id: ID!) {
          executeRule(id: $id) {
            success
            result
          }
        }
      `;

      const response = await mutate({
        mutation: EXECUTE_RULE_MUTATION,
        variables: { id: '1' }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.executeRule).toMatchObject({
        success: true,
        result: expect.any(Object)
      });
    });

    it('should toggle rule active state', async () => {
      const TOGGLE_RULE_MUTATION = gql`
        mutation($id: ID!) {
          toggleRule(id: $id) {
            id
            name
            isActive
          }
        }
      `;

      const response = await mutate({
        mutation: TOGGLE_RULE_MUTATION,
        variables: { id: '1' }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.toggleRule).toMatchObject({
        id: '1',
        name: expect.any(String),
        isActive: expect.any(Boolean)
      });
    });
  });

  describe('Notification Mutations', () => {
    beforeEach(() => {
      notificationService.createNotification.mockResolvedValue({
        id: 2,
        title: 'New Notification',
        message: 'Test notification',
        type: 'INFO',
        priority: 'MEDIUM',
        isRead: false,
        timestamp: new Date()
      });
      notificationService.markAsRead.mockResolvedValue({
        id: 1,
        title: 'Test Notification',
        message: 'Test message',
        type: 'INFO',
        priority: 'MEDIUM',
        isRead: true,
        timestamp: new Date()
      });
      notificationService.deleteNotification.mockResolvedValue(true);
      notificationService.sendNotification.mockResolvedValue({
        success: true,
        message: 'Notification sent successfully'
      });
      notificationService.createNotificationTemplate.mockResolvedValue({
        id: 2,
        name: 'New Template',
        subject: 'Test Subject',
        body: 'Test body with {{variable}}',
        variables: [{ name: 'variable', type: 'STRING', required: true }],
        createdAt: new Date()
      });
    });

    it('should create notification', async () => {
      const CREATE_NOTIFICATION_MUTATION = gql`
        mutation($input: NotificationInput!) {
          createNotification(input: $input) {
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

      const response = await mutate({
        mutation: CREATE_NOTIFICATION_MUTATION,
        variables: {
          input: {
            title: 'New Notification',
            message: 'Test notification',
            type: 'INFO',
            priority: 'MEDIUM'
          }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.createNotification).toMatchObject({
        id: expect.any(String),
        title: 'New Notification',
        message: 'Test notification',
        type: 'INFO',
        priority: 'MEDIUM',
        isRead: false
      });
    });

    it('should mark notification as read', async () => {
      const MARK_AS_READ_MUTATION = gql`
        mutation($id: ID!) {
          markNotificationAsRead(id: $id) {
            id
            title
            isRead
          }
        }
      `;

      const response = await mutate({
        mutation: MARK_AS_READ_MUTATION,
        variables: { id: '1' }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.markNotificationAsRead).toMatchObject({
        id: '1',
        title: expect.any(String),
        isRead: true
      });
    });

    it('should delete notification', async () => {
      const DELETE_NOTIFICATION_MUTATION = gql`
        mutation($id: ID!) {
          deleteNotification(id: $id)
        }
      `;

      const response = await mutate({
        mutation: DELETE_NOTIFICATION_MUTATION,
        variables: { id: '1' }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.deleteNotification).toBe(true);
    });

    it('should send notification', async () => {
      const SEND_NOTIFICATION_MUTATION = gql`
        mutation($input: SendNotificationInput!) {
          sendNotification(input: $input) {
            success
            message
          }
        }
      `;

      const response = await mutate({
        mutation: SEND_NOTIFICATION_MUTATION,
        variables: {
          input: {
            title: 'Urgent Alert',
            message: 'System alert message',
            type: 'ALERT',
            priority: 'HIGH',
            recipients: ['admin@test.com']
          }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.sendNotification).toMatchObject({
        success: true,
        message: expect.any(String)
      });
    });

    it('should create notification template', async () => {
      const CREATE_TEMPLATE_MUTATION = gql`
        mutation($input: NotificationTemplateInput!) {
          createNotificationTemplate(input: $input) {
            id
            name
            subject
            body
            variables {
              name
              type
              required
            }
            createdAt
          }
        }
      `;

      const response = await mutate({
        mutation: CREATE_TEMPLATE_MUTATION,
        variables: {
          input: {
            name: 'New Template',
            subject: 'Test Subject',
            body: 'Test body with {{variable}}',
            variables: [{ name: 'variable', type: 'STRING', required: true }]
          }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.createNotificationTemplate).toMatchObject({
        id: expect.any(String),
        name: 'New Template',
        subject: 'Test Subject',
        body: expect.any(String),
        variables: expect.any(Array)
      });
    });
  });

  describe('Weather Mutations', () => {
    beforeEach(() => {
      weatherService.updateWeatherConfiguration.mockResolvedValue({
        location: 'Updated Location',
        coordinates: { lat: -33.4569, lng: -70.6483 },
        apiKey: 'updated-key',
        updateInterval: 1800
      });
      weatherService.fetchWeatherData.mockResolvedValue({
        success: true,
        data: {
          temperature: 23.5,
          humidity: 68,
          pressure: 1015.2,
          description: 'Clear sky'
        }
      });
    });

    it('should update weather configuration', async () => {
      const UPDATE_WEATHER_CONFIG_MUTATION = gql`
        mutation($input: WeatherConfigInput!) {
          updateWeatherConfiguration(input: $input) {
            location
            coordinates {
              lat
              lng
            }
            apiKey
            updateInterval
          }
        }
      `;

      const response = await mutate({
        mutation: UPDATE_WEATHER_CONFIG_MUTATION,
        variables: {
          input: {
            location: 'Updated Location',
            coordinates: { lat: -33.4569, lng: -70.6483 },
            apiKey: 'updated-key',
            updateInterval: 1800
          }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.updateWeatherConfiguration).toMatchObject({
        location: 'Updated Location',
        coordinates: {
          lat: expect.any(Number),
          lng: expect.any(Number)
        },
        apiKey: expect.any(String),
        updateInterval: expect.any(Number)
      });
    });

    it('should fetch weather data manually', async () => {
      const FETCH_WEATHER_MUTATION = gql`
        mutation {
          fetchWeatherData {
            success
            data
          }
        }
      `;

      const response = await mutate({
        mutation: FETCH_WEATHER_MUTATION
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.fetchWeatherData).toMatchObject({
        success: true,
        data: expect.any(Object)
      });
    });
  });

  describe('User Management Mutations', () => {
    beforeEach(() => {
      // Mock user service methods
      const userService = require('../services/userService');
      userService.updateUser = jest.fn().mockResolvedValue({
        ...mockUsers.admin,
        email: 'updated@test.com'
      });
      userService.updateUserConfiguration = jest.fn().mockResolvedValue({
        userId: 1,
        theme: 'dark',
        language: 'es',
        notifications: { email: true, push: false }
      });
      userService.changePassword = jest.fn().mockResolvedValue(true);
    });

    it('should update user profile', async () => {
      const UPDATE_USER_MUTATION = gql`
        mutation($input: UserUpdateInput!) {
          updateUser(input: $input) {
            id
            username
            email
            role
            updatedAt
          }
        }
      `;

      const response = await mutate({
        mutation: UPDATE_USER_MUTATION,
        variables: {
          input: {
            email: 'updated@test.com',
            firstName: 'Updated',
            lastName: 'User'
          }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.updateUser).toMatchObject({
        id: expect.any(String),
        username: expect.any(String),
        email: 'updated@test.com',
        role: expect.any(String)
      });
    });

    it('should update user configuration', async () => {
      const UPDATE_USER_CONFIG_MUTATION = gql`
        mutation($input: UserConfigurationInput!) {
          updateUserConfiguration(input: $input) {
            userId
            theme
            language
            notifications {
              email
              push
            }
          }
        }
      `;

      const response = await mutate({
        mutation: UPDATE_USER_CONFIG_MUTATION,
        variables: {
          input: {
            theme: 'dark',
            language: 'es',
            notifications: { email: true, push: false }
          }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.updateUserConfiguration).toMatchObject({
        userId: expect.any(Number),
        theme: 'dark',
        language: 'es',
        notifications: expect.any(Object)
      });
    });

    it('should change user password', async () => {
      const CHANGE_PASSWORD_MUTATION = gql`
        mutation($currentPassword: String!, $newPassword: String!) {
          changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
        }
      `;

      const response = await mutate({
        mutation: CHANGE_PASSWORD_MUTATION,
        variables: {
          currentPassword: 'currentpass',
          newPassword: 'newsecurepass123'
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.changePassword).toBe(true);
    });
  });

  describe('Authorization Tests', () => {
    it('should reject unauthorized mutations', async () => {
      const { mutate: unauthorizedMutate } = createTestServer(); // No user context

      const CREATE_DEVICE_MUTATION = gql`
        mutation($input: DeviceInput!) {
          createDevice(input: $input) {
            id
            name
          }
        }
      `;

      const response = await unauthorizedMutate({
        mutation: CREATE_DEVICE_MUTATION,
        variables: {
          input: {
            name: 'Test Device',
            type: 'SENSOR'
          }
        }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Unauthorized');
    });

    it('should reject insufficient permissions', async () => {
      const { mutate: viewerMutate } = createTestServer({
        user: mockUsers.viewer
      });

      const DELETE_DEVICE_MUTATION = gql`
        mutation($id: ID!) {
          deleteDevice(id: $id)
        }
      `;

      const response = await viewerMutate({
        mutation: DELETE_DEVICE_MUTATION,
        variables: { id: '1' }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Insufficient permissions');
    });
  });

  describe('Input Validation', () => {
    it('should validate required fields', async () => {
      const CREATE_DEVICE_MUTATION = gql`
        mutation($input: DeviceInput!) {
          createDevice(input: $input) {
            id
            name
          }
        }
      `;

      const response = await mutate({
        mutation: CREATE_DEVICE_MUTATION,
        variables: {
          input: {
            // Missing required name field
            type: 'SENSOR'
          }
        }
      });

      expect(response.errors).toBeDefined();
    });

    it('should validate enum values', async () => {
      const CREATE_DEVICE_MUTATION = gql`
        mutation($input: DeviceInput!) {
          createDevice(input: $input) {
            id
            name
          }
        }
      `;

      const response = await mutate({
        mutation: CREATE_DEVICE_MUTATION,
        variables: {
          input: {
            name: 'Test Device',
            type: 'INVALID_TYPE' // Invalid enum value
          }
        }
      });

      expect(response.errors).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      deviceService.createDevice.mockRejectedValue(new Error('Database error'));

      const CREATE_DEVICE_MUTATION = gql`
        mutation($input: DeviceInput!) {
          createDevice(input: $input) {
            id
            name
          }
        }
      `;

      const response = await mutate({
        mutation: CREATE_DEVICE_MUTATION,
        variables: {
          input: {
            name: 'Test Device',
            type: 'SENSOR'
          }
        }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Database error');
    });

    it('should handle network timeouts', async () => {
      weatherService.fetchWeatherData.mockRejectedValue(new Error('Network timeout'));

      const FETCH_WEATHER_MUTATION = gql`
        mutation {
          fetchWeatherData {
            success
            data
          }
        }
      `;

      const response = await mutate({
        mutation: FETCH_WEATHER_MUTATION
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Network timeout');
    });
  });
});