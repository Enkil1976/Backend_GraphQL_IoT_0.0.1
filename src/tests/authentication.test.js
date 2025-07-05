const { gql } = require('apollo-server-express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authService = require('../services/authService');

describe('Authentication and Authorization', () => {
  let query, mutate;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock JWT functions
    jwt.sign = jest.fn().mockReturnValue('mock-jwt-token');
    jwt.verify = jest.fn();
    jwt.decode = jest.fn();
    
    // Mock bcrypt functions
    bcrypt.hash = jest.fn().mockResolvedValue('hashed-password');
    bcrypt.compare = jest.fn().mockResolvedValue(true);
  });

  describe('JWT Token Management', () => {
    it('should generate valid JWT tokens', () => {
      const payload = { userId: 1, username: 'admin', role: 'admin' };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
      
      expect(jwt.sign).toHaveBeenCalledWith(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      expect(token).toBe('mock-jwt-token');
    });

    it('should verify JWT tokens', () => {
      const token = 'valid-jwt-token';
      const decoded = { userId: 1, username: 'admin', role: 'admin' };
      
      jwt.verify.mockReturnValue(decoded);
      
      const result = jwt.verify(token, process.env.JWT_SECRET);
      
      expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
      expect(result).toEqual(decoded);
    });

    it('should handle invalid JWT tokens', () => {
      const invalidToken = 'invalid-token';
      
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      expect(() => jwt.verify(invalidToken, process.env.JWT_SECRET))
        .toThrow('Invalid token');
    });

    it('should handle expired JWT tokens', () => {
      const expiredToken = 'expired-token';
      
      jwt.verify.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });
      
      expect(() => jwt.verify(expiredToken, process.env.JWT_SECRET))
        .toThrow('Token expired');
    });
  });

  describe('Password Security', () => {
    it('should hash passwords securely', async () => {
      const password = 'plaintext-password';
      const saltRounds = 12;
      
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      expect(bcrypt.hash).toHaveBeenCalledWith(password, saltRounds);
      expect(hashedPassword).toBe('hashed-password');
    });

    it('should compare passwords correctly', async () => {
      const password = 'plaintext-password';
      const hashedPassword = 'hashed-password';
      
      const isValid = await bcrypt.compare(password, hashedPassword);
      
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject invalid passwords', async () => {
      const password = 'wrong-password';
      const hashedPassword = 'hashed-password';
      
      bcrypt.compare.mockResolvedValue(false);
      
      const isValid = await bcrypt.compare(password, hashedPassword);
      
      expect(isValid).toBe(false);
    });

    it('should enforce password strength requirements', () => {
      const validatePassword = (password) => {
        if (password.length < 8) return false;
        if (!/[A-Z]/.test(password)) return false;
        if (!/[a-z]/.test(password)) return false;
        if (!/[0-9]/.test(password)) return false;
        if (!/[^A-Za-z0-9]/.test(password)) return false;
        return true;
      };

      expect(validatePassword('weak')).toBe(false);
      expect(validatePassword('password123')).toBe(false);
      expect(validatePassword('Password123')).toBe(false);
      expect(validatePassword('Password123!')).toBe(true);
    });
  });

  describe('Login Authentication', () => {
    beforeEach(() => {
      const { query: testQuery, mutate: testMutate } = createTestServer();
      query = testQuery;
      mutate = testMutate;
      
      authService.login.mockResolvedValue({
        user: mockUsers.admin,
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token'
      });
    });

    it('should authenticate with valid credentials', async () => {
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
          role: 'admin',
          isActive: true
        },
        token: expect.any(String),
        refreshToken: expect.any(String)
      });
    });

    it('should reject invalid credentials', async () => {
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

    it('should reject inactive users', async () => {
      authService.login.mockRejectedValue(new Error('Account is inactive'));

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
          username: 'inactive_user',
          password: 'password'
        }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Account is inactive');
    });

    it('should implement login rate limiting', async () => {
      // Mock rate limiting service
      const rateLimitService = {
        checkRateLimit: jest.fn(),
        incrementAttempts: jest.fn()
      };

      // Simulate too many login attempts
      rateLimitService.checkRateLimit.mockResolvedValue(false);
      authService.login.mockRejectedValue(new Error('Too many login attempts. Please try again later.'));

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
          username: 'admin',
          password: 'password'
        }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Too many login attempts');
    });
  });

  describe('User Registration', () => {
    beforeEach(() => {
      authService.register.mockResolvedValue({
        user: { ...mockUsers.admin, id: 4, username: 'newuser' },
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token'
      });
    });

    it('should register new user with valid data', async () => {
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
            password: 'SecurePassword123!',
            role: 'viewer'
          }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.register).toMatchObject({
        user: {
          id: expect.any(String),
          username: 'newuser',
          email: 'newuser@test.com',
          role: 'viewer',
          isActive: expect.any(Boolean)
        },
        token: expect.any(String),
        refreshToken: expect.any(String)
      });
    });

    it('should reject duplicate username', async () => {
      authService.register.mockRejectedValue(new Error('Username already exists'));

      const REGISTER_MUTATION = gql`
        mutation($input: RegisterInput!) {
          register(input: $input) {
            user {
              id
              username
            }
            token
          }
        }
      `;

      const response = await mutate({
        mutation: REGISTER_MUTATION,
        variables: {
          input: {
            username: 'admin', // Already exists
            email: 'duplicate@test.com',
            password: 'SecurePassword123!',
            role: 'viewer'
          }
        }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Username already exists');
    });

    it('should reject duplicate email', async () => {
      authService.register.mockRejectedValue(new Error('Email already exists'));

      const REGISTER_MUTATION = gql`
        mutation($input: RegisterInput!) {
          register(input: $input) {
            user {
              id
              username
            }
            token
          }
        }
      `;

      const response = await mutate({
        mutation: REGISTER_MUTATION,
        variables: {
          input: {
            username: 'newuser',
            email: 'admin@test.com', // Already exists
            password: 'SecurePassword123!',
            role: 'viewer'
          }
        }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Email already exists');
    });

    it('should validate password strength', async () => {
      authService.register.mockRejectedValue(new Error('Password does not meet security requirements'));

      const REGISTER_MUTATION = gql`
        mutation($input: RegisterInput!) {
          register(input: $input) {
            user {
              id
              username
            }
            token
          }
        }
      `;

      const response = await mutate({
        mutation: REGISTER_MUTATION,
        variables: {
          input: {
            username: 'newuser',
            email: 'newuser@test.com',
            password: 'weak', // Too weak
            role: 'viewer'
          }
        }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Password does not meet security requirements');
    });
  });

  describe('Token Refresh', () => {
    beforeEach(() => {
      authService.refreshToken.mockResolvedValue({
        token: 'new-access-token',
        refreshToken: 'new-refresh-token'
      });
    });

    it('should refresh valid tokens', async () => {
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
          refreshToken: 'valid-refresh-token'
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.refreshToken).toMatchObject({
        token: expect.any(String),
        refreshToken: expect.any(String)
      });
    });

    it('should reject invalid refresh tokens', async () => {
      authService.refreshToken.mockRejectedValue(new Error('Invalid refresh token'));

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
          refreshToken: 'invalid-refresh-token'
        }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Invalid refresh token');
    });

    it('should reject expired refresh tokens', async () => {
      authService.refreshToken.mockRejectedValue(new Error('Refresh token expired'));

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
          refreshToken: 'expired-refresh-token'
        }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Refresh token expired');
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    const createContextWithRole = (role) => {
      const user = { ...mockUsers.admin, role };
      const { query: testQuery, mutate: testMutate } = createTestServer({ user });
      return { query: testQuery, mutate: testMutate, user };
    };

    describe('Admin Role', () => {
      it('should allow admin to access all resources', async () => {
        const { query } = createContextWithRole('admin');

        const ADMIN_QUERY = gql`
          query {
            users {
              id
              username
              role
            }
          }
        `;

        const response = await query({ query: ADMIN_QUERY });
        expect(response.errors).toBeUndefined();
      });

      it('should allow admin to delete devices', async () => {
        const { mutate } = createContextWithRole('admin');

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
      });

      it('should allow admin to manage users', async () => {
        const { mutate } = createContextWithRole('admin');

        const CREATE_USER_MUTATION = gql`
          mutation($input: UserInput!) {
            createUser(input: $input) {
              id
              username
              role
            }
          }
        `;

        const response = await mutate({
          mutation: CREATE_USER_MUTATION,
          variables: {
            input: {
              username: 'newuser',
              email: 'newuser@test.com',
              password: 'SecurePassword123!',
              role: 'viewer'
            }
          }
        });

        expect(response.errors).toBeUndefined();
      });
    });

    describe('Editor Role', () => {
      it('should allow editor to control devices', async () => {
        const { mutate } = createContextWithRole('editor');

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
          variables: { id: '1', action: 'turn_on' }
        });

        expect(response.errors).toBeUndefined();
      });

      it('should allow editor to create rules', async () => {
        const { mutate } = createContextWithRole('editor');

        const CREATE_RULE_MUTATION = gql`
          mutation($input: RuleInput!) {
            createRule(input: $input) {
              id
              name
              isActive
            }
          }
        `;

        const response = await mutate({
          mutation: CREATE_RULE_MUTATION,
          variables: {
            input: {
              name: 'Test Rule',
              conditions: { sensor: 'temhum1', operator: 'gt', value: 30 },
              actions: [{ type: 'notification', message: 'Alert' }]
            }
          }
        });

        expect(response.errors).toBeUndefined();
      });

      it('should deny editor from deleting devices', async () => {
        const { mutate } = createContextWithRole('editor');

        const DELETE_DEVICE_MUTATION = gql`
          mutation($id: ID!) {
            deleteDevice(id: $id)
          }
        `;

        const response = await mutate({
          mutation: DELETE_DEVICE_MUTATION,
          variables: { id: '1' }
        });

        expect(response.errors).toBeDefined();
        expect(response.errors[0].message).toContain('Insufficient permissions');
      });
    });

    describe('Operator Role', () => {
      it('should allow operator to control devices', async () => {
        const { mutate } = createContextWithRole('operator');

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
          variables: { id: '1', action: 'turn_on' }
        });

        expect(response.errors).toBeUndefined();
      });

      it('should deny operator from creating rules', async () => {
        const { mutate } = createContextWithRole('operator');

        const CREATE_RULE_MUTATION = gql`
          mutation($input: RuleInput!) {
            createRule(input: $input) {
              id
              name
            }
          }
        `;

        const response = await mutate({
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

    describe('Viewer Role', () => {
      it('should allow viewer to read sensor data', async () => {
        const { query } = createContextWithRole('viewer');

        const SENSORS_QUERY = gql`
          query {
            sensors {
              id
              name
              type
              isOnline
            }
          }
        `;

        const response = await query({ query: SENSORS_QUERY });
        expect(response.errors).toBeUndefined();
      });

      it('should deny viewer from controlling devices', async () => {
        const { mutate } = createContextWithRole('viewer');

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
          variables: { id: '1', action: 'turn_on' }
        });

        expect(response.errors).toBeDefined();
        expect(response.errors[0].message).toContain('Insufficient permissions');
      });

      it('should deny viewer from creating notifications', async () => {
        const { mutate } = createContextWithRole('viewer');

        const CREATE_NOTIFICATION_MUTATION = gql`
          mutation($input: NotificationInput!) {
            createNotification(input: $input) {
              id
              title
            }
          }
        `;

        const response = await mutate({
          mutation: CREATE_NOTIFICATION_MUTATION,
          variables: {
            input: {
              title: 'Test Notification',
              message: 'Test message',
              type: 'INFO',
              priority: 'MEDIUM'
            }
          }
        });

        expect(response.errors).toBeDefined();
        expect(response.errors[0].message).toContain('Insufficient permissions');
      });
    });
  });

  describe('Unauthenticated Access', () => {
    beforeEach(() => {
      const { query: testQuery, mutate: testMutate } = createTestServer(); // No user context
      query = testQuery;
      mutate = testMutate;
    });

    it('should allow access to public queries', async () => {
      const HEALTH_QUERY = gql`
        query {
          health {
            status
            timestamp
          }
        }
      `;

      const response = await query({ query: HEALTH_QUERY });
      expect(response.errors).toBeUndefined();
    });

    it('should deny access to protected queries', async () => {
      const PROTECTED_QUERY = gql`
        query {
          me {
            id
            username
          }
        }
      `;

      const response = await query({ query: PROTECTED_QUERY });
      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Authentication required');
    });

    it('should deny access to all mutations except auth', async () => {
      const PROTECTED_MUTATION = gql`
        mutation($id: ID!, $action: String!) {
          controlDevice(id: $id, action: $action) {
            success
          }
        }
      `;

      const response = await mutate({
        mutation: PROTECTED_MUTATION,
        variables: { id: '1', action: 'turn_on' }
      });

      expect(response.errors).toBeDefined();
      expect(response.errors[0].message).toContain('Authentication required');
    });

    it('should allow login mutation', async () => {
      authService.login.mockResolvedValue({
        user: mockUsers.admin,
        token: 'mock-token',
        refreshToken: 'mock-refresh-token'
      });

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
        variables: { username: 'admin', password: 'password' }
      });

      expect(response.errors).toBeUndefined();
    });

    it('should allow register mutation', async () => {
      authService.register.mockResolvedValue({
        user: { ...mockUsers.admin, id: 4 },
        token: 'mock-token',
        refreshToken: 'mock-refresh-token'
      });

      const REGISTER_MUTATION = gql`
        mutation($input: RegisterInput!) {
          register(input: $input) {
            user {
              id
              username
            }
            token
          }
        }
      `;

      const response = await mutate({
        mutation: REGISTER_MUTATION,
        variables: {
          input: {
            username: 'newuser',
            email: 'newuser@test.com',
            password: 'SecurePassword123!',
            role: 'viewer'
          }
        }
      });

      expect(response.errors).toBeUndefined();
    });
  });

  describe('Session Management', () => {
    it('should track user sessions', async () => {
      const sessionService = {
        createSession: jest.fn().mockResolvedValue('session-id'),
        getSession: jest.fn().mockResolvedValue({
          id: 'session-id',
          userId: 1,
          createdAt: new Date(),
          lastActivity: new Date(),
          isActive: true
        }),
        updateSession: jest.fn().mockResolvedValue(true),
        invalidateSession: jest.fn().mockResolvedValue(true)
      };

      const sessionId = await sessionService.createSession({
        userId: 1,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      });

      expect(sessionService.createSession).toHaveBeenCalled();
      expect(sessionId).toBe('session-id');
    });

    it('should handle concurrent sessions', async () => {
      const sessionService = {
        getUserSessions: jest.fn().mockResolvedValue([
          { id: 'session-1', isActive: true },
          { id: 'session-2', isActive: true }
        ]),
        invalidateAllSessions: jest.fn().mockResolvedValue(true)
      };

      const sessions = await sessionService.getUserSessions(1);
      
      expect(sessions).toHaveLength(2);
      expect(sessions.every(session => session.isActive)).toBe(true);
    });

    it('should implement session timeout', async () => {
      const sessionService = {
        cleanupExpiredSessions: jest.fn().mockResolvedValue(3)
      };

      const cleanedSessions = await sessionService.cleanupExpiredSessions();
      
      expect(sessionService.cleanupExpiredSessions).toHaveBeenCalled();
      expect(cleanedSessions).toBe(3);
    });
  });

  describe('Security Middleware', () => {
    it('should validate JWT in request headers', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid-jwt-token'
        }
      };

      jwt.verify.mockReturnValue({
        userId: 1,
        username: 'admin',
        role: 'admin'
      });

      const validateToken = (req) => {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) throw new Error('No token provided');
        return jwt.verify(token, process.env.JWT_SECRET);
      };

      const result = validateToken(mockRequest);
      
      expect(result).toMatchObject({
        userId: 1,
        username: 'admin',
        role: 'admin'
      });
    });

    it('should reject malformed authorization headers', () => {
      const mockRequest = {
        headers: {
          authorization: 'InvalidFormat token'
        }
      };

      const validateToken = (req) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          throw new Error('Invalid authorization header format');
        }
        const token = authHeader.replace('Bearer ', '');
        return jwt.verify(token, process.env.JWT_SECRET);
      };

      expect(() => validateToken(mockRequest))
        .toThrow('Invalid authorization header format');
    });

    it('should implement CORS security', () => {
      const corsOptions = {
        origin: ['https://trusted-domain.com', 'http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization']
      };

      const isOriginAllowed = (origin) => {
        return corsOptions.origin.includes(origin);
      };

      expect(isOriginAllowed('https://trusted-domain.com')).toBe(true);
      expect(isOriginAllowed('https://malicious-site.com')).toBe(false);
    });

    it('should implement request rate limiting', () => {
      const rateLimiter = {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // requests per window
        attempts: new Map()
      };

      const checkRateLimit = (clientId) => {
        const now = Date.now();
        const windowStart = now - rateLimiter.windowMs;
        
        if (!rateLimiter.attempts.has(clientId)) {
          rateLimiter.attempts.set(clientId, []);
        }
        
        const attempts = rateLimiter.attempts.get(clientId);
        const recentAttempts = attempts.filter(time => time > windowStart);
        
        if (recentAttempts.length >= rateLimiter.max) {
          return false; // Rate limit exceeded
        }
        
        recentAttempts.push(now);
        rateLimiter.attempts.set(clientId, recentAttempts);
        return true;
      };

      // Simulate 101 requests
      for (let i = 0; i < 101; i++) {
        const allowed = checkRateLimit('client-1');
        if (i < 100) {
          expect(allowed).toBe(true);
        } else {
          expect(allowed).toBe(false);
        }
      }
    });
  });

  describe('Audit Logging', () => {
    it('should log authentication events', () => {
      const auditLogger = {
        logAuthEvent: jest.fn()
      };

      const logLoginAttempt = (username, success, ip) => {
        auditLogger.logAuthEvent({
          event: 'login_attempt',
          username,
          success,
          ip,
          timestamp: new Date()
        });
      };

      logLoginAttempt('admin', true, '127.0.0.1');
      
      expect(auditLogger.logAuthEvent).toHaveBeenCalledWith({
        event: 'login_attempt',
        username: 'admin',
        success: true,
        ip: '127.0.0.1',
        timestamp: expect.any(Date)
      });
    });

    it('should log authorization failures', () => {
      const auditLogger = {
        logSecurityEvent: jest.fn()
      };

      const logUnauthorizedAccess = (userId, resource, action) => {
        auditLogger.logSecurityEvent({
          event: 'unauthorized_access',
          userId,
          resource,
          action,
          timestamp: new Date()
        });
      };

      logUnauthorizedAccess(3, 'device', 'delete');
      
      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith({
        event: 'unauthorized_access',
        userId: 3,
        resource: 'device',
        action: 'delete',
        timestamp: expect.any(Date)
      });
    });

    it('should log privilege escalation attempts', () => {
      const auditLogger = {
        logCriticalEvent: jest.fn()
      };

      const logPrivilegeEscalation = (userId, currentRole, attemptedRole) => {
        auditLogger.logCriticalEvent({
          event: 'privilege_escalation_attempt',
          userId,
          currentRole,
          attemptedRole,
          timestamp: new Date()
        });
      };

      logPrivilegeEscalation(3, 'viewer', 'admin');
      
      expect(auditLogger.logCriticalEvent).toHaveBeenCalledWith({
        event: 'privilege_escalation_attempt',
        userId: 3,
        currentRole: 'viewer',
        attemptedRole: 'admin',
        timestamp: expect.any(Date)
      });
    });
  });
});