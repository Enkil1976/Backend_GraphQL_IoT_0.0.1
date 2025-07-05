# CLAUDE.md - Backend GraphQL IoT

Este archivo proporciona orientación a Claude Code (claude.ai/code) cuando trabaja con el código en este repositorio.

## Estructura del Proyecto

Este es el backend GraphQL para el sistema de monitoreo de invernadero IoT, construido como una modernización del backend REST original.

### Tecnologías Principales
- **GraphQL**: Apollo Server 3.x con subscripciones en tiempo real
- **Base de Datos**: PostgreSQL con pooling de conexiones
- **Cache**: Redis para sesiones y datos en tiempo real
- **MQTT**: Ingesta de datos de sensores en tiempo real
- **Colas**: Redis Streams para procesamiento confiable de acciones
- **Autenticación**: Tokens JWT con soporte para refresh tokens
- **Tiempo Real**: Subscripciones WebSocket para actualizaciones en vivo

## Comandos de Desarrollo

### Ejecución de la Aplicación
```bash
npm start                    # Servidor de producción
npm run dev                  # Desarrollo con hot reload (si está disponible)
```

### Testing
```bash
npm test                     # Ejecutar todas las pruebas
npm run test:watch          # Modo watch para pruebas
npm run coverage            # Reporte de cobertura de pruebas
npm run test:mqtt           # Probar conectividad MQTT
npm run test:notification   # Probar sistema de notificaciones
```

### Herramientas de Diagnóstico
```bash
npm run diagnose:mqtt       # Diagnosticar problemas del sistema MQTT
npm run simulate:mqtt       # Generar datos MQTT de prueba
npm run verify:timezone     # Verificar configuración de zona horaria Chile
```

### Configuración de Base de Datos
Ejecutar archivos SQL en orden desde el backend original:
```bash
psql invernadero_iot < ../Backend_Inv_IoT/sql/create_users_table.sql
psql invernadero_iot < ../Backend_Inv_IoT/sql/create_devices_table.sql
psql invernadero_iot < ../Backend_Inv_IoT/sql/create_temhum1_table.sql
psql invernadero_iot < ../Backend_Inv_IoT/sql/create_temhum2_table.sql
psql invernadero_iot < ../Backend_Inv_IoT/sql/create_calidad_agua_table.sql
psql invernadero_iot < ../Backend_Inv_IoT/sql/create_power_monitor_logs_table.sql
psql invernadero_iot < ../Backend_Inv_IoT/sql/create_rules_table.sql
psql invernadero_iot < ../Backend_Inv_IoT/sql/create_scheduled_operations_table.sql
psql invernadero_iot < ../Backend_Inv_IoT/sql/create_notifications_tables.sql
psql invernadero_iot < ../Backend_Inv_IoT/sql/configure_chile_timezone.sql
psql invernadero_iot < sql/create_user_configurations_table.sql
```

## Arquitectura de Alto Nivel

### Flujo del Sistema Principal
1. **Ingesta de Datos MQTT**: `mqttService.js` recibe datos de sensores vía tópicos MQTT (`Invernadero/[SensorID]/[DataType]`)
2. **Almacenamiento Dual**: Datos almacenados en PostgreSQL (persistencia) y Redis (caché tiempo real + historial)
3. **Capa GraphQL**: Resolvers sirven datos con autenticación basada en roles (JWT)
4. **Actualizaciones Tiempo Real**: Servidor WebSocket transmite eventos a clientes suscritos
5. **Automatización**: Motor de reglas evalúa condiciones y dispara acciones vía sistema de colas

### Patrones Arquitectónicos Clave

#### Arquitectura de Capa de Servicios
- **Servicios** (`services/`) contienen lógica de negocio y operaciones de base de datos
- **Resolvers** (`schema/resolvers/`) manejan requests GraphQL y delegan a servicios
- **Middleware** (`middleware/`) proporciona preocupaciones transversales (auth, cache, validación, seguridad)

#### Pipeline de Procesamiento de Mensajes MQTT
```
Mensaje MQTT → mqttService.js → {
  ├── Parsear estructura de tópicos (Invernadero/[ID]/[Type])
  ├── Validar y transformar payload
  ├── Almacenar en PostgreSQL (registro permanente)
  ├── Actualizar caché Redis (valores últimos + listas de historial)
  └── Emitir eventos WebSocket (actualizaciones tiempo real)
}
```

#### Flujo de Autenticación y Autorización
- Tokens JWT generados en `authService.js`
- Middleware `auth.js` valida tokens y extrae contexto de usuario
- Control de acceso basado en roles: admin > editor > operator > viewer
- Concepto de propiedad de dispositivos: usuarios pueden poseer dispositivos específicos para notificaciones dirigidas

#### Procesamiento de Acciones Basado en Colas
- Acciones críticas encoladas vía `queueService.js` (Redis Streams)
- `criticalActionWorker.js` procesa acciones con lógica de reintentos
- Acciones fallidas movidas a Dead Letter Queue (DLQ) para revisión de admin
- Usado por motor de reglas y operaciones programadas

### Modelos de Datos y Relaciones

#### Tablas de Datos de Sensores
- `temhum1`, `temhum2`: Sensores de temperatura/humedad con estadísticas
- `calidad_agua`: Calidad del agua (pH, EC, PPM, temperatura del agua)
- `power_monitor_logs`: Consumo de energía vinculado a dispositivos monitoreados
- `weather`: Datos climáticos externos vía WeatherAPI

#### Tablas de Gestión
- `devices`: Registro de dispositivos IoT con configuración JSON y propiedad
- `users`: Autenticación con roles y configuraciones personalizadas
- `rules`: Reglas de automatización con condiciones/acciones JSON
- `scheduled_operations`: Operaciones de dispositivos basadas en cron
- `notifications`: Sistema de alertas con múltiples canales
- `user_configurations`: Configuraciones personalizadas por usuario

#### Estructura de Caché Redis
```
sensor_latest:[sensor_id]           # Hash de valores actuales
sensor_history:[sensor_id]:[metric] # Lista de valores con timestamp (LIFO)
```

### Sistema WebSocket de Tiempo Real
- Autenticación requerida vía parámetro JWT query
- Suscripciones basadas en salas:
  - `sensor_latest:[sensor_id]` - actualizaciones de datos de sensores
  - `device_events:[device_id]` - eventos específicos de dispositivos
  - `operations_log:new` - nuevos logs de operaciones
- Mensajería dirigida: propietarios de dispositivos reciben eventos `owned_device_update`
- Eventos solo para admin: `admin_device_status_alert`

### Arquitectura del Motor de Reglas
Ubicado en `services/rulesEngineService.js`:
- **Evaluadores** evalúan condiciones contra datos actuales
- **Caché de Contexto** optimiza obtención de datos
- **Fetcher de Datos** recupera estado de sensores/dispositivos
- Reglas disparadas por evaluación programada y actualizaciones de sensores en tiempo real

## Configuración de Zona Horaria Chile

Todo el sistema está configurado para usar zona horaria de Chile (`America/Santiago`):
- Maneja automáticamente horario de verano (CLT UTC-4 invierno / CLST UTC-3 verano)
- Todas las marcas de tiempo en logs, base de datos y respuestas API usan hora de Chile
- Procesamiento de mensajes MQTT usa zona horaria de Chile
- PostgreSQL configurado con zona horaria Santiago

### Utilidades de Zona Horaria
```javascript
const { getChileDate, toChileISOString, toChileLogString } = require('./config/timezone');

// Obtener fecha actual de Chile
const now = getChileDate();

// Formatear para string ISO en zona horaria Chile
const isoString = toChileISOString();

// Formatear para logs legibles
const logString = toChileLogString();
```

## Configuración de Entorno

### Variables Requeridas
```bash
# Configuración principal
NODE_ENV=production
PORT=4000

# Secrets JWT (CRÍTICO: Generar con: openssl rand -hex 64)
JWT_SECRET=your_secret_key
ACCESS_TOKEN_SECRET=different_secret_here
REFRESH_TOKEN_SECRET=another_secret_here

# Base de datos
PG_URI=postgresql://user:pass@host:port/dbname
REDIS_URL=redis://host:port

# MQTT
MQTT_BROKER_URL=mqtts://broker:8883
MQTT_USERNAME=username
MQTT_PASSWORD=password

# Seguridad
CORS_ORIGINS=https://yourdomain.com
BCRYPT_ROUNDS=12

# APIs externas
WEATHER_API_KEY=your_weather_key
WEBHOOK_URL=https://your-webhook.com
```

### Estructura de Tópicos MQTT
```
Invernadero/
├── TemHum1/data     # Sensor temperatura/humedad 1
├── TemHum2/data     # Sensor temperatura/humedad 2
├── Agua/data        # Calidad del agua multi-parámetro
├── Agua/Temperatura # Solo temperatura del agua
├── Agua/temp        # Temperatura del agua (variante)
├── Bomba/sw         # Estado de bomba de agua
├── Calefactor/sw    # Estado de calefactor
├── CalefactorAgua/sw # Estado de calefactor de agua
├── Ventilador/sw    # Estado de ventilador
└── [DeviceID]/data  # Sensores de energía por hardware ID
```

## GraphQL Schema y Resolvers

### Estructura de Resolvers
```
src/schema/resolvers/
├── Query/
│   ├── health.js         # Health checks del sistema
│   ├── sensors.js        # Datos de sensores (temhum1, temhum2, calidad_agua, power_monitor)
│   ├── devices.js        # Gestión de dispositivos IoT
│   ├── rules.js          # Motor de reglas de automatización
│   ├── notifications.js  # Sistema de notificaciones
│   ├── users.js          # Gestión de usuarios
│   └── weather.js        # API del clima
├── Mutation/
│   ├── auth.js           # Login, registro, refresh tokens
│   ├── devices.js        # CRUD y control de dispositivos
│   ├── rules.js          # CRUD de reglas y ejecución manual
│   ├── notifications.js  # Envío y gestión de notificaciones
│   ├── users.js          # Gestión de usuarios y configuraciones
│   └── weather.js        # Recolección y configuración del clima
├── Subscription/
│   ├── sensors.js        # Actualizaciones en tiempo real de sensores
│   ├── devices.js        # Cambios de estado de dispositivos
│   ├── notifications.js  # Nuevas notificaciones
│   └── weather.js        # Actualizaciones del clima
└── types/
    ├── User.js           # Resolvers anidados para tipos de usuario
    ├── Device.js         # Resolvers para dispositivos y eventos
    ├── Rule.js           # Resolvers para reglas y estadísticas
    ├── Notification.js   # Resolvers para notificaciones y plantillas
    └── Sensor.js         # Resolvers para sensores y estadísticas
```

### Tipos GraphQL Principales
- **User**: Gestión de usuarios con roles y configuraciones
- **Device**: Dispositivos IoT con capacidades y estado
- **Sensor**: Datos de sensores con estadísticas históricas
- **Rule**: Reglas de automatización con condiciones/acciones
- **Notification**: Sistema de notificaciones multi-canal
- **Weather**: Datos climáticos externos

### Autenticación y Autorización GraphQL
```javascript
// Contexto de autenticación
context: ({ req, connection }) => {
  if (connection) {
    return { user: connection.context.user };
  }
  return { user: req.user };
}

// Verificación de roles en resolvers
if (!context.user || !['admin', 'editor'].includes(context.user.role)) {
  throw new ForbiddenError('Insufficient permissions');
}
```

## Seguridad

### Medidas de Seguridad Implementadas
- **Validación de Contraseñas Fuertes**: Mínimo 12 caracteres con complejidad
- **Limitación de Profundidad GraphQL**: Máximo 10 niveles de anidación
- **Limitación de Complejidad**: Máximo 1000 puntos de complejidad
- **Rate Limiting**: 100 requests por 15 minutos por IP
- **Headers de Seguridad**: Helmet con CSP, HSTS, etc.
- **CORS Configurado**: Orígenes específicos validados
- **Sanitización de Entrada**: Joi validation + sanitización XSS
- **Manejo Seguro de Errores**: Sanitización en producción
- **JWT Sin Fallback**: Falla si JWT_SECRET no está configurado

### Configuración de Seguridad
```javascript
// Validación de entrada
const { validateInput, sanitizeInput } = require('./middleware/security');

// En resolvers
const sanitizedInput = sanitizeInput(input);
const validatedInput = validateInput(sanitizedInput, 'schemaName');
```

## Desarrollo

### Agregando Nuevos Tipos de Sensores
1. Crear tabla SQL en directorio `sql/`
2. Agregar lógica de parsing de tópicos en `mqttService.js` `handleIncomingMessage()`
3. Actualizar patrones de caché Redis para datos en tiempo real
4. Crear resolvers GraphQL en `schema/resolvers/Query/sensors.js`
5. Agregar middleware de validación si es necesario
6. Actualizar schema GraphQL en `schema/typeDefs/sensor.graphql`

### Extendiendo el Motor de Reglas
1. Las reglas se evalúan usando el `rulesEngineService.js` existente
2. Agregar nuevos tipos de condiciones en la configuración JSON
3. Actualizar validación de condiciones en resolvers
4. Probar con reglas de ejemplo vía API GraphQL

### Transmisión de Eventos WebSocket
Usar PubSub para transmitir eventos:
```javascript
const { pubsub, SENSOR_EVENTS } = require('../utils/pubsub');

// Transmitir a todos
await pubsub.publish(SENSOR_EVENTS.DEVICE_UPDATED, { deviceUpdated: device });

// Suscripción con filtros
subscription: withFilter(
  () => pubsub.asyncIterator([SENSOR_EVENTS.DEVICE_UPDATED]),
  (payload, variables, context) => {
    return payload.deviceUpdated.user_id === context.user.id;
  }
)
```

### Migraciones de Base de Datos
- Agregar nuevos archivos SQL al directorio `sql/`
- Usar nombres descriptivos con prefijos de versión/fecha
- Incluir tanto declaraciones CREATE como ALTER según sea necesario
- Actualizar este archivo con nuevos comandos de configuración

## Testing de Datos de Sensores

### Simular Datos MQTT
```bash
# Usar simulador incorporado
npm run simulate:mqtt

# O publicar manualmente con mosquitto_pub
mosquitto_pub -h broker.emqx.io -t "Invernadero/TemHum1/data" \
  -m '{"temperatura":24.5,"humedad":65,"heatindex":26,"dewpoint":18,"rssi":-45,"stats":{"tmin":20,"tmax":28,"tavg":24,"hmin":60,"hmax":70,"havg":65,"total":100,"errors":0},"boot":1,"mem":45000}'
```

### Testing de API GraphQL con Autenticación
```bash
# GraphQL Playground disponible en desarrollo
# URL: http://localhost:4000/graphql

# Ejemplo de login
mutation {
  login(username: "admin", password: "password") {
    token
    user { id username role }
  }
}

# Usar token en headers
{
  "Authorization": "Bearer JWT_TOKEN"
}
```

## Deployment

### Configuración de Producción
- Establecer `NODE_ENV=production`
- Usar secrets JWT seguros (generados con `openssl rand -hex 64`)
- Configurar orígenes CORS apropiados
- Configurar terminación SSL
- Configurar persistencia Redis
- Establecer backups de base de datos
- Deshabilitar introspección GraphQL
- Configurar logging estructurado

### Variables de Entorno de Producción
```bash
NODE_ENV=production
GRAPHQL_INTROSPECTION=false
GRAPHQL_PLAYGROUND=false
JWT_SECRET=secure_generated_secret
CORS_ORIGINS=https://yourdomain.com
```

## Migración desde REST

### Compatibilidad
- Mantiene compatibilidad con estructuras de datos de API REST existentes
- Usa las mismas tablas PostgreSQL
- Servicios compartidos: autenticación e infraestructura Redis
- Datos consistentes: mismas fuentes de datos y lógica de validación
- Deployment paralelo: puede ejecutarse junto a API REST durante migración

### Beneficios de GraphQL
- Obtención de datos más eficiente (solo campos solicitados)
- Suscripciones en tiempo real incorporadas
- Seguridad de tipos automática
- Mejor experiencia de desarrollador
- Documentación automática con introspección
- Herramientas de desarrollo superiores

## Monitoreo de Salud

### Endpoints de Salud
- **Health endpoint**: `/health`
- **Estado de servicios**: MQTT, Motor de Reglas, Procesador de colas
- **Introspección GraphQL**: Disponible en desarrollo
- **Tracking de errores**: Logging comprehensivo

### Métricas del Sistema
```javascript
// Disponible en health endpoint
{
  "status": "healthy",
  "services": {
    "mqtt": "connected",
    "rules_engine": "running", 
    "queue_processor": "active",
    "database": "connected",
    "redis": "connected"
  },
  "uptime": "2h 30m",
  "version": "1.0.0"
}
```

## Contribución

1. Seguir la estructura de código existente
2. Agregar manejo de errores apropiado
3. Escribir pruebas para nuevas características
4. Actualizar documentación
5. Mantener compatibilidad hacia atrás
6. Seguir estándares de seguridad implementados

## Resolución de Problemas

### Problemas Comunes
1. **MQTT desconectado**: Verificar credenciales y conectividad de red
2. **Redis no disponible**: Verificar configuración de conexión Redis
3. **Base de datos falló**: Verificar string de conexión PostgreSQL
4. **JWT inválido**: Verificar que JWT_SECRET esté configurado
5. **CORS bloqueado**: Verificar configuración CORS_ORIGINS

### Debugging
```bash
# Habilitar logging detallado
DEBUG=* npm start

# Verificar salud del sistema
curl http://localhost:4000/health

# Probar conectividad MQTT
npm run test:mqtt
```

## Licencia

Este proyecto es parte del sistema de monitoreo de invernadero IoT.