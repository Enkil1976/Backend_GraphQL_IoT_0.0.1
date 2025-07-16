#!/usr/bin/env node

/**
 * Script simple para probar que el servidor GraphQL funciona básicamente
 */

// Configurar variables de entorno
process.env.NODE_ENV = 'development';
process.env.PORT = '4001';
process.env.PG_HOST = 'localhost';
process.env.PG_PORT = '5432';
process.env.PG_DATABASE = 'invernadero_iot';
process.env.PG_USER = 'postgres';
process.env.PG_PASSWORD = 'postgres123';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = 'redis123';
process.env.JWT_SECRET = 'super_secret_jwt_key_for_local_development_only_32_chars';
process.env.ACCESS_TOKEN_SECRET = 'access_token_secret_for_local_dev_different_from_jwt';
process.env.REFRESH_TOKEN_SECRET = 'refresh_token_secret_for_local_dev_unique_value';
process.env.GRAPHQL_INTROSPECTION = 'true';
process.env.GRAPHQL_PLAYGROUND = 'true';
process.env.GRAPHQL_DEBUG = 'true';

// Deshabilitar servicios que causan problemas
process.env.DISABLE_MQTT = 'true';
process.env.DISABLE_QUEUE = 'true';
process.env.DISABLE_RULES = 'true';

console.log('🚀 Iniciando servidor GraphQL simple...');

// Cargar el servidor principal
require('./src/server.js');