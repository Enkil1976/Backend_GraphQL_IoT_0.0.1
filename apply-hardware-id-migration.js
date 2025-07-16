#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { query } = require('./src/config/database');

async function applyHardwareIdMigration() {
  try {
    console.log('🚀 Starting hardware_id migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_hardware_id_columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL file into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--') && !stmt.startsWith('SELECT'));
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        try {
          console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
          await query(statement);
          console.log(`✅ Statement ${i + 1} executed successfully`);
        } catch (error) {
          // Log error but continue - some statements might fail if columns already exist
          console.log(`⚠️  Statement ${i + 1} failed (might already exist): ${error.message}`);
        }
      }
    }
    
    console.log('✅ Hardware_id migration completed successfully!');
    
    // Test that the columns exist
    console.log('🔍 Verifying column additions...');
    
    const testTables = [
      'temp_pressure_data',
      'luxometro',
      'calidad_agua',
      'power_monitor_logs',
      'temhum1',
      'temhum2'
    ];
    
    for (const table of testTables) {
      try {
        const result = await query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = 'hardware_id'
        `, [table]);
        
        if (result.rows.length > 0) {
          console.log(`✅ ${table}: hardware_id column exists`);
        } else {
          console.log(`❌ ${table}: hardware_id column missing`);
        }
      } catch (error) {
        console.log(`⚠️  ${table}: Error checking column - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  applyHardwareIdMigration();
}

module.exports = applyHardwareIdMigration;