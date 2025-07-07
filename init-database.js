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

    // Check if setup is needed
    const usersTableExists = await checkTableExists('users');
    const devicesTableExists = await checkTableExists('devices');
    const deviceDescriptionExists = await checkColumnExists('devices', 'description');

    if (!usersTableExists || !devicesTableExists || !deviceDescriptionExists) {
      console.log('📋 Database setup required. Running setup-database.js...');
      
      // Import and run the setup function
      const { setupDatabase } = require('./setup-database');
      await setupDatabase();
      
      console.log('✅ Database setup completed successfully!');
    } else {
      console.log('✅ Database is already initialized!');
    }

    // Verify critical tables exist
    const criticalTables = [
      'users', 'devices', 'rules', 'notifications', 
      'temhum1', 'temhum2', 'calidad_agua', 'luxometro',
      'power_monitor_logs', 'rule_executions', 'weather_current'
    ];

    const missingTables = [];
    for (const table of criticalTables) {
      const exists = await checkTableExists(table);
      if (!exists) {
        missingTables.push(table);
      }
    }

    if (missingTables.length > 0) {
      console.log(`⚠️  Missing tables detected: ${missingTables.join(', ')}`);
      console.log('📋 Running full database setup...');
      
      const { setupDatabase } = require('./setup-database');
      await setupDatabase();
    }

    // Final verification
    const finalCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('\n📊 Database initialization complete!');
    console.log(`✅ ${finalCheck.rows.length} tables available:`);
    finalCheck.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    return true;

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
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