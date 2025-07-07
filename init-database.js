#!/usr/bin/env node

require('dotenv').config();
const { pool } = require('./src/config/database');

/**
 * Robust database initialization script for Docker deployment
 * This script ensures all tables and data are properly set up
 */

async function waitForDatabase(maxRetries = 30, delay = 2000) {
  console.log('🔄 Waiting for database to be ready...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('✅ Database is ready!');
      return true;
    } catch (error) {
      console.log(`⏳ Database not ready yet (attempt ${i + 1}/${maxRetries}). Retrying in ${delay/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`❌ Database failed to become ready after ${maxRetries} attempts`);
}

async function checkTableExists(tableName) {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, [tableName]);
    return result.rows[0].exists;
  } catch (error) {
    console.error(`Error checking table ${tableName}:`, error);
    return false;
  }
}

async function checkColumnExists(tableName, columnName) {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = $1 
        AND column_name = $2
      );
    `, [tableName, columnName]);
    return result.rows[0].exists;
  } catch (error) {
    console.error(`Error checking column ${columnName} in table ${tableName}:`, error);
    return false;
  }
}

async function initializeDatabase() {
  console.log('🚀 Starting database initialization...');

  try {
    // Wait for database to be ready
    await waitForDatabase();
    
    // Try to use the enhanced service, fallback to basic initialization
    try {
      const databaseInitService = require('./src/services/databaseInitService');
      await databaseInitService.initialize();
      
      const status = await databaseInitService.getStatus();
      console.log('\n📊 Enhanced database initialization completed');
      console.log(`✅ Connected: ${status.connected}`);
      console.log(`🔢 Schema Version: ${status.schema_version}`);
      console.log(`🔒 Security Tables: ${status.security_tables_ready ? 'Ready' : 'Not Ready'}`);
      
      return true;
    } catch (serviceError) {
      console.log('⚠️  Enhanced service not available, using basic initialization');
      console.log('Service error:', serviceError.message);
      
      // Basic initialization fallback
      await basicInitialization();
      return true;
    }

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

async function basicInitialization() {
  console.log('🔧 Running basic database initialization...');
  
  // Basic table creation queries
  const createTablesSQL = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Devices table
    CREATE TABLE IF NOT EXISTS devices (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(50) NOT NULL,
      description TEXT,
      location VARCHAR(100),
      status VARCHAR(20) DEFAULT 'offline',
      enable_notifications BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Rules table
    CREATE TABLE IF NOT EXISTS rules (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      condition_type VARCHAR(50) NOT NULL,
      condition_value JSONB NOT NULL,
      action_type VARCHAR(50) NOT NULL,
      action_value JSONB NOT NULL,
      enabled BOOLEAN DEFAULT true,
      priority INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Notifications table
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) NOT NULL,
      channel VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMP
    );

    -- Sensor data tables
    CREATE TABLE IF NOT EXISTS sensor_data_temhum1 (
      id SERIAL PRIMARY KEY,
      temperature DECIMAL(5,2),
      humidity DECIMAL(5,2),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sensor_data_temhum2 (
      id SERIAL PRIMARY KEY,
      temperature DECIMAL(5,2),
      humidity DECIMAL(5,2),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sensor_data_calidad_agua (
      id SERIAL PRIMARY KEY,
      ph DECIMAL(4,2),
      ec DECIMAL(8,2),
      tds DECIMAL(8,2),
      temperature DECIMAL(5,2),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sensor_data_luxometro (
      id SERIAL PRIMARY KEY,
      lux DECIMAL(10,2),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS weather_current (
      id SERIAL PRIMARY KEY,
      temperature DECIMAL(5,2),
      humidity DECIMAL(5,2),
      pressure DECIMAL(7,2),
      description TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Operations and audit tables
    CREATE TABLE IF NOT EXISTS operations_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      device_id INTEGER REFERENCES devices(id),
      operation VARCHAR(100) NOT NULL,
      parameters JSONB,
      result VARCHAR(20),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rule_executions (
      id SERIAL PRIMARY KEY,
      rule_id INTEGER REFERENCES rules(id),
      triggered_by VARCHAR(100),
      execution_result VARCHAR(20),
      details JSONB,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Basic admin user
    INSERT INTO users (username, email, password_hash, role) 
    VALUES ('admin', 'admin@localhost', '$2b$12$example_hash', 'admin') 
    ON CONFLICT (username) DO NOTHING;
  `;

  try {
    await pool.query(createTablesSQL);
    console.log('✅ Basic database schema created successfully');
    
    // Check tables
    const tables = ['users', 'devices', 'rules', 'notifications', 'sensor_data_temhum1'];
    for (const table of tables) {
      const exists = await checkTableExists(table);
      console.log(`📋 Table ${table}: ${exists ? '✅' : '❌'}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Basic initialization failed:', error);
    throw error;
  }
}

// Run initialization if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('🎉 Database initialization completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Database initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase, waitForDatabase };