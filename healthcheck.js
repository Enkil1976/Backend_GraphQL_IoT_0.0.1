#!/usr/bin/env node

require('dotenv').config();
const http = require('http');
const { pool } = require('./src/config/database');

/**
 * Comprehensive health check for the IoT GraphQL Backend
 * Validates database connection, tables existence, and application health
 */

async function checkDatabase() {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    
    // Check critical tables exist
    const criticalTables = [
      'users', 'devices', 'rules', 'notifications', 
      'temhum1', 'temhum2', 'calidad_agua', 'luxometro'
    ];
    
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ANY($1)
    `, [criticalTables]);
    
    if (tableCheck.rows.length < criticalTables.length) {
      throw new Error(`Missing critical tables. Expected ${criticalTables.length}, found ${tableCheck.rows.length}`);
    }
    
    // Check devices table has required columns
    const devicesColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'devices' 
      AND column_name IN ('description', 'device_id', 'configuration')
    `);
    
    if (devicesColumns.rows.length < 3) {
      throw new Error('Missing required columns in devices table');
    }
    
    return { status: 'healthy', message: 'Database is properly configured' };
  } catch (error) {
    return { status: 'unhealthy', message: `Database check failed: ${error.message}` };
  }
}

async function checkApplication() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: process.env.PORT || 4001,
      path: '/health',
      method: 'GET',
      timeout: 5000
    };
    
    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        resolve({ status: 'healthy', message: 'Application is responding' });
      } else {
        resolve({ status: 'unhealthy', message: `Application returned status ${res.statusCode}` });
      }
    });
    
    req.on('error', (error) => {
      resolve({ status: 'unhealthy', message: `Application check failed: ${error.message}` });
    });
    
    req.on('timeout', () => {
      resolve({ status: 'unhealthy', message: 'Application check timed out' });
    });
    
    req.end();
  });
}

async function performHealthCheck() {
  try {
    const checks = await Promise.all([
      checkDatabase(),
      checkApplication()
    ]);
    
    const dbCheck = checks[0];
    const appCheck = checks[1];
    
    const isHealthy = dbCheck.status === 'healthy' && appCheck.status === 'healthy';
    
    const result = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbCheck,
        application: appCheck
      }
    };
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Health check result:', JSON.stringify(result, null, 2));
    }
    
    return result;
  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

// Run health check if called directly
if (require.main === module) {
  performHealthCheck()
    .then(result => {
      if (result.status === 'healthy') {
        console.log('✅ Health check passed');
        process.exit(0);
      } else {
        console.error('❌ Health check failed:', result);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Health check error:', error);
      process.exit(1);
    });
}

module.exports = { performHealthCheck };