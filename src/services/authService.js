const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { cache } = require('../config/redis');

/**
 * Authentication Service
 * Handles user registration, login, JWT token management, and role validation
 */
class AuthService {
  constructor() {
    // Security: No fallback JWT secret - fail fast if not provided
    this.jwtSecret = process.env.JWT_SECRET;
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required for security');
    }
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '4h'; // Increased for dashboard usage
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';
    this.saltRounds = 12;
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Object} User data with tokens
   */
  async register(userData) {
    const { username, email, password, role = 'viewer' } = userData;

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('Username or email already exists');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.saltRounds);

    // Create user
    const result = await query(
      `INSERT INTO users (username, email, password_hash, role, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) 
       RETURNING id, username, email, role, created_at`,
      [username, email, hashedPassword, role]
    );

    const user = result.rows[0];
    const tokens = await this.generateTokens(user);

    return {
      user,
      ...tokens
    };
  }

  /**
   * User login
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Object} User data with tokens
   */
  async login(username, password) {
    // Get user from database
    const result = await query(
      'SELECT id, username, email, password_hash, role, created_at FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Remove password hash from user object
    delete user.password_hash;

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      user,
      ...tokens
    };
  }

  /**
   * Generate JWT and refresh tokens
   * @param {Object} user - User data
   * @returns {Object} Tokens and expiration info
   */
  async generateTokens(user) {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    // Generate JWT token with explicit algorithm
    const token = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
      algorithm: 'HS256'
    });

    // Generate refresh token with explicit algorithm
    const refreshToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.refreshTokenExpiresIn,
      algorithm: 'HS256'
    });

    // Store refresh token in Redis
    const refreshTokenKey = `refresh_token:${user.id}`;
    await cache.set(refreshTokenKey, refreshToken, this.getExpirationSeconds(this.refreshTokenExpiresIn));

    // Store user session in Redis
    const sessionKey = `session:${user.id}`;
    await cache.set(sessionKey, user, this.getExpirationSeconds(this.jwtExpiresIn));

    return {
      token,
      refreshToken,
      expiresIn: this.getExpirationSeconds(this.jwtExpiresIn)
    };
  }

  /**
   * Refresh JWT token
   * @param {string} refreshToken - Refresh token
   * @returns {Object} New tokens
   */
  async refreshToken(refreshToken) {
    try {
      // Verify refresh token with explicit algorithm
      const decoded = jwt.verify(refreshToken, this.jwtSecret, {
        algorithms: ['HS256']
      });

      // Check if refresh token exists in Redis
      const refreshTokenKey = `refresh_token:${decoded.id}`;
      const storedRefreshToken = await cache.get(refreshTokenKey);

      if (!storedRefreshToken || storedRefreshToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      // Get updated user data from database
      const result = await query(
        'SELECT id, username, email, role, created_at FROM users WHERE id = $1',
        [decoded.id]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = result.rows[0];
      const tokens = await this.generateTokens(user);

      return {
        user,
        ...tokens
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Logout user
   * @param {string} userId - User ID
   */
  async logout(userId) {
    // Remove refresh token from Redis
    const refreshTokenKey = `refresh_token:${userId}`;
    await cache.del(refreshTokenKey);

    // Remove user session from Redis
    const sessionKey = `session:${userId}`;
    await cache.del(sessionKey);

    return true;
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} User data
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256']
      });

      // Get user from database to ensure role is up to date
      const result = await query(
        'SELECT id, username, email, role, created_at FROM users WHERE id = $1',
        [decoded.id]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return result.rows[0];
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Object} User data
   */
  async getUserById(userId) {
    const result = await query(
      'SELECT id, username, email, role, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0];
  }

  /**
   * Check if user has required role
   * @param {string} userRole - User's role
   * @param {string} requiredRole - Required role
   * @returns {boolean} Has permission
   */
  hasRole(userRole, requiredRole) {
    const roles = ['viewer', 'operator', 'editor', 'admin'];
    const userRoleIndex = roles.indexOf(userRole.toLowerCase());
    const requiredRoleIndex = roles.indexOf(requiredRole.toLowerCase());

    return userRoleIndex >= requiredRoleIndex;
  }

  /**
   * Convert time string to seconds
   * @param {string} timeString - Time string (e.g., '1h', '30m', '7d')
   * @returns {number} Seconds
   */
  getExpirationSeconds(timeString) {
    const match = timeString.match(/^(\d+)([smhd])$/);
    if (!match) return 3600; // Default 1 hour

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return 3600;
    }
  }
}

module.exports = new AuthService();
