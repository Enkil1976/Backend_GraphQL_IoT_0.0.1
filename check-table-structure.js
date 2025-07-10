#!/usr/bin/env node

/**
 * Script to check table structures for hardware_id column issues
 */

const { query } = require('./src/config/database');

async function checkTableStructures() {
  console.log('🔍 Checking table structures for hardware_id column issues...\n');

  try {
    // Check luxometro table structure
    console.log('📊 Checking luxometro table structure:');
    const luxometroColumns = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'luxometro' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    if (luxometroColumns.rows.length === 0) {
      console.log('❌ luxometro table does not exist');
    } else {
      console.log('✅ luxometro table columns:');
      luxometroColumns.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }

    // Check temp_pressure_data table structure
    console.log('\n📊 Checking temp_pressure_data table structure:');
    const tempPressureColumns = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'temp_pressure_data' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    if (tempPressureColumns.rows.length === 0) {
      console.log('❌ temp_pressure_data table does not exist');
    } else {
      console.log('✅ temp_pressure_data table columns:');
      tempPressureColumns.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }

    // Check other sensor tables that might have hardware_id
    console.log('\n📊 Checking other sensor tables for hardware_id column:');
    const sensorTables = [
      'temhum1', 'temhum2', 'calidad_agua', 'power_monitor_logs',
      'sensor_data_generic', 'soil_moisture_data', 'co2_data', 'motion_data', 'custom_sensor_data'
    ];

    for (const tableName of sensorTables) {
      const tableExists = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName]);

      if (tableExists.rows[0].exists) {
        const hardwareIdColumn = await query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = $1 
            AND column_name = 'hardware_id'
            AND table_schema = 'public'
          )
        `, [tableName]);

        const hasHardwareId = hardwareIdColumn.rows[0].exists;
        console.log(`   - ${tableName}: ${hasHardwareId ? '✅ HAS hardware_id' : '❌ NO hardware_id'}`);
      } else {
        console.log(`   - ${tableName}: ❌ Table does not exist`);
      }
    }

    // Check sensors registry table
    console.log('\n📊 Checking sensors registry table:');
    const sensorsTableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sensors'
      )
    `);

    if (sensorsTableExists.rows[0].exists) {
      const sensorsColumns = await query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'sensors' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);

      console.log('✅ sensors table columns:');
      sensorsColumns.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('❌ sensors table does not exist');
    }

    console.log('\n🔍 Analysis complete!');

  } catch (error) {
    console.error('❌ Error checking table structures:', error);
  }
}

// Run the check
checkTableStructures().catch(error => {
  console.error('❌ Critical error:', error);
  process.exit(1);
});