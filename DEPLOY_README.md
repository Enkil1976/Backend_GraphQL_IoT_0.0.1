# 🚀 Deploy Guide - Backend GraphQL IoT

## 📋 Opciones de Deploy

Este backend GraphQL puede desplegarse de múltiples formas:

1. **[Deploy Standalone](#deploy-standalone)** - Solo el backend GraphQL
2. **[Deploy en Heroku](#deploy-en-heroku)** - Plataforma como servicio
3. **[Deploy con Docker](#deploy-con-docker)** - Contenedores locales
4. **[Deploy en AWS/GCP](#deploy-en-cloud)** - Proveedores cloud
5. **[Deploy en Servidor VPS](#deploy-en-vps)** - Servidor privado

---

## 🎯 Deploy Standalone

### **Configuración Rápida**

```bash
# 1. Configurar variables de entorno
cp .env.example .env
nano .env

# 2. Instalar dependencias
npm install

# 3. Ejecutar tests
npm test

# 4. Iniciar en producción
npm start
```

### **Variables de Entorno Mínimas**

```bash
# Obligatorias
NODE_ENV=production
PORT=4001
JWT_SECRET=tu_jwt_secret_32_caracteres_minimo
PG_URI=postgresql://user:pass@host:port/db
REDIS_URL=redis://host:port

# Opcionales pero recomendadas
MQTT_BROKER_URL=mqtt://broker:1883
WEATHER_API_KEY=tu_weather_api_key
```

---

## ☁️ Deploy en Heroku

### **1. Preparación**

```bash
# Instalar Heroku CLI
npm install -g heroku

# Login
heroku login

# Crear aplicación
heroku create tu-backend-graphql-iot
```

### **2. Configurar Add-ons**

```bash
# PostgreSQL
heroku addons:create heroku-postgresql:mini

# Redis
heroku addons:create heroku-redis:mini

# MQTT (CloudAMQP como alternativa)
heroku addons:create cloudamqp:lemur
```

### **3. Configurar Variables**

```bash
# Secrets de seguridad
heroku config:set JWT_SECRET=$(openssl rand -hex 32)
heroku config:set ACCESS_TOKEN_SECRET=$(openssl rand -hex 32)
heroku config:set REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)

# Configuración de aplicación
heroku config:set NODE_ENV=production
heroku config:set GRAPHQL_INTROSPECTION=false
heroku config:set GRAPHQL_PLAYGROUND=false

# APIs externas
heroku config:set WEATHER_API_KEY=tu_weather_api_key
```

### **4. Deploy**

```bash
# Deploy desde Git
git add .
git commit -m "Deploy to Heroku"
git push heroku main

# Ver logs
heroku logs --tail

# Escalar
heroku ps:scale web=1
```

### **5. Configurar Base de Datos**

```bash
# Ejecutar migraciones SQL
heroku pg:psql < sql/create_users_table.sql
heroku pg:psql < sql/create_devices_table.sql
# ... resto de archivos SQL
```

**Procfile:**
```
web: npm start
```

---

## 🐳 Deploy con Docker

### **1. Deploy Local con Docker Compose**

```bash
# Configurar variables
cp .env.example .env

# Iniciar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f backend-graphql

# Verificar salud
curl http://localhost:4001/health
```

### **2. Solo el Backend (con servicios externos)**

```bash
# Build de la imagen
docker build -t backend-graphql-iot .

# Ejecutar contenedor
docker run -d \
  --name graphql-backend \
  -p 4001:4001 \
  --env-file .env \
  backend-graphql-iot

# Con herramientas de administración
docker-compose --profile admin up -d
```

### **3. Verificación del Deploy**

```bash
# Health check
curl http://localhost:4001/health

# GraphQL Playground (desarrollo)
open http://localhost:4001/graphql

# pgAdmin
open http://localhost:5050
```

---

## ☁️ Deploy en Cloud

### **AWS ECS/Fargate**

```yaml
# task-definition.json
{
  "family": "backend-graphql-iot",
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "backend-graphql",
      "image": "tu-repo/backend-graphql-iot:latest",
      "portMappings": [
        {
          "containerPort": 4001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:jwt-secret"
        }
      ]
    }
  ]
}
```

### **Google Cloud Run**

```bash
# Build y push
gcloud builds submit --tag gcr.io/PROJECT_ID/backend-graphql-iot

# Deploy
gcloud run deploy backend-graphql-iot \
  --image gcr.io/PROJECT_ID/backend-graphql-iot \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets JWT_SECRET=jwt-secret:latest
```

### **Azure Container Instances**

```bash
# Crear grupo de recursos
az group create --name iot-backend --location eastus

# Deploy contenedor
az container create \
  --resource-group iot-backend \
  --name backend-graphql-iot \
  --image tu-repo/backend-graphql-iot:latest \
  --ports 4001 \
  --environment-variables NODE_ENV=production \
  --secure-environment-variables JWT_SECRET=tu_secret
```

---

## 🖥️ Deploy en Servidor VPS

### **1. Configuración del Servidor**

```bash
# Ubuntu 20.04+
sudo apt update && sudo apt upgrade -y

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.0.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### **2. Configuración de Servicios**

```bash
# PostgreSQL
sudo apt install postgresql postgresql-contrib
sudo -u postgres createdb invernadero_iot
sudo -u postgres createuser -s iot_user
sudo -u postgres psql -c "ALTER USER iot_user PASSWORD 'secure_password';"

# Redis
sudo apt install redis-server
sudo systemctl enable redis-server

# MQTT (Mosquitto)
sudo apt install mosquitto mosquitto-clients
sudo systemctl enable mosquitto
```

### **3. Deploy de la Aplicación**

```bash
# Clonar código
git clone https://github.com/tu-usuario/Backend_GraphQL_IoT.git
cd Backend_GraphQL_IoT

# Configurar variables
cp .env.example .env
nano .env

# Instalar dependencias
npm ci --production

# Crear servicio systemd
sudo tee /etc/systemd/system/backend-graphql-iot.service > /dev/null <<EOF
[Unit]
Description=Backend GraphQL IoT
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/Backend_GraphQL_IoT
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Habilitar y iniciar servicio
sudo systemctl daemon-reload
sudo systemctl enable backend-graphql-iot
sudo systemctl start backend-graphql-iot
```

### **4. Configurar Nginx (Reverse Proxy)**

```nginx
# /etc/nginx/sites-available/backend-graphql-iot
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/backend-graphql-iot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL con Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

---

## 🔧 Configuraciones Avanzadas

### **Auto-Deploy con GitHub Actions**

```yaml
# .github/workflows/deploy.yml
name: Deploy Backend GraphQL

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Deploy to Heroku
      uses: akhileshns/heroku-deploy@v3.12.12
      with:
        heroku_api_key: ${{secrets.HEROKU_API_KEY}}
        heroku_app_name: "tu-backend-graphql-iot"
        heroku_email: "tu-email@example.com"
```

### **Monitoreo con PM2**

```bash
# Instalar PM2
npm install -g pm2

# Crear ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'backend-graphql-iot',
    script: 'src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 4001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Iniciar con PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### **Configuración de SSL/TLS**

```bash
# Generar certificados auto-firmados (desarrollo)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Configurar en .env
SSL_ENABLED=true
SSL_CERT_PATH=./cert.pem
SSL_KEY_PATH=./key.pem
```

---

## 📊 Verificación y Monitoreo

### **Health Checks**

```bash
# Health endpoint
curl http://tu-dominio.com/health

# Respuesta esperada
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "redis": "connected",
    "mqtt": "connected"
  },
  "uptime": "2h 30m",
  "version": "1.0.0"
}
```

### **GraphQL Introspection**

```bash
# Query de introspección
curl -X POST http://tu-dominio.com/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ __schema { types { name } } }"
  }'
```

### **Logs y Debugging**

```bash
# Ver logs (Docker)
docker-compose logs -f backend-graphql

# Ver logs (Systemd)
sudo journalctl -u backend-graphql-iot -f

# Ver logs (PM2)
pm2 logs backend-graphql-iot

# Ver logs de aplicación
tail -f logs/app.log
```

---

## 🚨 Troubleshooting

### **Problemas Comunes**

1. **Puerto en uso**
   ```bash
   # Verificar puerto
   netstat -tulpn | grep :4001
   # Cambiar puerto en .env
   PORT=4002
   ```

2. **Base de datos no conecta**
   ```bash
   # Verificar conexión
   pg_isready -h localhost -p 5432
   # Verificar variables PG_*
   ```

3. **Redis no disponible**
   ```bash
   # Verificar Redis
   redis-cli ping
   # Verificar REDIS_URL
   ```

4. **MQTT desconectado**
   ```bash
   # Test MQTT
   mosquitto_pub -h localhost -t test -m "hello"
   # Verificar MQTT_BROKER_URL
   ```

### **Performance Tuning**

```bash
# Variables de optimización
NODE_OPTIONS="--max-old-space-size=2048"
UV_THREADPOOL_SIZE=128

# PM2 cluster mode
pm2 start ecosystem.config.js --instances max
```

---

## ✅ Checklist de Deploy

- [ ] Variables de entorno configuradas
- [ ] Secretos JWT generados (32+ caracteres)
- [ ] Base de datos inicializada
- [ ] Migraciones SQL ejecutadas
- [ ] Redis configurado
- [ ] MQTT broker disponible
- [ ] Tests pasando
- [ ] Health checks funcionando
- [ ] SSL configurado (producción)
- [ ] Firewall configurado
- [ ] Backups configurados
- [ ] Monitoreo configurado
- [ ] Logs configurados

**¡El backend GraphQL está listo para producción!**