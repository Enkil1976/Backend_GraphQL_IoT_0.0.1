# Guía de Deployment Automático - Backend IoT

Esta guía explica cómo hacer deployment del backend con **inicialización automática completa** de todas las bases de datos, incluyendo el sistema de sensores dinámicos para BMP280.

## 🚀 Deployment Automático Completo

### 1. Deployment con Docker (Recomendado)

```bash
# Deployment completo con Docker
npm run deploy:docker

# O manualmente:
docker compose up -d
```

**¿Qué hace automáticamente?**
- ✅ Levanta PostgreSQL y Redis
- ✅ Ejecuta todas las migraciones de base de datos
- ✅ Crea todas las tablas (incluyendo sensores dinámicos)
- ✅ Inicializa el sistema de tipos de sensores
- ✅ Configura tablas para BMP280 (`temp_pressure_data`)
- ✅ Verifica que todo esté funcionando
- ✅ Inicia el servidor GraphQL

### 2. Deployment Local

```bash
# Deployment completo local
npm run deploy:full

# O paso a paso:
npm run db:deploy    # Inicializa y verifica base de datos
npm start            # Inicia el servidor
```

### 3. Solo Base de Datos

```bash
# Solo inicializar base de datos
npm run db:init

# Verificar que todo esté bien
npm run db:verify

# Ver estado de la base de datos
npm run db:status
```

## 📊 Verificación Automática

El sistema incluye verificación automática que valida:

### Tablas Principales
- ✅ `users`, `devices`, `rules`, `notifications`
- ✅ `temhum1`, `temhum2`, `calidad_agua`, `luxometro`
- ✅ `power_monitor_logs`, `weather_current`
- ✅ `rule_executions`, `operations_log`

### Tablas de Seguridad
- ✅ `audit_logs`, `user_sessions`, `security_events`

### **Tablas de Sensores Dinámicos (Nuevas)**
- ✅ `sensors` - Registro de sensores creados dinámicamente
- ✅ `temp_pressure_data` - Datos de sensores BMP280
- ✅ `soil_moisture_data` - Datos de humedad del suelo
- ✅ `co2_data` - Datos de CO2
- ✅ `motion_data` - Datos de movimiento
- ✅ `custom_sensor_data` - Sensores personalizados
- ✅ `sensor_statistics` - Estadísticas de sensores
- ✅ `sensor_alerts` - Alertas de sensores

### Índices y Triggers
- ✅ Índices para optimización de queries
- ✅ Triggers para timestamps automáticos
- ✅ Funciones de base de datos

## 🌡️ Sistema BMP280 Listo

Después del deployment, el sistema está automáticamente listo para:

### Crear Sensor BMP280 via GraphQL
```graphql
mutation CreateBMP280 {
  createSensor(input: {
    name: "Sensor BMP280 Invernadero"
    sensorType: TEMP_PRESSURE
    hardwareId: "BMP280-1"
    location: "Invernadero Principal"
    description: "Sensor de temperatura y presión atmosférica"
    configuration: {
      thresholds: {
        temperature: { min: -10, max: 50 }
        pressure: { min: 30000, max: 110000 }
      }
    }
  }) {
    id
    mqttTopic
    isActive
  }
}
```

### Procesar Datos MQTT Automáticamente
- **Tópico**: `Invernadero/BMP280-1/data`
- **Payload**: `{"temperatura":12.36,"presion":99167.67,"altitude":150.5}`
- **Validación**: Automática según rangos configurados
- **Almacenamiento**: Tabla `temp_pressure_data`

## 🔧 Scripts de Deployment

### Scripts Principales
```bash
npm run deploy:full      # Deployment completo local
npm run deploy:docker    # Deployment con Docker
npm run deploy:verify    # Verificar deployment + tests
```

### Scripts de Base de Datos
```bash
npm run db:init         # Inicializar base de datos
npm run db:verify       # Verificar tablas y estructura
npm run db:status       # Estado de la base de datos
npm run db:deploy       # init + verify
```

### Scripts de Sensores
```bash
npm run sensors:test    # Test del sistema BMP280
npm run sensors:example # Ejemplos de uso
```

## 🐳 Docker Compose

### Servicios Incluidos
- **postgres**: Base de datos principal
- **redis**: Cache y pub/sub
- **db-init**: Inicialización automática
- **app**: Servidor GraphQL principal

### Variables de Entorno
```env
# Base de datos
PG_HOST=postgres
PG_DATABASE=invernadero_iot
PG_USER=postgres
PG_PASSWORD=postgres123

# Redis
REDIS_HOST=redis
REDIS_PASSWORD=redis_password

# MQTT
MQTT_BROKER_URL=mqtt://your-broker
MQTT_USERNAME=your_username
MQTT_PASSWORD=your_password

# Seguridad
JWT_SECRET=your_super_secure_secret_32_chars_min
```

## ✅ Verificación de Deployment

### Automática
El sistema verifica automáticamente:
- ✅ Conexión a base de datos
- ✅ Todas las tablas creadas
- ✅ Índices funcionando
- ✅ Triggers activos
- ✅ Sistema de sensores listo
- ✅ Compatibilidad BMP280

### Manual
```bash
# Verificar estado completo
npm run db:verify

# Probar sistema de sensores
npm run sensors:test

# Ver logs del servidor
docker compose logs app

# Ver logs de inicialización
docker compose logs db-init
```

## 🚨 Troubleshooting

### Base de Datos No Inicia
```bash
# Verificar logs
docker compose logs postgres

# Reiniciar servicios
docker compose down && docker compose up -d
```

### Tablas Faltantes
```bash
# Re-ejecutar inicialización
npm run db:init

# Verificar específicamente
npm run db:verify
```

### Sensores Dinámicos No Funcionan
```bash
# Test específico de BMP280
npm run sensors:test

# Ver ejemplos
npm run sensors:example
```

## 📈 Monitoreo Post-Deployment

### Health Check
```bash
curl http://localhost:4000/health
```

### GraphQL Playground
- URL: `http://localhost:4000/graphql`
- Disponible en desarrollo

### Logs
```bash
# Logs de aplicación
docker compose logs -f app

# Logs de base de datos
docker compose logs -f postgres

# Logs de Redis
docker compose logs -f redis
```

## 🎯 Resultado Esperado

Después del deployment exitoso:

```
✅ DEPLOYMENT EXITOSO - Todas las tablas están listas
🎉 Sistema de sensores dinámicos funcionando
📡 Backend listo para crear sensores BMP280 via GraphQL
🌡️ Tópico MQTT: Invernadero/BMP280-1/data
📊 Payload: {"temperatura":12.36,"presion":99167.67}
🚀 GraphQL API: http://localhost:4000/graphql
```

¡El sistema está completamente listo para usar sensores BMP280 dinámicos! 🎉