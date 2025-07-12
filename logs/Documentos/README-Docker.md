# Docker Setup para Backend GraphQL IoT

## Configuración Completada

El backend IoT está configurado para ejecutarse en Docker con los siguientes servicios:

### 🐳 Servicios Incluidos

1. **App (Backend GraphQL)** - Puerto 4001
   - Node.js 18 Alpine
   - GraphQL Apollo Server
   - Autenticación JWT
   - Subscriptions en tiempo real

2. **PostgreSQL** - Puerto 5432
   - PostgreSQL 14 Alpine
   - Base de datos: `invernadero_iot`
   - Persistencia de datos con volúmenes

3. **Redis** - Puerto 6379
   - Redis 7 Alpine
   - Cache y PubSub para GraphQL subscriptions
   - Persistencia con AOF

4. **PGAdmin** - Puerto 5050
   - Interfaz web para administrar PostgreSQL
   - Acceso: http://localhost:5050

### 🚀 Comandos Rápidos

```bash
# Iniciar todos los servicios
./docker-run.sh start

# Ver logs de la aplicación
./docker-run.sh logs-app

# Detener servicios
./docker-run.sh stop

# Reconstruir imágenes
./docker-run.sh build

# Ver estado de servicios
./docker-run.sh status

# Acceder al shell del contenedor
./docker-run.sh shell

# Conectar a PostgreSQL
./docker-run.sh psql

# Conectar a Redis
./docker-run.sh redis
```

### 🔧 Configuración de Entorno

Se han creado dos archivos de configuración:

1. **`.env`** - Para desarrollo local
2. **`.env.docker`** - Para Docker (copiado automáticamente)

### 📝 Variables de Entorno Importantes

```bash
# Configuración de servicios Docker
PG_HOST=postgres
PG_PORT=5432
PG_DATABASE=invernadero_iot

REDIS_HOST=redis
REDIS_PORT=6379

# MQTT externo (ya configurado)
MQTT_BROKER_URL=mqtts://Backend:11211121@sdb201a6.ala.us-east-1.emqxsl.com:8883

# Webhooks para notificaciones
WEBHOOK_URL=https://n8n-n8n.2h4eh9.easypanel.host/webhook/131ed66b-7e4e-4352-a680-a81f4a2dec4f
```

### 🌐 URLs Disponibles

- **GraphQL Playground**: http://localhost:4001/graphql
- **Health Check**: http://localhost:4001/health
- **PGAdmin**: http://localhost:5050
- **Métricas**: http://localhost:9090 (si está habilitado)

### 🔐 Credenciales por Defecto

**PostgreSQL:**
- Usuario: `postgres`
- Contraseña: `postgres`
- Base de datos: `invernadero_iot`

**Redis:**
- Contraseña: `redis_password`

**PGAdmin:**
- Email: `admin@example.com`
- Contraseña: `admin`

### 📊 Monitoreo

El sistema incluye:
- Health checks automáticos
- Logs centralizados
- Métricas de rendimiento
- Reconexión automática

### 🔧 Troubleshooting

**Si el build es lento:**
```bash
# Usar caché de Docker
docker compose build

# Limpiar y reconstruir
./docker-run.sh clean
./docker-run.sh build
```

**Si hay problemas de conexión:**
```bash
# Verificar logs
./docker-run.sh logs

# Verificar red
docker network ls
docker network inspect backend_graphql_iot_iot-network
```

**Para desarrollo:**
```bash
# Montar código fuente (ya configurado)
# Los cambios se reflejan automáticamente
./docker-run.sh logs-app
```

### 🔄 Proceso de Deployment

1. **Construir imágenes**: `./docker-run.sh build`
2. **Iniciar servicios**: `./docker-run.sh start`
3. **Verificar health**: `curl http://localhost:4001/health`
4. **Verificar GraphQL**: `curl http://localhost:4001/graphql`

### 📁 Estructura de Archivos

```
.
├── Dockerfile              # Imagen de la aplicación
├── docker-compose.yml      # Configuración de servicios
├── docker-run.sh          # Script de utilidades
├── .env.docker            # Variables para Docker
└── README-Docker.md       # Esta documentación
```

### 🎯 Próximos Pasos

1. Ejecutar `./docker-run.sh start` para iniciar
2. Verificar que todos los servicios estén activos
3. Probar las APIs GraphQL
4. Configurar el frontend para conectar a localhost:4001