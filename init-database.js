#!/usr/bin/env node

require('dotenv').config();
const { pool } = require('./src/config/database');
const databaseInitService = require('./src/services/databaseInitService');

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
  console.log('🚀 Starting secure database initialization...');

  try {
    // Use the new enhanced database initialization service
    await databaseInitService.initialize();
    
    // Get final status
    const status = await databaseInitService.getStatus();
    
    console.log('\n📊 Database initialization status:');
    console.log(`✅ Connected: ${status.connected}`);
    console.log(`🔢 Schema Version: ${status.schema_version}`);
    console.log(`🔒 Security Tables: ${status.security_tables_ready ? 'Ready' : 'Not Ready'}`);
    
    if (status.tables) {
      const existingTables = status.tables.filter(t => t.exists);
      const missingTables = status.tables.filter(t => !t.exists);
      
      console.log(`📋 Tables: ${existingTables.length}/${status.tables.length} ready`);
      
      if (missingTables.length > 0) {
        console.log('⚠️  Missing tables:', missingTables.map(t => t.table).join(', '));
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Secure database initialization failed:', error);
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