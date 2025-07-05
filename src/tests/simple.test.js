const { gql } = require('apollo-server-express');

describe('GraphQL Backend Tests', () => {
  let query, mutate;

  beforeEach(() => {
    const { query: testQuery, mutate: testMutate } = createTestServer({
      user: mockUsers.admin
    });
    query = testQuery;
    mutate = testMutate;
  });

  describe('Health Check', () => {
    it('should return system health status', async () => {
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
        services: {
          database: expect.any(String),
          redis: expect.any(String),
          mqtt: expect.any(String)
        }
      });
    });
  });

  describe('Authentication', () => {
    it('should require authentication for protected queries', async () => {
      const { query: unauthQuery } = createTestServer(); // No user

      const PROTECTED_QUERY = gql`
        query {
          me {
            id
            username
          }
        }
      `;

      const response = await unauthQuery({ query: PROTECTED_QUERY });
      
      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Authentication required');
    });

    it('should return current user when authenticated', async () => {
      const ME_QUERY = gql`
        query {
          me {
            id
            username
            role
          }
        }
      `;

      const response = await query({ query: ME_QUERY });
      
      expect(response.errors).toBeUndefined();
      expect(response.data.me).toMatchObject({
        id: expect.any(Number),
        username: 'admin',
        role: 'admin'
      });
    });
  });

  describe('Device Control', () => {
    it('should allow admin to control devices', async () => {
      const CONTROL_DEVICE_MUTATION = gql`
        mutation($id: ID!, $action: String!) {
          controlDevice(id: $id, action: $action) {
            success
            message
            newStatus
          }
        }
      `;

      const response = await mutate({
        mutation: CONTROL_DEVICE_MUTATION,
        variables: { id: '1', action: 'turn_on' }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.controlDevice).toMatchObject({
        success: true,
        message: expect.any(String),
        newStatus: expect.any(String)
      });
    });

    it('should deny viewer from controlling devices', async () => {
      const { mutate: viewerMutate } = createTestServer({
        user: mockUsers.viewer
      });

      const CONTROL_DEVICE_MUTATION = gql`
        mutation($id: ID!, $action: String!) {
          controlDevice(id: $id, action: $action) {
            success
            message
          }
        }
      `;

      const response = await viewerMutate({
        mutation: CONTROL_DEVICE_MUTATION,
        variables: { id: '1', action: 'turn_on' }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Insufficient permissions');
    });
  });

  describe('Device Management', () => {
    it('should allow admin to create devices', async () => {
      const CREATE_DEVICE_MUTATION = gql`
        mutation($input: DeviceInput!) {
          createDevice(input: $input) {
            id
            name
            type
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

      expect(response.errors).toBeUndefined();
      expect(response.data.createDevice).toMatchObject({
        id: expect.any(String),
        name: 'Test Device',
        type: 'SENSOR'
      });
    });

    it('should allow admin to delete devices', async () => {
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

    it('should deny editor from deleting devices', async () => {
      const { mutate: editorMutate } = createTestServer({
        user: mockUsers.editor
      });

      const DELETE_DEVICE_MUTATION = gql`
        mutation($id: ID!) {
          deleteDevice(id: $id)
        }
      `;

      const response = await editorMutate({
        mutation: DELETE_DEVICE_MUTATION,
        variables: { id: '1' }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Insufficient permissions');
    });
  });

  describe('Rule Management', () => {
    it('should allow editor to create rules', async () => {
      const { mutate: editorMutate } = createTestServer({
        user: mockUsers.editor
      });

      const CREATE_RULE_MUTATION = gql`
        mutation($input: RuleInput!) {
          createRule(input: $input) {
            id
            name
            isActive
          }
        }
      `;

      const response = await editorMutate({
        mutation: CREATE_RULE_MUTATION,
        variables: {
          input: {
            name: 'Test Rule',
            conditions: { sensor: 'temhum1' },
            actions: [{ type: 'notification' }]
          }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.createRule).toMatchObject({
        id: expect.any(String),
        name: 'Test Rule'
      });
    });

    it('should deny operator from creating rules', async () => {
      const { mutate: operatorMutate } = createTestServer({
        user: mockUsers.operator
      });

      const CREATE_RULE_MUTATION = gql`
        mutation($input: RuleInput!) {
          createRule(input: $input) {
            id
            name
          }
        }
      `;

      const response = await operatorMutate({
        mutation: CREATE_RULE_MUTATION,
        variables: {
          input: {
            name: 'Test Rule',
            conditions: { sensor: 'temhum1' },
            actions: [{ type: 'notification' }]
          }
        }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Insufficient permissions');
    });
  });

  describe('Notification System', () => {
    it('should allow editor to create notifications', async () => {
      const { mutate: editorMutate } = createTestServer({
        user: mockUsers.editor
      });

      const CREATE_NOTIFICATION_MUTATION = gql`
        mutation($input: NotificationInput!) {
          createNotification(input: $input) {
            id
            title
            message
            type
            priority
            isRead
          }
        }
      `;

      const response = await editorMutate({
        mutation: CREATE_NOTIFICATION_MUTATION,
        variables: {
          input: {
            title: 'Test Notification',
            message: 'This is a test',
            type: 'INFO',
            priority: 'MEDIUM'
          }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.createNotification).toMatchObject({
        id: expect.any(String),
        title: 'Test Notification',
        message: 'This is a test',
        type: 'INFO',
        priority: 'MEDIUM',
        isRead: false
      });
    });

    it('should deny viewer from creating notifications', async () => {
      const { mutate: viewerMutate } = createTestServer({
        user: mockUsers.viewer
      });

      const CREATE_NOTIFICATION_MUTATION = gql`
        mutation($input: NotificationInput!) {
          createNotification(input: $input) {
            id
            title
          }
        }
      `;

      const response = await viewerMutate({
        mutation: CREATE_NOTIFICATION_MUTATION,
        variables: {
          input: {
            title: 'Test Notification',
            message: 'This is a test',
            type: 'INFO',
            priority: 'MEDIUM'
          }
        }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Insufficient permissions');
    });
  });

  describe('Weather System', () => {
    it('should allow admin to update weather configuration', async () => {
      const UPDATE_WEATHER_CONFIG_MUTATION = gql`
        mutation($input: WeatherConfigInput!) {
          updateWeatherConfig(input: $input) {
            success
            message
            config {
              location
              updateInterval
            }
          }
        }
      `;

      const response = await mutate({
        mutation: UPDATE_WEATHER_CONFIG_MUTATION,
        variables: {
          input: {
            location: 'Santiago, Chile',
            updateInterval: 1800
          }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.updateWeatherConfig).toMatchObject({
        success: true,
        message: expect.any(String),
        config: {
          location: 'Santiago, Chile',
          updateInterval: 1800
        }
      });
    });

    it('should allow admin to collect weather data', async () => {
      const COLLECT_WEATHER_MUTATION = gql`
        mutation($location: String) {
          collectWeatherData(location: $location) {
            success
            message
            data {
              temperature
              humidity
              pressure
            }
          }
        }
      `;

      const response = await mutate({
        mutation: COLLECT_WEATHER_MUTATION,
        variables: {
          location: 'Santiago, Chile'
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.collectWeatherData).toMatchObject({
        success: true,
        message: expect.any(String),
        data: expect.objectContaining({
          temperature: expect.any(Number),
          humidity: expect.any(Number),
          pressure: expect.any(Number)
        })
      });
    });
  });

  describe('User Management', () => {
    it('should allow user to update their profile', async () => {
      const UPDATE_USER_MUTATION = gql`
        mutation($input: UserUpdateInput!) {
          updateUser(input: $input) {
            id
            username
            email
          }
        }
      `;

      const response = await mutate({
        mutation: UPDATE_USER_MUTATION,
        variables: {
          input: {
            email: 'updated@test.com'
          }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.updateUser).toMatchObject({
        id: expect.any(Number),
        username: expect.any(String),
        email: 'updated@test.com'
      });
    });

    it('should allow user to change password', async () => {
      const CHANGE_PASSWORD_MUTATION = gql`
        mutation($currentPassword: String!, $newPassword: String!) {
          changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
        }
      `;

      const response = await mutate({
        mutation: CHANGE_PASSWORD_MUTATION,
        variables: {
          currentPassword: 'oldpass',
          newPassword: 'newpass123'
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.changePassword).toBe(true);
    });
  });

  describe('Role-Based Access Control', () => {
    it('should have different permissions for each role', async () => {
      const roles = ['admin', 'editor', 'operator', 'viewer'];
      
      for (const role of roles) {
        const user = { ...mockUsers.admin, role };
        const { mutate: roleMutate } = createTestServer({ user });

        const DELETE_DEVICE_MUTATION = gql`
          mutation($id: ID!) {
            deleteDevice(id: $id)
          }
        `;

        const response = await roleMutate({
          mutation: DELETE_DEVICE_MUTATION,
          variables: { id: '1' }
        });

        if (role === 'admin') {
          expect(response.errors).toBeUndefined();
          expect(response.data.deleteDevice).toBe(true);
        } else {
          expect(response.errors).toBeDefined();
          expect(response.errors[0].message).toContain('Insufficient permissions');
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle unauthenticated requests gracefully', async () => {
      const { query: unauthQuery } = createTestServer();

      const PROTECTED_QUERY = gql`
        query {
          me {
            id
          }
        }
      `;

      const response = await unauthQuery({ query: PROTECTED_QUERY });
      
      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Authentication required');
    });

    it('should handle invalid GraphQL syntax', async () => {
      const INVALID_QUERY = `
        query {
          invalidField {
            nonExistentProperty
          }
        }
      `;

      try {
        await query({ query: INVALID_QUERY });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});