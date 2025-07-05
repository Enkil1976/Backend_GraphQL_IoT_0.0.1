# Backend GraphQL IoT - Test Documentation

## Resumen

Este documento describe la suite completa de pruebas unitarias para el Backend GraphQL IoT. El sistema de pruebas cubre todas las operaciones GraphQL, resolvers, autenticación/autorización y funcionalidades críticas del sistema.

## Estructura de Pruebas

```
src/tests/
├── setup.js              # Configuración base de pruebas
├── queries.test.js        # Pruebas de todas las queries GraphQL
├── mutations.test.js      # Pruebas de todas las mutations GraphQL
├── subscriptions.test.js  # Pruebas de subscripciones tiempo real
├── resolvers.test.js      # Pruebas de resolvers específicos
└── authentication.test.js # Pruebas de autenticación y autorización
```

## Configuración de Testing

### Tecnologías Utilizadas
- **Jest**: Framework de testing principal
- **Apollo Server Testing**: Para pruebas de GraphQL
- **Supertest**: Para pruebas de integración HTTP
- **Babel**: Para transpilación ES6+

### Archivos de Configuración
- `jest.config.js`: Configuración principal de Jest
- `babel.config.js`: Configuración de Babel para ES6+
- `src/tests/setup.js`: Setup global y mocks

### Variables de Entorno de Testing
```bash
NODE_ENV=test
JWT_SECRET=test-jwt-secret
ACCESS_TOKEN_SECRET=test-access-token-secret
REFRESH_TOKEN_SECRET=test-refresh-token-secret
```

## Cobertura de Pruebas

### 1. Queries GraphQL (`queries.test.js`)

#### Health Queries
- ✅ Verificación de estado del sistema
- ✅ Estado de servicios (database, redis, mqtt)

#### Sensor Queries
- ✅ `sensors` - Obtener todos los sensores
- ✅ `sensor(id)` - Obtener sensor por ID
- ✅ `sensorReadings` - Lecturas con paginación
- ✅ `latestSensorData` - Datos más recientes
- ✅ `sensorStats` - Estadísticas por rango de tiempo
- ✅ Filtros por tipo de sensor
- ✅ Filtros por estado online/offline

#### Device Queries
- ✅ `devices` - Obtener todos los dispositivos
- ✅ `device(id)` - Obtener dispositivo por ID
- ✅ `devicesByType` - Filtrar por tipo de dispositivo
- ✅ Eventos de dispositivos

#### Weather Queries
- ✅ `currentWeather` - Clima actual
- ✅ `weatherForecast` - Pronóstico del tiempo
- ✅ `weatherHistory` - Historial climático

#### Rule Queries
- ✅ `rules` - Obtener todas las reglas
- ✅ `rule(id)` - Obtener regla por ID
- ✅ Filtros por estado activo/inactivo
- ✅ Ejecuciones de reglas

#### Notification Queries
- ✅ `notifications` - Obtener notificaciones
- ✅ `notification(id)` - Obtener notificación por ID
- ✅ `notificationTemplates` - Plantillas de notificación
- ✅ Filtros por tipo y estado de lectura

#### User Queries
- ✅ `me` - Usuario actual autenticado

### 2. Mutations GraphQL (`mutations.test.js`)

#### Authentication Mutations
- ✅ `login` - Autenticación de usuario
- ✅ `register` - Registro de usuario
- ✅ `refreshToken` - Renovación de tokens
- ✅ Manejo de credenciales inválidas

#### Device Control Mutations
- ✅ `createDevice` - Crear dispositivo
- ✅ `updateDevice` - Actualizar dispositivo
- ✅ `deleteDevice` - Eliminar dispositivo
- ✅ `controlDevice` - Controlar dispositivo

#### Rule Management Mutations
- ✅ `createRule` - Crear regla de automatización
- ✅ `updateRule` - Actualizar regla
- ✅ `deleteRule` - Eliminar regla
- ✅ `executeRule` - Ejecutar regla manualmente
- ✅ `toggleRule` - Activar/desactivar regla

#### Notification Mutations
- ✅ `createNotification` - Crear notificación
- ✅ `markNotificationAsRead` - Marcar como leída
- ✅ `deleteNotification` - Eliminar notificación
- ✅ `sendNotification` - Enviar notificación
- ✅ `createNotificationTemplate` - Crear plantilla

#### Weather Mutations
- ✅ `updateWeatherConfiguration` - Configuración del clima
- ✅ `fetchWeatherData` - Obtener datos manualmente

#### User Management Mutations
- ✅ `updateUser` - Actualizar perfil de usuario
- ✅ `updateUserConfiguration` - Configuración de usuario
- ✅ `changePassword` - Cambiar contraseña

### 3. Subscriptions GraphQL (`subscriptions.test.js`)

#### Sensor Subscriptions
- ✅ `sensorDataUpdated` - Datos de sensores en tiempo real
- ✅ `sensorStatusChanged` - Cambios de estado de sensores
- ✅ Filtros por tipo de sensor

#### Device Subscriptions
- ✅ `deviceStatusChanged` - Cambios de estado de dispositivos
- ✅ `deviceControlled` - Eventos de control de dispositivos
- ✅ `userDeviceEvents` - Eventos filtrados por propiedad

#### Notification Subscriptions
- ✅ `notificationCreated` - Nuevas notificaciones
- ✅ `notificationStatusChanged` - Cambios de estado
- ✅ `adminNotifications` - Notificaciones para admin
- ✅ Filtros por prioridad y tipo

#### Weather Subscriptions
- ✅ `weatherUpdated` - Actualizaciones del clima
- ✅ `weatherAlert` - Alertas climáticas

#### Real-time Features
- ✅ Múltiples suscripciones concurrentes
- ✅ Limpieza de suscripciones al desconectar
- ✅ Manejo de errores de conexión
- ✅ Throttling para alta frecuencia

### 4. Resolvers (`resolvers.test.js`)

#### Query Resolvers
- ✅ Resolvers de salud del sistema
- ✅ Resolvers de sensores y datos
- ✅ Resolvers de dispositivos
- ✅ Resolvers de clima
- ✅ Resolvers de reglas
- ✅ Resolvers de notificaciones
- ✅ Resolvers de usuarios

#### Mutation Resolvers
- ✅ Resolvers de autenticación
- ✅ Resolvers de control de dispositivos
- ✅ Resolvers de gestión de reglas
- ✅ Resolvers de notificaciones
- ✅ Resolvers de gestión de usuarios

#### Type Resolvers
- ✅ Resolvers del tipo `User`
- ✅ Resolvers del tipo `Sensor`
- ✅ Resolvers del tipo `Device`
- ✅ Resolvers del tipo `Rule`
- ✅ Resolvers del tipo `Notification`

#### Performance Features
- ✅ Implementación de caché
- ✅ Manejo de cache misses
- ✅ Optimización de consultas

### 5. Authentication & Authorization (`authentication.test.js`)

#### JWT Token Management
- ✅ Generación de tokens válidos
- ✅ Verificación de tokens
- ✅ Manejo de tokens inválidos
- ✅ Manejo de tokens expirados

#### Password Security
- ✅ Hash seguro de contraseñas
- ✅ Comparación de contraseñas
- ✅ Requisitos de fortaleza de contraseña
- ✅ Validación de políticas de seguridad

#### Login Authentication
- ✅ Autenticación con credenciales válidas
- ✅ Rechazo de credenciales inválidas
- ✅ Manejo de usuarios inactivos
- ✅ Rate limiting de intentos de login

#### User Registration
- ✅ Registro con datos válidos
- ✅ Validación de username único
- ✅ Validación de email único
- ✅ Validación de fortaleza de contraseña

#### Token Refresh
- ✅ Renovación con tokens válidos
- ✅ Rechazo de tokens inválidos
- ✅ Manejo de tokens expirados

#### Role-Based Access Control (RBAC)
- ✅ **Admin Role**: Acceso completo a todos los recursos
- ✅ **Editor Role**: Control de dispositivos y creación de reglas
- ✅ **Operator Role**: Solo control de dispositivos
- ✅ **Viewer Role**: Solo lectura de datos
- ✅ Denegación de permisos insuficientes

#### Unauthenticated Access
- ✅ Acceso a queries públicas (health)
- ✅ Denegación de queries protegidas
- ✅ Permiso para login/register
- ✅ Denegación de mutations protegidas

#### Security Features
- ✅ Gestión de sesiones
- ✅ Sesiones concurrentes
- ✅ Timeout de sesiones
- ✅ Validación de headers JWT
- ✅ Seguridad CORS
- ✅ Rate limiting
- ✅ Audit logging

## Datos de Prueba (Mocks)

### Usuarios Mock
```javascript
mockUsers = {
  admin: { id: 1, username: 'admin', role: 'admin', email: 'admin@test.com' },
  editor: { id: 2, username: 'editor', role: 'editor', email: 'editor@test.com' },
  viewer: { id: 3, username: 'viewer', role: 'viewer', email: 'viewer@test.com' }
}
```

### Datos de Sensores Mock
```javascript
mockSensorData = {
  temhum1: { id: 1, name: 'Sensor TemHum1', type: 'TEMHUM1', isOnline: true },
  temhum2: { id: 2, name: 'Sensor TemHum2', type: 'TEMHUM2', isOnline: true },
  calidadAgua: { id: 3, name: 'Sensor Calidad Agua', type: 'CALIDAD_AGUA', isOnline: true }
}
```

### Datos de Dispositivos Mock
```javascript
mockDeviceData = {
  bomba: { id: 1, name: 'Bomba de Agua', type: 'PUMP', status: 'ONLINE' },
  calefactor: { id: 2, name: 'Calefactor', type: 'HEATER', status: 'ONLINE' }
}
```

## Comandos de Testing

### Ejecutar Todas las Pruebas
```bash
npm test
```

### Ejecutar en Modo Watch
```bash
npm run test:watch
```

### Generar Reporte de Cobertura
```bash
npm run coverage
```

### Ejecutar Pruebas Específicas
```bash
# Solo queries
npm test queries.test.js

# Solo mutations
npm test mutations.test.js

# Solo autenticación
npm test authentication.test.js
```

## Métricas de Cobertura

### Objetivos de Cobertura
- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

### Áreas Excluidas de Cobertura
- Archivos de configuración (`src/config/`)
- Utilidades generales (`src/utils/`)
- Punto de entrada del servidor (`src/server.js`)
- Directorios de pruebas (`**/__tests__/**`)

## Patrones de Testing

### Estructura de Pruebas
```javascript
describe('Feature Group', () => {
  beforeEach(() => {
    // Setup for each test
    jest.clearAllMocks();
  });

  describe('Specific Feature', () => {
    it('should perform expected behavior', async () => {
      // Arrange
      const input = { /* test data */ };
      
      // Act
      const result = await testFunction(input);
      
      // Assert
      expect(result).toMatchObject(expectedOutput);
    });
  });
});
```

### Mocking de Servicios
```javascript
// Mock service
jest.mock('../services/sensorService');

// Setup mock return values
sensorService.getAllSensors.mockResolvedValue(mockData);
```

### Testing de GraphQL
```javascript
const { query, mutate } = createTestServer({ user: mockUser });

const response = await query({ 
  query: GRAPHQL_QUERY,
  variables: { /* variables */ }
});

expect(response.errors).toBeUndefined();
expect(response.data).toMatchObject(expectedResult);
```

## Mejores Prácticas

### 1. Isolación de Pruebas
- Cada prueba es independiente
- Mocks se reinician entre pruebas
- Sin efectos secundarios entre tests

### 2. Datos de Prueba Consistentes
- Uso de datos mock reutilizables
- Datos realistas pero predecibles
- Cobertura de casos edge

### 3. Testing de Errores
- Manejo de errores de servicios
- Validación de entrada
- Autorización y autenticación

### 4. Performance Testing
- Pruebas de carga de subscripciones
- Manejo de múltiples conexiones
- Optimización de queries

### 5. Security Testing
- Validación de roles y permisos
- Inyección de tokens inválidos
- Rate limiting y throttling

## Integración Continua

### GitHub Actions / CI/CD
```yaml
- name: Run Tests
  run: |
    npm test
    npm run coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v1
  with:
    file: ./coverage/lcov.info
```

### Pre-commit Hooks
```bash
# Ejecutar tests antes de commit
npm test

# Verificar cobertura mínima
npm run coverage -- --coverageThreshold.global.statements=90
```

## Troubleshooting

### Problemas Comunes

#### Tests Fallan por Timeouts
```javascript
// Aumentar timeout en jest.config.js
testTimeout: 30000
```

#### Mocks No Funcionan
```javascript
// Asegurar que los mocks se limpian
beforeEach(() => {
  jest.clearAllMocks();
});
```

#### Errores de GraphQL Schema
```javascript
// Verificar que todos los types están importados
const typeDefs = [
  baseTypeDefs,
  sensorTypeDefs,
  // ... otros types
].filter(Boolean);
```

### Debugging de Pruebas
```bash
# Modo debug
node --inspect-brk node_modules/.bin/jest --runInBand

# Logs detallados
DEBUG=* npm test
```

## Próximos Pasos

### Mejoras Pendientes
- [ ] Tests de integración end-to-end
- [ ] Tests de performance/carga
- [ ] Tests de compatibilidad de browsers
- [ ] Automated visual testing
- [ ] Tests de regresión automatizados

### Métricas Adicionales
- [ ] Tiempo de ejecución de tests
- [ ] Cobertura de mutations vs queries
- [ ] Análisis de código duplicado en tests
- [ ] Tracking de flaky tests

## Conclusión

La suite de pruebas del Backend GraphQL IoT proporciona cobertura completa de todas las funcionalidades críticas del sistema, incluyendo:

- **100% de cobertura** de operaciones GraphQL (queries, mutations, subscriptions)
- **Robusta validación** de autenticación y autorización
- **Testing exhaustivo** de roles y permisos RBAC
- **Pruebas de tiempo real** para subscripciones WebSocket
- **Validación de seguridad** completa
- **Manejo de errores** y casos edge

Esta documentación debe mantenerse actualizada conforme se agreguen nuevas funcionalidades al sistema.