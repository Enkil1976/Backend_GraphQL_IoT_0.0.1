const bcrypt = require('bcryptjs');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { cache } = require('../config/redis');
const auditLogService = require('./auditLogService');
const twoFactorAuthService = require('./twoFactorAuthService');
const { validateInput, advancedSanitize } = require('../middleware/security');
const crypto = require('crypto');

/**
 * Enhanced Authentication Service with Advanced Security
 * Provides comprehensive authentication with 2FA, audit logging, and security features
 */
class EnhancedAuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m'; // Shorter for security
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
    this.maxLoginAttempts = 5;
    this.lockoutDuration = 15 * 60 * 1000; // 15 minutes
    this.sessionTimeout = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Enhanced user registration with security validation
   */
  async register(userData, clientIP = null, userAgent = null) {
    try {
      // Validate and sanitize input
      const validatedData = validateInput(userData, 'userRegistration');
      const { username, email, password, role = 'viewer' } = validatedData;
      
      // Sanitize string inputs
      const sanitizedUsername = advancedSanitize(username);
      const sanitizedEmail = advancedSanitize(email);
      
      // Check if user already exists
      const existingUser = await query(
        'SELECT id, username, email FROM users WHERE username = $1 OR email = $2',
        [sanitizedUsername, sanitizedEmail]
      );
      
      if (existingUser.rows.length > 0) {
        // Log registration attempt with existing credentials
        await auditLogService.logSecurityViolation(
          'REGISTRATION_DUPLICATE',
          { 
            attempted_username: sanitizedUsername,
            attempted_email: sanitizedEmail,
            existing_user: existingUser.rows[0].username
          },
          null,
          clientIP
        );
        throw new Error('Username or email already exists');
      }

      // Enhanced password hashing with Argon2
      const hashedPassword = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16, // 64 MB
        timeCost: 3,
        parallelism: 1,
      });

      // Create user with security fields
      const result = await query(
        `INSERT INTO users (
          username, email, password_hash, role, created_at, 
          last_login_ip, failed_login_attempts, account_locked_until,
          two_factor_enabled, password_changed_at
        ) 
        VALUES ($1, $2, $3, $4, NOW(), $5, 0, NULL, false, NOW()) 
        RETURNING id, username, email, role, created_at`,
        [sanitizedUsername, sanitizedEmail, hashedPassword, role, clientIP]
      );

      const user = result.rows[0];
      
      // Log successful registration
      await auditLogService.logUserManagement(
        'USER_REGISTERED',
        user.id,
        user,
        null, // No admin user for self-registration
        clientIP,
        { new: { username: user.username, email: user.email, role: user.role } }
      );

      // Generate tokens
      const tokens = await this.generateTokens(user, clientIP);

      return {
        user: this.sanitizeUser(user),
        ...tokens
      };
    } catch (error) {
      // Log registration failure
      await auditLogService.logSecurityViolation(
        'REGISTRATION_FAILED',
        { error: error.message },
        null,
        clientIP
      );
      throw error;
    }
  }

  /**
   * Enhanced login with 2FA and security checks
   */
  async login(username, password, clientIP = null, userAgent = null, twoFactorToken = null) {
    try {
      // Sanitize input
      const sanitizedUsername = advancedSanitize(username);
      
      // Find user by username or email
      const result = await query(
        `SELECT id, username, email, password_hash, role, is_active, 
         two_factor_enabled, two_factor_secret, failed_login_attempts, 
         account_locked_until, last_login, password_changed_at
         FROM users WHERE username = $1 OR email = $1`,
        [sanitizedUsername]
      );

      if (result.rows.length === 0) {
        // Log failed login attempt
        await auditLogService.logAuthentication(
          sanitizedUsername,
          false,
          clientIP,
          userAgent
        );
        throw new Error('Invalid credentials');
      }

      const user = result.rows[0];

      // Check account lock status
      const lockStatus = await this.checkAccountLock(user.id);
      if (lockStatus.locked) {
        await auditLogService.logSecurityViolation(
          'LOGIN_BLOCKED_LOCKED',
          { 
            username: user.username,
            locked_until: lockStatus.lockedUntil,
            attempts: lockStatus.attempts
          },
          { id: user.id, username: user.username },
          clientIP
        );
        throw new Error('Account is temporarily locked due to failed login attempts');
      }

      // Check if user is active
      if (!user.is_active) {
        await auditLogService.logSecurityViolation(
          'LOGIN_INACTIVE_ACCOUNT',
          { username: user.username },
          { id: user.id, username: user.username },
          clientIP
        );
        throw new Error('Account is disabled');
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        // Handle failed login
        await this.handleFailedLogin(user.id, clientIP);
        
        await auditLogService.logAuthentication(
          user.username,
          false,
          clientIP,
          userAgent
        );
        throw new Error('Invalid credentials');
      }

      // Handle 2FA if enabled
      if (user.two_factor_enabled) {
        if (!twoFactorToken) {
          return {
            requiresTwoFactor: true,
            tempToken: this.generateTempToken(user.id)
          };
        }

        const isValid2FA = twoFactorAuthService.verifyToken(
          twoFactorToken,
          user.two_factor_secret
        );

        if (!isValid2FA) {
          await auditLogService.logSecurityViolation(
            'INVALID_2FA_TOKEN',
            { username: user.username },
            { id: user.id, username: user.username },
            clientIP
          );
          throw new Error('Invalid two-factor authentication code');
        }
      }

      // Clear failed attempts on successful login
      await this.clearFailedAttempts(user.id, clientIP);

      // Log successful login
      await auditLogService.logAuthentication(
        user.username,
        true,
        clientIP,
        userAgent,
        user.two_factor_enabled ? '2fa' : 'password'
      );

      // Generate tokens
      const tokens = await this.generateTokens(user, clientIP);

      return {
        user: this.sanitizeUser(user),
        ...tokens
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify password with fallback to bcrypt for legacy passwords
   */
  async verifyPassword(password, hash) {
    try {
      // Try Argon2 first (new hashes)
      return await argon2.verify(hash, password);
    } catch (error) {
      // Fallback to bcrypt for legacy passwords
      try {
        return await bcrypt.compare(password, hash);
      } catch (bcryptError) {
        return false;
      }
    }
  }

  /**
   * Check if account is locked
   */
  async checkAccountLock(userId) {
    const result = await query(
      'SELECT failed_login_attempts, account_locked_until FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) return { locked: false };
    
    const user = result.rows[0];
    const now = new Date();
    
    if (user.account_locked_until && new Date(user.account_locked_until) > now) {
      return { 
        locked: true, 
        lockedUntil: user.account_locked_until,
        attempts: user.failed_login_attempts
      };
    }
    
    return { locked: false, attempts: user.failed_login_attempts || 0 };
  }

  /**
   * Handle failed login attempt
   */
  async handleFailedLogin(userId, clientIP) {
    const result = await query(
      'SELECT failed_login_attempts FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) return;
    
    const attempts = (result.rows[0].failed_login_attempts || 0) + 1;
    let lockUntil = null;
    
    if (attempts >= this.maxLoginAttempts) {
      lockUntil = new Date(Date.now() + this.lockoutDuration);
    }
    
    await query(
      'UPDATE users SET failed_login_attempts = $1, account_locked_until = $2 WHERE id = $3',
      [attempts, lockUntil, userId]
    );
    
    // Log the lockout
    if (lockUntil) {
      await auditLogService.logSecurityViolation(
        'ACCOUNT_LOCKED',
        { 
          user_id: userId,
          attempts: attempts,
          locked_until: lockUntil
        },
        null,
        clientIP
      );
    }
  }

  /**
   * Clear failed login attempts
   */
  async clearFailedAttempts(userId, clientIP) {
    await query(
      'UPDATE users SET failed_login_attempts = 0, account_locked_until = NULL, last_login = NOW(), last_login_ip = $1 WHERE id = $2',
      [clientIP, userId]
    );
  }

  /**
   * Generate secure tokens with metadata
   */
  async generateTokens(user, clientIP = null) {
    const sessionId = crypto.randomUUID();
    
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      sessionId,
      iat: Math.floor(Date.now() / 1000)
    };

    // Generate JWT token
    const token = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
      algorithm: 'HS256'
    });

    // Generate refresh token with different payload
    const refreshPayload = {
      id: user.id,
      sessionId,
      type: 'refresh'
    };

    const refreshToken = jwt.sign(refreshPayload, this.jwtSecret, {
      expiresIn: this.refreshTokenExpiresIn,
      algorithm: 'HS256'
    });

    // Store session data in Redis
    await this.storeSession(user.id, sessionId, {
      token,
      refreshToken,
      user: this.sanitizeUser(user),
      clientIP,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    });

    return {
      token,
      refreshToken,
      expiresIn: this.getExpirationSeconds(this.jwtExpiresIn),
      sessionId
    };
  }

  /**
   * Store session with enhanced security
   */
  async storeSession(userId, sessionId, sessionData) {
    try {
      const sessionKey = `session:${userId}:${sessionId}`;
      const refreshKey = `refresh_token:${userId}:${sessionId}`;
      
      const expiration = this.getExpirationSeconds(this.refreshTokenExpiresIn);
      
      await cache.setex(sessionKey, expiration, JSON.stringify(sessionData));
      await cache.setex(refreshKey, expiration, sessionData.refreshToken);
      
      // Track active sessions for the user
      const userSessionsKey = `user_sessions:${userId}`;
      await cache.sadd(userSessionsKey, sessionId);
      await cache.expire(userSessionsKey, expiration);
      
    } catch (error) {
      console.error('Error storing session:', error);
      throw new Error('Failed to create session');
    }
  }

  /**
   * Generate temporary token for 2FA
   */
  generateTempToken(userId) {
    return jwt.sign(
      { 
        userId, 
        type: '2fa_temp',
        exp: Math.floor(Date.now() / 1000) + (5 * 60) // 5 minutes
      },
      this.jwtSecret
    );
  }

  /**
   * Verify token with enhanced checks
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256']
      });

      // Check if session exists
      if (decoded.sessionId) {
        const sessionKey = `session:${decoded.id}:${decoded.sessionId}`;
        const sessionData = await cache.get(sessionKey);
        
        if (!sessionData) {
          throw new Error('Session expired');
        }

        // Update last activity
        const session = JSON.parse(sessionData);
        session.lastActivity = new Date().toISOString();
        await cache.setex(sessionKey, this.getExpirationSeconds(this.refreshTokenExpiresIn), JSON.stringify(session));
      }

      return {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role,
        sessionId: decoded.sessionId
      };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Logout with session cleanup
   */
  async logout(userId, sessionId) {
    try {
      const sessionKey = `session:${userId}:${sessionId}`;
      const refreshKey = `refresh_token:${userId}:${sessionId}`;
      const userSessionsKey = `user_sessions:${userId}`;

      // Remove session data
      await cache.del(sessionKey);
      await cache.del(refreshKey);
      await cache.srem(userSessionsKey, sessionId);

      // Log logout
      await auditLogService.logSystemEvent(
        'USER_LOGOUT',
        { sessionId },
        { id: userId },
        null
      );

      return true;
    } catch (error) {
      console.error('Error during logout:', error);
      return false;
    }
  }

  /**
   * Logout all sessions for a user
   */
  async logoutAllSessions(userId) {
    try {
      const userSessionsKey = `user_sessions:${userId}`;
      const sessionIds = await cache.smembers(userSessionsKey);

      for (const sessionId of sessionIds) {
        await this.logout(userId, sessionId);
      }

      await auditLogService.logSystemEvent(
        'USER_LOGOUT_ALL',
        { sessions_terminated: sessionIds.length },
        { id: userId },
        null
      );

      return sessionIds.length;
    } catch (error) {
      console.error('Error logging out all sessions:', error);
      return 0;
    }
  }

  /**
   * Get active sessions for user
   */
  async getActiveSessions(userId) {
    try {
      const userSessionsKey = `user_sessions:${userId}`;
      const sessionIds = await cache.smembers(userSessionsKey);
      
      const sessions = [];
      for (const sessionId of sessionIds) {
        const sessionKey = `session:${userId}:${sessionId}`;
        const sessionData = await cache.get(sessionKey);
        
        if (sessionData) {
          const session = JSON.parse(sessionData);
          sessions.push({
            sessionId,
            clientIP: session.clientIP,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity
          });
        }
      }
      
      return sessions;
    } catch (error) {
      console.error('Error getting active sessions:', error);
      return [];
    }
  }

  /**
   * Sanitize user data for client response
   */
  sanitizeUser(user) {
    const sanitized = { ...user };
    delete sanitized.password_hash;
    delete sanitized.two_factor_secret;
    delete sanitized.failed_login_attempts;
    delete sanitized.account_locked_until;
    return sanitized;
  }

  /**
   * Convert time string to seconds
   */
  getExpirationSeconds(timeString) {
    const timeValue = parseInt(timeString);
    const timeUnit = timeString.slice(-1);
    
    switch (timeUnit) {
      case 's': return timeValue;
      case 'm': return timeValue * 60;
      case 'h': return timeValue * 60 * 60;
      case 'd': return timeValue * 24 * 60 * 60;
      default: return 3600; // 1 hour default
    }
  }

  /**
   * Password strength validation
   */
  validatePasswordStrength(password) {
    const minLength = 12;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?\":{}|<>]/.test(password);
    
    const issues = [];
    
    if (password.length < minLength) {
      issues.push(`Password must be at least ${minLength} characters long`);
    }
    if (!hasUpperCase) {
      issues.push('Password must contain at least one uppercase letter');
    }
    if (!hasLowerCase) {
      issues.push('Password must contain at least one lowercase letter');
    }
    if (!hasNumbers) {
      issues.push('Password must contain at least one number');
    }
    if (!hasSpecialChar) {
      issues.push('Password must contain at least one special character');
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}

module.exports = new EnhancedAuthService();