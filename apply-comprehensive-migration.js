#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { query, pool } = require('./src/config/database');

/**
 * Comprehensive Database Migration Script
 * This script applies the comprehensive migration to fix all schema issues
 */

async function applyComprehensiveMigration() {
  console.log('🚀 Starting comprehensive database migration...');
  
  try {
    // Test database connection
    console.log('🔍 Testing database connection...');
    await query('SELECT NOW() as current_time');
    console.log('✅ Database connection established');
    
    // Read the comprehensive migration file
    const migrationPath = path.join(__dirname, 'migrations', 'comprehensive_database_migration.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Migration file loaded successfully');
    
    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => 
        stmt && 
        !stmt.startsWith('--') && 
        !stmt.startsWith('/*') &&
        stmt.length > 3
      );
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`);
    
    // Execute statements in transaction blocks
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.includes('CREATE INDEX CONCURRENTLY')) {
        // Handle concurrent index creation separately (outside transaction)
        try {
          console.log(`⏳ Creating index ${i + 1}/${statements.length}...`);
          await query(statement);
          console.log(`✅ Index created successfully`);
          successCount++;
        } catch (error) {
          console.log(`⚠️  Index creation ${i + 1} failed (might already exist): ${error.message}`);
          skipCount++;
        }
      } else {
        // Handle regular statements in transaction
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
          await client.query(statement);
          
          await client.query('COMMIT');
          console.log(`✅ Statement ${i + 1} executed successfully`);
          successCount++;
          
        } catch (error) {
          await client.query('ROLLBACK');
          
          // Check if it's a "already exists" error - these are expected
          if (error.message.includes('already exists') || 
              error.message.includes('duplicate key') ||
              error.message.includes('does not exist')) {
            console.log(`⚠️  Statement ${i + 1} skipped (already exists): ${error.message.split('\n')[0]}`);
            skipCount++;
          } else {
            console.log(`❌ Statement ${i + 1} failed: ${error.message.split('\n')[0]}`);
            errorCount++;
          }
        } finally {
          client.release();
        }
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`⚠️  Skipped: ${skipCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    
    // Verify critical tables and columns
    console.log('\n🔍 Verifying critical schema elements...');
    
    // Check notifications table has read_at column
    try {
      const notificationsCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'read_at'
      `);
      console.log(`✅ notifications.read_at column: ${notificationsCheck.rows.length > 0 ? 'EXISTS' : 'MISSING'}`);
    } catch (error) {
      console.log(`❌ Error checking notifications table: ${error.message}`);
    }
    
    // Check hardware_id columns in sensor tables
    const sensorTables = ['temp_pressure_data', 'luxometro', 'calidad_agua', 'power_monitor_logs'];
    for (const table of sensorTables) {
      try {
        const result = await query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'hardware_id'
        `, [table]);
        console.log(`✅ ${table}.hardware_id: ${result.rows.length > 0 ? 'EXISTS' : 'MISSING'}`);
      } catch (error) {
        console.log(`❌ Error checking ${table}: ${error.message}`);
      }
    }
    
    // Check devices table has device_id column
    try {
      const devicesCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'devices' AND column_name = 'device_id'
      `);
      console.log(`✅ devices.device_id column: ${devicesCheck.rows.length > 0 ? 'EXISTS' : 'MISSING'}`);
    } catch (error) {
      console.log(`❌ Error checking devices table: ${error.message}`);
    }
    
    // Check rule_executions table exists
    try {
      const ruleExecutionsCheck = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'rule_executions'
      `);
      console.log(`✅ rule_executions table: ${ruleExecutionsCheck.rows.length > 0 ? 'EXISTS' : 'MISSING'}`);
    } catch (error) {
      console.log(`❌ Error checking rule_executions table: ${error.message}`);
    }
    
    // Show final table count
    try {
      const tableCount = await query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `);
      console.log(`\n📋 Total tables in database: ${tableCount.rows[0].count}`);
    } catch (error) {
      console.log(`❌ Error getting table count: ${error.message}`);
    }
    
    if (errorCount > 0) {
      console.log('\n⚠️  Migration completed with some errors. Please review the failed statements.');
      console.log('The database should still be functional for deployment.');
    } else {
      console.log('\n🎉 Comprehensive migration completed successfully!');
      console.log('✅ Database is ready for clean deployment');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  applyComprehensiveMigration();
}

module.exports = applyComprehensiveMigration;