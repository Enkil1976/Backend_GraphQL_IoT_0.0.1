#!/usr/bin/env node

/**
 * Script simple de inicialización de base de datos para Docker
 */

const { execSync } = require('child_process');

async function initializeDatabase() {
  try {
    console.log('🚀 Inicializando base de datos...');
    
    // Ejecutar solo la inicialización de base de datos sin servicios adicionales
    execSync('node init-database.js', { 
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PG_HOST: 'postgres',
        PG_PORT: '5432',
        PG_DATABASE: 'invernadero_iot',
        PG_USER: 'postgres',
        PG_PASSWORD: 'postgres123',
        REDIS_HOST: 'redis',
        REDIS_PORT: '6379',
        REDIS_PASSWORD: 'redis123'
      }
    });
    
    console.log('✅ Base de datos inicializada correctamente');
    
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error.message);
    process.exit(1);
  }
}

// Esperar un poco antes de comenzar para que PostgreSQL esté listo
setTimeout(initializeDatabase, 5000);