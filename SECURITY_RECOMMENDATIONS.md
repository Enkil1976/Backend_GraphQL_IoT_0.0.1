# RECOMENDACIONES DE SEGURIDAD - BACKEND GRAPHQL IOT

## 🔴 CRÍTICAS (Implementar Inmediatamente)

### 1. JWT Secret Seguro
```javascript
// ❌ Actual
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// ✅ Recomendado
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

### 2. Política de Contraseñas Fuertes
```javascript
// ❌ Actual
if (!password || password.length < 6) {

// ✅ Recomendado
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
if (!password || !passwordRegex.test(password)) {
  throw new Error('Password must be at least 12 characters with uppercase, lowercase, number and special character');
}
```

### 3. Limitación de Queries GraphQL
```javascript
// ✅ Agregar al servidor
const depthLimit = require('graphql-depth-limit');
const costAnalysis = require('graphql-query-complexity');

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [
    depthLimit(10),
    costAnalysis.createComplexityLimitRule(1000)
  ],
  introspection: process.env.NODE_ENV !== 'production',
  debug: process.env.NODE_ENV !== 'production'
});
```

### 4. Error Handling Seguro
```javascript
// ✅ Manejo seguro de errores
formatError: (err) => {
  console.error('GraphQL Error:', {
    message: err.message,
    path: err.path,
    timestamp: new Date().toISOString()
  });
  
  // En producción, sanitizar errores
  if (process.env.NODE_ENV === 'production') {
    if (err.message.includes('authentication') || err.message.includes('authorization')) {
      return new Error('Authentication required');
    }
    if (err.extensions?.code === 'INTERNAL_ERROR') {
      return new Error('Internal server error');
    }
  }
  
  return {
    message: err.message,
    code: err.extensions?.code
  };
}
```

## 🟠 ALTAS (Implementar en 1 semana)

### 5. Validación de Entrada con Joi
```javascript
const Joi = require('joi');

const userInputSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().pattern(passwordRegex).required()
});

// En resolvers
const { error } = userInputSchema.validate(input);
if (error) {
  throw new Error(`Validation error: ${error.details[0].message}`);
}
```

### 6. Queries Parametrizadas Exclusivamente
```javascript
// ❌ Evitar construcción dinámica
let whereClause = 'WHERE 1=1';
if (role) {
  whereClause += ` AND role = '${role}'`; // VULNERABLE
}

// ✅ Usar parámetros siempre
const conditions = [];
const params = [];
let paramIndex = 1;

if (role) {
  conditions.push(`role = $${paramIndex}`);
  params.push(role);
  paramIndex++;
}

const sql = `SELECT * FROM users ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}`;
```

### 7. Rate Limiting Avanzado
```javascript
const { RateLimiterRedis } = require('rate-limiter-flexible');

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'middleware',
  points: 100, // Requests
  duration: 900, // Per 15 minutes
  blockDuration: 900, // Block for 15 minutes
});

// Rate limiting por usuario autenticado
const userRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'user',
  points: 1000,
  duration: 3600,
});
```

### 8. Tokens de Refresh Separados
```javascript
// ✅ Secrets separados
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
  throw new Error('Token secrets are required');
}

// Diferentes algoritmos/tiempos de expiración
const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, { 
  expiresIn: '15m',
  algorithm: 'HS256'
});

const refreshToken = jwt.sign({ userId }, REFRESH_TOKEN_SECRET, { 
  expiresIn: '7d',
  algorithm: 'HS512'
});
```

## 🟡 MEDIAS (Implementar en 1 mes)

### 9. Logging Estructurado
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Reemplazar console.log por logger
logger.info('User authenticated', { userId, timestamp: new Date() });
logger.error('Authentication failed', { username, ip, timestamp: new Date() });
```

### 10. Headers de Seguridad Completos
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 11. Sanitización de Entrada
```javascript
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');

app.use(mongoSanitize());

// Middleware personalizado para GraphQL
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return xss(input);
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return input;
};
```

## 🔒 CONFIGURACIÓN DE ENTORNO SEGURA

### .env.example (Seguro)
```bash
# JWT Secrets (generar con: openssl rand -hex 64)
JWT_SECRET=GENERATE_STRONG_SECRET_HERE
ACCESS_TOKEN_SECRET=GENERATE_DIFFERENT_SECRET_HERE  
REFRESH_TOKEN_SECRET=GENERATE_ANOTHER_SECRET_HERE

# Database (usar SSL en producción)
PG_URI=postgresql://user:pass@host:port/dbname?sslmode=require

# Redis (usar TLS en producción)
REDIS_URL=rediss://user:pass@host:port

# MQTT (usar SSL)
MQTT_BROKER_URL=mqtts://broker:8883

# Configuración de seguridad
NODE_ENV=production
BCRYPT_ROUNDS=12
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# CORS (especificar dominios exactos)
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

## 📋 CHECKLIST DE SEGURIDAD

### Inmediato ✅
- [ ] Eliminar JWT secret por defecto
- [ ] Implementar política de contraseñas fuertes
- [ ] Agregar limitación de profundidad GraphQL
- [ ] Sanitizar mensajes de error para producción
- [ ] Deshabilitar introspección en producción

### Corto Plazo ✅
- [ ] Implementar validación Joi completa
- [ ] Usar queries parametrizadas exclusivamente
- [ ] Separar secrets de access/refresh tokens
- [ ] Implementar rate limiting avanzado
- [ ] Agregar logging estructurado

### Largo Plazo ✅
- [ ] Auditorías de seguridad regulares
- [ ] Monitoring de eventos de seguridad
- [ ] Implementar CSP headers
- [ ] Configurar HTTPS obligatorio
- [ ] Establecer procedimientos de respuesta a incidentes

## 🚨 NOTAS IMPORTANTES

1. **NO DEPLOYAR A PRODUCCIÓN** sin corregir vulnerabilidades críticas
2. **GENERAR SECRETS ÚNICOS** para cada entorno
3. **HABILITAR SSL/TLS** para todas las conexiones
4. **MONITOREAR LOGS** de seguridad regularmente
5. **ACTUALIZAR DEPENDENCIAS** periódicamente

## 📞 CONTACTO DE SEGURIDAD

Para reportar vulnerabilidades de seguridad:
- Email: security@yourcompany.com
- Proceso: Responsible disclosure policy
- SLA: Respuesta en 24 horas para vulnerabilidades críticas