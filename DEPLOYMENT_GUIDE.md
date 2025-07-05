# Deployment Guide - Backend GraphQL IoT

## Overview

This guide covers the complete deployment process for the GraphQL IoT Backend, including development, staging, and production environments.

## Prerequisites

### System Requirements
- **Node.js**: 16.x or higher
- **PostgreSQL**: 12.x or higher
- **Redis**: 6.x or higher
- **MQTT Broker**: Mosquitto 2.x or cloud provider
- **Memory**: Minimum 2GB RAM (4GB recommended for production)
- **Storage**: Minimum 20GB (SSD recommended)

### Required Services
- PostgreSQL database server
- Redis server (for caching and queues)
- MQTT broker (Mosquitto, EMQX, or cloud service)
- Optional: Reverse proxy (Nginx, Apache)
- Optional: Process manager (PM2, Docker)

## Environment Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd Backend_GraphQL_IoT

# Install dependencies
npm install

# Install global dependencies (optional)
npm install -g pm2
```

### 2. Database Setup

#### PostgreSQL Installation and Configuration

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS (using Homebrew)
brew install postgresql
brew services start postgresql

# Create database and user
sudo -u postgres psql
CREATE DATABASE invernadero_iot;
CREATE USER iot_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE invernadero_iot TO iot_user;
\q
```

#### Run Database Migrations

```bash
# Navigate to project directory
cd Backend_GraphQL_IoT

# Run SQL scripts in order
psql -h localhost -U iot_user -d invernadero_iot < ../Backend_Inv_IoT/sql/create_users_table.sql
psql -h localhost -U iot_user -d invernadero_iot < ../Backend_Inv_IoT/sql/create_devices_table.sql
psql -h localhost -U iot_user -d invernadero_iot < ../Backend_Inv_IoT/sql/create_temhum1_table.sql
psql -h localhost -U iot_user -d invernadero_iot < ../Backend_Inv_IoT/sql/create_temhum2_table.sql
psql -h localhost -U iot_user -d invernadero_iot < ../Backend_Inv_IoT/sql/create_calidad_agua_table.sql
psql -h localhost -U iot_user -d invernadero_iot < ../Backend_Inv_IoT/sql/create_power_monitor_logs_table.sql
psql -h localhost -U iot_user -d invernadero_iot < ../Backend_Inv_IoT/sql/create_rules_table.sql
psql -h localhost -U iot_user -d invernadero_iot < ../Backend_Inv_IoT/sql/create_scheduled_operations_table.sql
psql -h localhost -U iot_user -d invernadero_iot < ../Backend_Inv_IoT/sql/create_notifications_tables.sql
psql -h localhost -U iot_user -d invernadero_iot < ../Backend_Inv_IoT/sql/configure_chile_timezone.sql
psql -h localhost -U iot_user -d invernadero_iot < sql/create_user_configurations_table.sql

# Insert initial admin user (optional)
psql -h localhost -U iot_user -d invernadero_iot -c "
INSERT INTO users (username, email, password, role, is_active, created_at) 
VALUES ('admin', 'admin@example.com', '$2b$12$hash_here', 'admin', true, NOW());"
```

### 3. Redis Setup

#### Installation
```bash
# Ubuntu/Debian
sudo apt install redis-server

# macOS (using Homebrew)
brew install redis
brew services start redis

# Verify installation
redis-cli ping
```

#### Configuration for Production
```bash
# Edit Redis configuration
sudo nano /etc/redis/redis.conf

# Key settings for production:
# bind 127.0.0.1
# requirepass your_redis_password
# maxmemory 2gb
# maxmemory-policy allkeys-lru
# save 900 1
# save 300 10
# save 60 10000

# Restart Redis
sudo systemctl restart redis
```

### 4. MQTT Broker Setup

#### Option A: Local Mosquitto Installation
```bash
# Ubuntu/Debian
sudo apt install mosquitto mosquitto-clients

# Create configuration
sudo nano /etc/mosquitto/mosquitto.conf

# Basic configuration:
listener 1883
allow_anonymous false
password_file /etc/mosquitto/passwd

# Create user
sudo mosquitto_passwd -c /etc/mosquitto/passwd iot_user

# Start service
sudo systemctl start mosquitto
sudo systemctl enable mosquitto
```

#### Option B: Cloud MQTT Service
Use services like:
- **EMQX Cloud**: https://www.emqx.com/en/cloud
- **HiveMQ Cloud**: https://www.hivemq.com/mqtt-cloud-broker/
- **AWS IoT Core**: https://aws.amazon.com/iot-core/

## Environment Configuration

### 1. Create Environment File

```bash
# Copy example environment file
cp .env.example .env

# Generate secure secrets
openssl rand -hex 64  # For JWT_SECRET
openssl rand -hex 64  # For ACCESS_TOKEN_SECRET
openssl rand -hex 64  # For REFRESH_TOKEN_SECRET
```

### 2. Production Environment Variables

Create `.env` file with production values:

```bash
# Application Configuration
NODE_ENV=production
PORT=4000

# JWT Secrets (CRITICAL: Use generated secrets)
JWT_SECRET=your_generated_jwt_secret_64_chars
ACCESS_TOKEN_SECRET=your_generated_access_secret_64_chars
REFRESH_TOKEN_SECRET=your_generated_refresh_secret_64_chars

# Database Configuration (with SSL for production)
PG_URI=postgresql://iot_user:secure_password@localhost:5432/invernadero_iot?sslmode=require
PG_SSL=true

# Redis Configuration (with password)
REDIS_URL=redis://:redis_password@localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# MQTT Configuration (with SSL)
MQTT_BROKER_URL=mqtts://your-broker:8883
MQTT_USERNAME=iot_user
MQTT_PASSWORD=mqtt_password

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# CORS Configuration (specify exact domains)
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# External APIs
WEATHER_API_KEY=your_weather_api_key
WEBHOOK_URL=https://your-webhook.com/notifications
WEBHOOK_SECRET=your_webhook_secret

# Email Configuration (for notifications)
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your_email@gmail.com
EMAIL_SMTP_PASS=your_app_password

# Telegram Bot (for notifications)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id

# Production Settings
GRAPHQL_INTROSPECTION=false
GRAPHQL_PLAYGROUND=false
DEBUG_ENABLED=false

# Monitoring
LOG_LEVEL=info
LOG_FILE=./logs/app.log
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=true

# Security Headers
HELMET_CSP_ENABLED=true
HELMET_HSTS_ENABLED=true
HELMET_NOSNIFF_ENABLED=true
```

## Deployment Methods

### Option 1: Traditional Server Deployment

#### 1. Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'graphql-iot-backend',
    script: 'src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    env_production: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

# Start application with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

#### 2. Using systemd Service

```bash
# Create systemd service file
sudo nano /etc/systemd/system/graphql-iot.service

# Service configuration:
[Unit]
Description=GraphQL IoT Backend
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=iot
WorkingDirectory=/path/to/Backend_GraphQL_IoT
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=graphql-iot

[Install]
WantedBy=multi-user.target

# Enable and start service
sudo systemctl enable graphql-iot
sudo systemctl start graphql-iot
sudo systemctl status graphql-iot
```

### Option 2: Docker Deployment

#### 1. Create Dockerfile

```dockerfile
# Dockerfile
FROM node:16-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["npm", "start"]
```

#### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  graphql-backend:
    build: .
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - PORT=4000
    env_file:
      - .env
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    networks:
      - iot-network

  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: invernadero_iot
      POSTGRES_USER: iot_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./sql:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - iot-network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass redis_password
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - iot-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - graphql-backend
    restart: unless-stopped
    networks:
      - iot-network

volumes:
  postgres_data:
  redis_data:

networks:
  iot-network:
    driver: bridge
```

#### 3. Deploy with Docker

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f graphql-backend

# Scale backend instances
docker-compose up -d --scale graphql-backend=3
```

### Option 3: Cloud Deployment

#### AWS Deployment with ECS

1. **Create ECR Repository**
```bash
aws ecr create-repository --repository-name graphql-iot-backend
```

2. **Build and Push Docker Image**
```bash
# Build image
docker build -t graphql-iot-backend .

# Tag for ECR
docker tag graphql-iot-backend:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/graphql-iot-backend:latest

# Push to ECR
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/graphql-iot-backend:latest
```

3. **Create ECS Task Definition**
```json
{
  "family": "graphql-iot-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::123456789:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "graphql-backend",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/graphql-iot-backend:latest",
      "portMappings": [
        {
          "containerPort": 4000,
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
          "valueFrom": "arn:aws:ssm:us-east-1:123456789:parameter/jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/graphql-iot-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

## Reverse Proxy Configuration

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/graphql-iot
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # GraphQL HTTP endpoint
    location /graphql {
        proxy_pass http://localhost:4000/graphql;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:4000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Rate limiting
    location / {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:4000;
    }
}

# Rate limiting configuration (add to http block)
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
}
```

## SSL/TLS Configuration

### Option 1: Let's Encrypt (Free)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal (add to crontab)
0 12 * * * /usr/bin/certbot renew --quiet
```

### Option 2: Commercial Certificate

```bash
# Generate private key
openssl genrsa -out private.key 2048

# Generate certificate signing request
openssl req -new -key private.key -out cert.csr

# Submit CSR to certificate authority
# Install certificate files to /etc/nginx/ssl/
```

## Monitoring and Logging

### 1. Application Logging

```bash
# Create log directory
mkdir -p /var/log/graphql-iot

# Configure log rotation
sudo nano /etc/logrotate.d/graphql-iot

# Logrotate configuration:
/var/log/graphql-iot/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 0644 nodejs nodejs
    postrotate
        killall -SIGUSR1 node
    endscript
}
```

### 2. Health Monitoring

```bash
# Create health check script
cat > health-check.sh << 'EOF'
#!/bin/bash
HEALTH_URL="http://localhost:4000/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "Service is healthy"
    exit 0
else
    echo "Service is unhealthy (HTTP $RESPONSE)"
    exit 1
fi
EOF

chmod +x health-check.sh

# Add to crontab for monitoring
*/5 * * * * /path/to/health-check.sh
```

### 3. Performance Monitoring

Install and configure monitoring tools:

```bash
# Install Node.js monitoring tools
npm install -g clinic
npm install -g 0x

# Performance profiling
clinic doctor -- node src/server.js
clinic bubbleprof -- node src/server.js
```

## Security Hardening

### 1. Server Security

```bash
# Update system packages
sudo apt update && sudo apt upgrade

# Configure firewall
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 4000/tcp # GraphQL (if direct access needed)
sudo ufw enable

# Disable unused services
sudo systemctl disable apache2
sudo systemctl disable sendmail
```

### 2. Application Security

```bash
# Set proper file permissions
chmod 600 .env
chmod 644 package.json
chmod 755 src/

# Create dedicated user
sudo useradd -r -s /bin/false iot-backend
sudo chown -R iot-backend:iot-backend /path/to/Backend_GraphQL_IoT
```

### 3. Database Security

```bash
# PostgreSQL security
sudo nano /etc/postgresql/14/main/postgresql.conf

# Key security settings:
# listen_addresses = 'localhost'
# ssl = on
# log_connections = on
# log_disconnections = on
# log_statement = 'all'

# Restart PostgreSQL
sudo systemctl restart postgresql
```

## Backup and Recovery

### 1. Database Backup

```bash
# Create backup script
cat > backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/postgresql"
DB_NAME="invernadero_iot"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

pg_dump -h localhost -U iot_user $DB_NAME | gzip > "$BACKUP_DIR/backup_$DATE.sql.gz"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
EOF

chmod +x backup-db.sh

# Schedule daily backup
echo "0 2 * * * /path/to/backup-db.sh" | crontab -
```

### 2. Redis Backup

```bash
# Redis backup script
cat > backup-redis.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/redis"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Create Redis backup
redis-cli BGSAVE
sleep 5
cp /var/lib/redis/dump.rdb "$BACKUP_DIR/dump_$DATE.rdb"

# Keep only last 7 days
find $BACKUP_DIR -name "dump_*.rdb" -mtime +7 -delete
EOF

chmod +x backup-redis.sh
```

### 3. Application Backup

```bash
# Application code backup
cat > backup-app.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/application"
APP_DIR="/path/to/Backend_GraphQL_IoT"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Create application backup
tar -czf "$BACKUP_DIR/app_$DATE.tar.gz" -C $(dirname $APP_DIR) $(basename $APP_DIR) \
  --exclude=node_modules \
  --exclude=logs \
  --exclude=.git

# Keep only last 30 days
find $BACKUP_DIR -name "app_*.tar.gz" -mtime +30 -delete
EOF

chmod +x backup-app.sh
```

## Testing Deployment

### 1. Basic Functionality Tests

```bash
# Test health endpoint
curl http://localhost:4000/health

# Test GraphQL endpoint
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ health { status } }"}'

# Test authentication
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { login(username: \"admin\", password: \"password\") { token } }"}'
```

### 2. Load Testing

```bash
# Install load testing tool
npm install -g artillery

# Create load test configuration
cat > load-test.yml << 'EOF'
config:
  target: 'http://localhost:4000'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "Health Check"
    requests:
      - get:
          url: "/health"
  - name: "GraphQL Query"
    requests:
      - post:
          url: "/graphql"
          json:
            query: "{ health { status } }"
EOF

# Run load test
artillery run load-test.yml
```

## Troubleshooting

### Common Issues

1. **Port already in use**
```bash
# Check what's using port 4000
sudo lsof -i :4000
sudo netstat -tulpn | grep :4000

# Kill process if needed
sudo kill -9 <PID>
```

2. **Database connection failed**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -h localhost -U iot_user -d invernadero_iot -c "SELECT 1;"
```

3. **Redis connection failed**
```bash
# Check Redis status
sudo systemctl status redis

# Test connection
redis-cli ping
```

4. **MQTT connection failed**
```bash
# Test MQTT broker
mosquitto_pub -h localhost -t test/topic -m "Hello World"
mosquitto_sub -h localhost -t test/topic
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=* NODE_ENV=development npm start

# Check application logs
tail -f logs/app.log

# Monitor system resources
htop
iostat -x 1
```

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review application logs
   - Check disk space usage
   - Verify backup integrity
   - Update security patches

2. **Monthly**
   - Update Node.js dependencies
   - Review database performance
   - Analyze error patterns
   - Security audit

3. **Quarterly**
   - Major version updates
   - Performance optimization
   - Disaster recovery testing
   - Documentation updates

### Monitoring Checklist

- [ ] Application health endpoint responding
- [ ] Database connections stable
- [ ] Redis performance metrics
- [ ] MQTT message processing
- [ ] SSL certificate validity
- [ ] Backup completion status
- [ ] Log file rotation
- [ ] Resource usage (CPU, memory, disk)
- [ ] Error rates and patterns
- [ ] Response time metrics

This deployment guide provides a comprehensive approach to deploying the GraphQL IoT Backend in various environments. Choose the deployment method that best fits your infrastructure and requirements.