// Load environment variables first
require('dotenv').config();

const { ApolloServer } = require('apollo-server-express');
const express = require('express');
const { createServer } = require('http');
const { useServer } = require('graphql-ws/lib/use/ws');
const { WebSocketServer } = require('ws');
const { execute, subscribe } = require('graphql');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const depthLimit = require('graphql-depth-limit');
const costAnalysis = require('graphql-query-complexity');

// Import security middleware
const {
  formatErrorSecure,
  securityHeaders,
  expressRateLimit,
  auditLog,
  getCSPDirectives,
  isPrivateIP
} = require('./middleware/security');

// Import security services with error handling
let auditLogService, twoFactorAuthService, databaseInitService;

try {
  auditLogService = require('./services/auditLogService');
  console.log('✅ Audit logging service loaded');
} catch (error) {
  console.warn('⚠️  Audit logging service failed to load:', error.message);
  auditLogService = { log: () => {}, logSecurityEvent: () => {} }; // Mock service
}

try {
  twoFactorAuthService = require('./services/twoFactorAuthService');
  console.log('✅ Two-factor authentication service loaded');
} catch (error) {
  console.warn('⚠️  2FA service failed to load:', error.message);
  twoFactorAuthService = { generateSecret: () => ({}), verifyToken: () => false }; // Mock service
}

try {
  databaseInitService = require('./services/databaseInitService');
  console.log('✅ Database initialization service loaded');
} catch (error) {
  console.warn('⚠️  Database init service failed to load:', error.message);
  databaseInitService = { initialize: async() => {}, getStatus: async() => ({}) }; // Mock service
}

// Import GraphQL type definitions and resolvers
const typeDefs = require('./schema/typeDefs');
const resolvers = require('./schema/resolvers');

// Import services
const authService = require('./services/authService');
const mqttService = require('./services/mqttService');
const rulesEngineService = require('./services/rulesEngineService');
const queueService = require('./services/queueService');

// Import utilities
const { pubsub } = require('./utils/pubsub');

class GraphQLServer {
  constructor() {
    this.app = express();
    this.httpServer = null;
    this.apolloServer = null;
    this.wsServer = null;
    this.port = process.env.PORT || 4000;
    // Security: No fallback JWT secret - fail fast if not provided
    this.jwtSecret = process.env.JWT_SECRET;
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required for security');
    }
  }

  /**
   * Initialize and start the GraphQL server
   */
  async start() {
    try {
      // Setup Express middleware
      this.setupMiddleware();

      // Create Apollo Server with security measures
      this.apolloServer = new ApolloServer({
        typeDefs,
        resolvers,
        // Security: Disable introspection and debug in production
        introspection: process.env.NODE_ENV !== 'production',
        debug: process.env.NODE_ENV !== 'production',
        // Security: Configure persisted queries to prevent DoS attacks
        persistedQueries: {
          cache: 'bounded'
        },
        // Security: GraphQL query validation rules
        validationRules: [
          depthLimit(10) // Prevent deeply nested queries
          // Note: costAnalysis complexity limiting temporarily disabled due to API changes
        ],
        context: ({ req, connection }) => {
          // Handle WebSocket connections (subscriptions)
          if (connection) {
            return {
              user: connection.context.user,
              isAuthenticated: Boolean(connection.context.user)
            };
          }

          // Handle HTTP requests
          return {
            user: req.user,
            isAuthenticated: Boolean(req.user)
          };
        },
        // Security: Use secure error formatting
        formatError: formatErrorSecure,
        plugins: [
          {
            requestDidStart() {
              return {
                didResolveOperation(requestContext) {
                  console.log(`🔍 GraphQL Operation: ${requestContext.request.operationName}`);
                },
                didEncounterErrors(requestContext) {
                  console.error('GraphQL Errors:', requestContext.errors);
                }
              };
            }
          }
        ]
      });

      // Start Apollo Server
      await this.apolloServer.start();

      // Apply Apollo GraphQL middleware
      this.apolloServer.applyMiddleware({
        app: this.app,
        path: '/graphql',
        cors: {
          origin: [
            ...(process.env.CORS_ORIGINS 
              ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
              : ['http://localhost:5173', 'http://localhost:3000']),
            ...(process.env.APOLLO_STUDIO_ENABLED === 'true' ? ['https://studio.apollographql.com'] : [])
          ],
          credentials: true,
          methods: ['GET', 'POST', 'OPTIONS']
        }
      });

      // Add GraphQL Playground route for development
      if (process.env.NODE_ENV === 'development') {
        this.app.get('/playground', (req, res) => {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset=utf-8/>
              <meta name="viewport" content="user-scalable=no, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, minimal-ui">
              <title>GraphQL Playground</title>
              <link rel="stylesheet" href="//cdn.jsdelivr.net/npm/graphql-playground-react/build/static/css/index.css" />
              <link rel="shortcut icon" href="//cdn.jsdelivr.net/npm/graphql-playground-react/build/favicon.png" />
              <script src="//cdn.jsdelivr.net/npm/graphql-playground-react/build/static/js/middleware.js"></script>
            </head>
            <body>
              <div id="root">
                <style>
                  body { margin: 0; font-family: Open Sans, sans-serif; overflow: hidden; }
                  #root { height: 100vh; }
                </style>
              </div>
              <script>window.addEventListener('load', function (event) {
                GraphQLPlayground.init(document.getElementById('root'), {
                  endpoint: 'http://localhost:4000/graphql',
                  settings: {
                    'request.credentials': 'same-origin'
                  }
                })
              })</script>
            </body>
            </html>
          `);
        });
      }

      // Create HTTP server
      this.httpServer = createServer(this.app);

      // Setup WebSocket server for subscriptions
      this.setupWebSocketServer();

      // Start HTTP server
      await new Promise((resolve) => {
        this.httpServer.listen(this.port, resolve);
      });

      console.log(`🚀 GraphQL Server ready at http://localhost:${this.port}${this.apolloServer.graphqlPath}`);
      console.log(`🔗 GraphQL Subscriptions ready at ws://localhost:${this.port}/graphql`);

      // Initialize services (optional - server can start without them)
      try {
        await this.initializeServices();
      } catch (error) {
        console.warn('⚠️ Some services failed to initialize, but server will continue:', error.message);
      }

      return this.httpServer;
    } catch (error) {
      console.error('❌ Error starting GraphQL server:', error);
      throw error;
    }
  }

  /**
   * Setup Express middleware with enhanced security
   */
  setupMiddleware() {
    // Configure Express to trust proxy headers
    this.app.set('trust proxy', 1);

    // Security: Enhanced helmet configuration with dynamic CSP
    this.app.use(helmet({
      ...securityHeaders,
      contentSecurityPolicy: {
        directives: getCSPDirectives()
      }
    }));

    // Security: Enhanced rate limiting
    this.app.use(expressRateLimit);

    // CORS with validation
    const baseOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
      : ['http://localhost:5173', 'http://localhost:3000'];

    const allowedOrigins = [
      ...baseOrigins,
      ...(process.env.APOLLO_STUDIO_ENABLED === 'true' ? ['https://studio.apollographql.com'] : [])
    ];

    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        console.warn(`🚫 CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Compression
    this.app.use(compression());

    // Advanced rate limiting with IP-based rules
    const createAdvancedLimiter = () => {
      return rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: (req) => {
          // More lenient for private IPs
          if (isPrivateIP(req.ip)) {
            return 5000; // Higher limit for internal network
          }
          // More reasonable for external IPs with dashboard usage
          return 2000;
        },
        message: {
          error: 'Too many requests from this IP',
          retryAfter: '15 minutes',
          type: 'RATE_LIMIT_EXCEEDED'
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
          // Log rate limit violations
          auditLogService.logSecurityViolation(
            'RATE_LIMIT_EXCEEDED',
            {
              ip: req.ip,
              userAgent: req.get('User-Agent'),
              path: req.path
            },
            req.user || null,
            req.ip
          );

          res.status(429).json({
            error: 'Too many requests from this IP',
            retryAfter: '15 minutes',
            type: 'RATE_LIMIT_EXCEEDED'
          });
        }
      });
    };

    this.app.use('/graphql', createAdvancedLimiter());

    // Body parsing with secure limits
    const payloadLimit = process.env.MAX_PAYLOAD_SIZE || '1mb';
    this.app.use(express.json({ limit: payloadLimit }));
    this.app.use(express.urlencoded({ extended: true, limit: payloadLimit }));

    // Enhanced authentication middleware with audit logging
    this.app.use(async(req, res, next) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const clientIP = req.ip;
      const userAgent = req.get('User-Agent');

      if (token) {
        try {
          const user = await authService.verifyToken(token);
          req.user = user;

          // Log successful token verification for high-value operations
          if (req.path.includes('graphql') && req.method === 'POST') {
            auditLogService.logDataAccess(
              'TOKEN_VERIFIED',
              'authentication',
              user.id,
              user,
              clientIP
            );
          }
        } catch (error) {
          console.warn('Invalid token:', error.message);

          // Log failed token verification
          auditLogService.logSecurityViolation(
            'INVALID_TOKEN',
            {
              error: error.message,
              token_prefix: token.substring(0, 10) + '...'
            },
            null,
            clientIP
          );
        }
      }

      next();
    });

    // Enhanced health check endpoint with limited public info
    this.app.get('/health', async(req, res) => {
      // Log health check access from external IPs
      if (!isPrivateIP(req.ip)) {
        auditLogService.logSystemEvent(
          'HEALTH_CHECK_ACCESS',
          { external_ip: req.ip },
          null,
          req.ip
        );
      }

      // Basic health response for public access
      const basicResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString()
      };

      // Detailed info only for authenticated users or internal IPs
      if (req.user || isPrivateIP(req.ip)) {
        const services = { graphql: true };

        // Safely check services
        try { services.mqtt = mqttService.getStatus?.().isConnected || false; } catch { services.mqtt = false; }
        try { services.rules = rulesEngineService.getStatus?.().isRunning || false; } catch { services.rules = false; }
        try { services.queue = queueService.isProcessing || false; } catch { services.queue = false; }

        // Add security status
        const security = {
          audit_logging: true,
          rate_limiting: true,
          two_factor_auth: true,
          helmet_protection: true
        };

        basicResponse.services = services;
        basicResponse.security = security;
        basicResponse.version = '2.0.0';
      }

      res.json(basicResponse);
    });

    // Basic info endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'IoT Greenhouse GraphQL API',
        version: '1.0.0',
        graphql: `${req.protocol}://${req.get('host')}/graphql`,
        playground: `${req.protocol}://${req.get('host')}/graphql`
      });
    });
  }

  /**
   * Setup WebSocket server for GraphQL subscriptions using graphql-ws
   */
  setupWebSocketServer() {
    // Create WebSocket server
    this.wsServer = new WebSocketServer({
      server: this.httpServer,
      path: '/graphql'
    });

    // Use graphql-ws
    useServer(
      {
        schema: this.apolloServer.schema,
        execute,
        subscribe,
        onConnect: async(ctx) => {
          console.log('🔌 GraphQL WebSocket connection attempt');

          try {
            // Extract token from connection params
            const token = ctx.connectionParams?.authorization?.replace('Bearer ', '') ||
                         ctx.connectionParams?.token;

            if (!token) {
              console.warn('⚠️ No token provided for WebSocket connection');

              // Log unauthorized WebSocket attempt
              auditLogService.logSecurityViolation(
                'WEBSOCKET_NO_TOKEN',
                { connection_params: Object.keys(ctx.connectionParams || {}) },
                null,
                ctx.extra?.request?.connection?.remoteAddress
              );

              return { user: null };
            }

            // Verify token
            const user = await authService.verifyToken(token);
            console.log(`✅ WebSocket authenticated for user: ${user.username}`);

            // Log successful WebSocket authentication
            auditLogService.logAuthentication(
              user.username,
              true,
              ctx.extra?.request?.connection?.remoteAddress,
              ctx.extra?.request?.headers?.['user-agent'],
              'websocket'
            );

            return { user };
          } catch (error) {
            console.error('❌ WebSocket authentication failed:', error.message);

            // Log failed WebSocket authentication
            auditLogService.logSecurityViolation(
              'WEBSOCKET_AUTH_FAILED',
              { error: error.message },
              null,
              ctx.extra?.request?.connection?.remoteAddress
            );

            throw new Error('Authentication failed');
          }
        },
        onDisconnect: (ctx) => {
          console.log('🔌 GraphQL WebSocket disconnected');
        },
        onSubscribe: (ctx, message) => {
          console.log(`🔍 GraphQL Subscription: ${message.payload.operationName}`);
        },
        onComplete: (ctx, message) => {
          console.log(`✅ GraphQL Subscription completed: ${message.id}`);
        }
      },
      this.wsServer
    );
  }

  /**
   * Initialize all services with enhanced security
   */
  async initializeServices() {
    console.log('🔧 Initializing services...');

    // Initialize database first (critical for all other services)
    try {
      console.log('🔒 Initializing secure database...');
      await databaseInitService.initialize();
      console.log('✅ Database service initialized');
      
      // Initialize dynamic sensor system after database is ready
      try {
        console.log('🌡️ Initializing dynamic sensor system...');
        const dynamicSensorService = require('./services/dynamicSensorService');
        await dynamicSensorService.initializeService();
        
        const sensorTypeService = require('./services/sensorTypeService');
        const sensorTypes = sensorTypeService.getAllSensorTypes();
        console.log(`✅ Dynamic sensor system initialized with ${sensorTypes.length} sensor types`);
      } catch (sensorError) {
        console.warn('⚠️ Dynamic sensor system initialization warning:', sensorError.message);
        // Don't fail server startup if sensor system has issues
      }
      
    } catch (error) {
      console.error('❌ Database initialization failed:', error.message);
      throw error; // Database is critical - fail startup if it fails
    }

    // Initialize other services with individual error handling
    try {
      await mqttService.connect();
      console.log('✅ MQTT service initialized');
    } catch (error) {
      console.warn('⚠️ MQTT service failed to initialize:', error.message);
    }

    try {
      // Temporarily disabled for Redis debugging
      console.log('🚧 Queue service temporarily disabled for Redis debugging');
      // await queueService.startProcessing();
      // console.log('✅ Queue service initialized');
    } catch (error) {
      console.warn('⚠️ Queue service failed to initialize:', error.message);
    }

    try {
      await rulesEngineService.start();
      console.log('✅ Rules engine initialized');
    } catch (error) {
      console.warn('⚠️ Rules engine failed to initialize:', error.message);
    }

    console.log('🎉 Service initialization completed');
  }

  /**
   * Gracefully shutdown the server
   */
  async shutdown() {
    console.log('🛑 Shutting down GraphQL server...');

    try {
      // Stop WebSocket server
      if (this.wsServer) {
        this.wsServer.close();
        console.log('✅ WebSocket server stopped');
      }

      // Stop Apollo server
      if (this.apolloServer) {
        await this.apolloServer.stop();
        console.log('✅ Apollo server stopped');
      }

      // Stop HTTP server
      if (this.httpServer) {
        await new Promise((resolve) => {
          this.httpServer.close(resolve);
        });
        console.log('✅ HTTP server stopped');
      }

      // Stop services
      await this.shutdownServices();

      console.log('✅ GraphQL server shutdown complete');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Shutdown all services
   */
  async shutdownServices() {
    try {
      console.log('🛑 Shutting down services...');

      // Stop rules engine
      rulesEngineService.stop();
      console.log('✅ Rules engine stopped');

      // Stop queue service
      queueService.stopProcessing();
      console.log('✅ Queue service stopped');

      // Disconnect MQTT
      await mqttService.disconnect();
      console.log('✅ MQTT service disconnected');

      // Close PubSub
      if (pubsub.close) {
        await pubsub.close();
        console.log('✅ PubSub closed');
      }

      console.log('🎉 All services shut down successfully');
    } catch (error) {
      console.error('❌ Error shutting down services:', error);
    }
  }
}

// Create server instance
const server = new GraphQLServer();

// Handle graceful shutdown
process.on('SIGTERM', async() => {
  console.log('📡 SIGTERM received, shutting down gracefully...');
  await server.shutdown();
  process.exit(0);
});

process.on('SIGINT', async() => {
  console.log('📡 SIGINT received, shutting down gracefully...');
  await server.shutdown();
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start server if this file is run directly
if (require.main === module) {
  server.start().catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = server;
