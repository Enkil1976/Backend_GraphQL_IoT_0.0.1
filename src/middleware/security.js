const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const Joi = require('joi');

/**
 * Security Middleware Collection
 * Centralized security functions for the GraphQL API
 */

// Strong password validation regex
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

/**
 * Validate strong password requirements
 */
const validateStrongPassword = (password) => {
  if (!password || !STRONG_PASSWORD_REGEX.test(password)) {
    throw new Error('Password must be at least 12 characters with uppercase, lowercase, number and special character');
  }
  return true;
};

/**
 * Input validation schemas using Joi
 */
const validationSchemas = {
  userRegistration: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().pattern(STRONG_PASSWORD_REGEX).required(),
    firstName: Joi.string().max(50).optional(),
    lastName: Joi.string().max(50).optional(),
    timezone: Joi.string().max(50).optional(),
    language: Joi.string().max(10).optional()
  }),

  userUpdate: Joi.object({
    firstName: Joi.string().max(50).optional(),
    lastName: Joi.string().max(50).optional(),
    email: Joi.string().email().optional(),
    timezone: Joi.string().max(50).optional(),
    language: Joi.string().max(10).optional(),
    notifications: Joi.object().optional()
  }),

  passwordChange: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().pattern(STRONG_PASSWORD_REGEX).required()
  }),

  deviceInput: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    type: Joi.string().valid(
      'LIGHTS', 'WATER_PUMP', 'VENTILATOR', 'HEATER', 'COOLER',
      'VALVE', 'MOTOR', 'SENSOR', 'DIMMER', 'SWITCH'
    ).required(),
    description: Joi.string().max(500).optional(),
    location: Joi.string().max(100).optional(),
    configuration: Joi.object().optional()
  })
};

/**
 * Validate input against schema
 */
const validateInput = (input, schemaName) => {
  const schema = validationSchemas[schemaName];
  if (!schema) {
    throw new Error(`Validation schema '${schemaName}' not found`);
  }

  const { error, value } = schema.validate(input, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    throw new Error(`Validation error: ${errorMessages.join(', ')}`);
  }

  return value;
};

/**
 * Sanitize string input to prevent XSS
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;

  return str
    .replace(/[<>\"']/g, '') // Remove potentially dangerous characters
    .trim()
    .substring(0, 1000); // Limit length
};

/**
 * Recursively sanitize object properties
 */
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return sanitizeString(input);
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  }

  if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      // Sanitize key names too
      const cleanKey = sanitizeString(key);
      sanitized[cleanKey] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
};

/**
 * Enhanced JWT verification with additional security checks
 */
const verifyTokenSecure = (token, secret) => {
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'], // Explicitly specify algorithm
      maxAge: '1h', // Maximum token age
      clockTolerance: 10 // Allow 10 seconds clock drift
    });

    // Additional security checks
    if (!decoded.userId || !decoded.username) {
      throw new Error('Invalid token payload');
    }

    // Check if token is too old (additional to maxAge)
    const tokenAge = Date.now() - (decoded.iat * 1000);
    if (tokenAge > 60 * 60 * 1000) { // 1 hour
      throw new Error('Token expired');
    }

    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Rate limiting configurations
 */
const createRateLimiter = (redisClient) => {
  // General API rate limiter
  const generalLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'api_general',
    points: 100, // Number of requests
    duration: 900, // Per 15 minutes
    blockDuration: 900 // Block for 15 minutes if exceeded
  });

  // Authentication rate limiter (stricter)
  const authLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'api_auth',
    points: 5, // Number of auth attempts
    duration: 900, // Per 15 minutes
    blockDuration: 3600 // Block for 1 hour if exceeded
  });

  // User-specific rate limiter
  const userLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'api_user',
    points: 1000, // Number of requests per user
    duration: 3600, // Per hour
    blockDuration: 3600
  });

  return { generalLimiter, authLimiter, userLimiter };
};

/**
 * Express rate limiting middleware
 */
const expressRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Security headers configuration for Helmet
 */
const securityHeaders = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      scriptSrc: process.env.NODE_ENV === 'development'
        ? ['\'self\'', '\'unsafe-inline\'', 'cdn.jsdelivr.net']
        : ['\'self\''],
      scriptSrcAttr: process.env.NODE_ENV === 'development'
        ? ['\'unsafe-inline\'']
        : ['\'none\''],
      styleSrc: ['\'self\'', '\'unsafe-inline\'', 'cdn.jsdelivr.net'],
      imgSrc: ['\'self\'', 'data:', 'https:', 'cdn.jsdelivr.net'],
      connectSrc: ['\'self\'', 'wss:', 'ws:'],
      fontSrc: ['\'self\'', 'cdn.jsdelivr.net'],
      objectSrc: ['\'none\''],
      mediaSrc: ['\'self\''],
      frameSrc: ['\'none\'']
    }
  },
  crossOriginEmbedderPolicy: false, // Disable if causing issues with GraphQL Playground
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  permittedCrossDomainPolicies: false
};

/**
 * Secure error formatter for GraphQL
 */
const formatErrorSecure = (err) => {
  // Log full error details for debugging
  console.error('GraphQL Error:', {
    message: err.message,
    path: err.path,
    locations: err.locations,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });

  // In production, sanitize error messages
  if (process.env.NODE_ENV === 'production') {
    // Handle authentication/authorization errors
    if (err.message.includes('authentication') ||
        err.message.includes('authorization') ||
        err.message.includes('Forbidden') ||
        err.message.includes('Unauthorized')) {
      return new Error('Authentication required');
    }

    // Handle validation errors (keep these as they're user-actionable)
    if (err.message.includes('Validation error') ||
        err.message.includes('Invalid input')) {
      return {
        message: err.message,
        code: 'VALIDATION_ERROR'
      };
    }

    // Hide internal errors
    if (err.extensions?.code === 'INTERNAL_ERROR' ||
        err.message.includes('database') ||
        err.message.includes('SQL') ||
        err.message.includes('Redis')) {
      return new Error('Internal server error');
    }
  }

  // Return sanitized error
  return {
    message: err.message,
    code: err.extensions?.code,
    path: err.path
  };
};

/**
 * Security configuration for JWT tokens
 */
const jwtConfig = {
  access: {
    expiresIn: '15m',
    algorithm: 'HS256'
  },
  refresh: {
    expiresIn: '7d',
    algorithm: 'HS512'
  }
};

/**
 * IP-based security checks
 */
const isPrivateIP = (ip) => {
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/
  ];
  return privateRanges.some(range => range.test(ip));
};

/**
 * Advanced input sanitization with DOMPurify-like functionality
 */
const advancedSanitize = (input) => {
  if (typeof input === 'string') {
    return input
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Remove iframe tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/[<>"'`]/g, '') // Remove dangerous characters
      .trim()
      .substring(0, 1000);
  }
  return input;
};

/**
 * Security audit logger
 */
const auditLog = {
  log: (action, details, user = null, ip = null, risk = 'low') => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      details,
      user: user ? { id: user.id, username: user.username } : null,
      ip,
      risk,
      userAgent: details.userAgent || null
    };

    // Log to console (in production, this should go to a proper logging service)
    console.log(`🔒 AUDIT [${risk.toUpperCase()}]: ${action}`, logEntry);

    // Store in database for security monitoring
    // TODO: Implement audit log storage in database
    return logEntry;
  },

  loginAttempt: (username, success, ip, userAgent) => {
    return auditLog.log(
      success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
      { username, userAgent },
      null,
      ip,
      success ? 'low' : 'medium'
    );
  },

  deviceControl: (action, deviceId, user, ip) => {
    return auditLog.log(
      'DEVICE_CONTROL',
      { action, deviceId },
      user,
      ip,
      'medium'
    );
  },

  ruleModification: (action, ruleId, user, ip) => {
    return auditLog.log(
      'RULE_MODIFICATION',
      { action, ruleId },
      user,
      ip,
      'high'
    );
  },

  suspiciousActivity: (activity, details, user, ip) => {
    return auditLog.log(
      'SUSPICIOUS_ACTIVITY',
      { activity, ...details },
      user,
      ip,
      'high'
    );
  }
};

/**
 * Content Security Policy for different environments
 */
const getCSPDirectives = () => {
  const base = {
    defaultSrc: ['\'self\''],
    scriptSrc: ['\'self\''],
    styleSrc: ['\'self\'', '\'unsafe-inline\''],
    imgSrc: ['\'self\'', 'data:', 'https:'],
    connectSrc: ['\'self\''],
    fontSrc: ['\'self\''],
    objectSrc: ['\'none\''],
    mediaSrc: ['\'self\''],
    frameSrc: ['\'none\''],
    baseUri: ['\'self\''],
    formAction: ['\'self\'']
  };

  if (process.env.NODE_ENV === 'development') {
    base.scriptSrc.push('\'unsafe-inline\'', 'cdn.jsdelivr.net');
    base.connectSrc.push('wss:', 'ws:', 'http://localhost:*', 'https://studio.apollographql.com');
  }

  return base;
};

module.exports = {
  validateStrongPassword,
  validateInput,
  sanitizeInput,
  advancedSanitize,
  verifyTokenSecure,
  createRateLimiter,
  expressRateLimit,
  securityHeaders,
  formatErrorSecure,
  jwtConfig,
  validationSchemas,
  STRONG_PASSWORD_REGEX,
  isPrivateIP,
  auditLog,
  getCSPDirectives
};
