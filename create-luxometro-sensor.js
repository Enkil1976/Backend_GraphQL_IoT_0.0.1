#!/usr/bin/env node

const { query } = require('./src/config/database.js');

async function createLuxometroSensor() {
  try {
    console.log('🌡️ Creating luxometro sensor...');
    
    // Insert sensor into sensors table
    const result = await query(`
      INSERT INTO sensors (
        sensor_id, 
        name, 
        type, 
        description, 
        location, 
        mqtt_topic, 
        hardware_id, 
        table_name, 
        cache_key, 
        data_fields, 
        metrics_fields, 
        payload_template, 
        validation_rules, 
        is_active, 
        sampling_interval, 
        retention_days,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW()
      ) RETURNING *;
    `, [
      'luxometro',
      'Sensor de Luz Luxómetro',
      'LIGHT',
      'Sensor de luz ambiental que mide luminosidad, luz blanca y luz raw',
      'Invernadero Principal',
      'Invernadero/Luxometro/data',
      'LUX-001',
      'luxometro',
      'sensor_latest:luxometro',
      JSON.stringify(['light', 'white_light', 'raw_light']),
      JSON.stringify(['light', 'white_light', 'raw_light']),
      JSON.stringify({
        "light": {"type": "float", "required": true, "min": 0, "max": 100000},
        "white_light": {"type": "float", "required": false, "min": 0, "max": 100000},
        "raw_light": {"type": "float", "required": false, "min": 0, "max": 100000}
      }),
      JSON.stringify({
        "light": {"min": 0, "max": 100000},
        "white_light": {"min": 0, "max": 100000},
        "raw_light": {"min": 0, "max": 100000}
      }),
      true,
      30,
      90
    ]);
    
    console.log('✅ Luxometro sensor created successfully!');
    console.log('📋 Sensor details:');
    console.log(`   ID: ${result.rows[0].id}`);
    console.log(`   Sensor ID: ${result.rows[0].sensor_id}`);
    console.log(`   Name: ${result.rows[0].name}`);
    console.log(`   MQTT Topic: ${result.rows[0].mqtt_topic}`);
    console.log(`   Hardware ID: ${result.rows[0].hardware_id}`);
    console.log(`   Table: ${result.rows[0].table_name}`);
    
    // Verify the sensor was created
    const verification = await query('SELECT * FROM sensors WHERE sensor_id = $1', ['luxometro']);
    console.log(`🔍 Verification: Found ${verification.rows.length} sensor(s) with ID 'luxometro'`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating luxometro sensor:', error.message);
    
    // Check if sensor already exists
    try {
      const existing = await query('SELECT * FROM sensors WHERE sensor_id = $1', ['luxometro']);
      if (existing.rows.length > 0) {
        console.log('ℹ️  Sensor already exists:');
        console.log(`   Name: ${existing.rows[0].name}`);
        console.log(`   MQTT Topic: ${existing.rows[0].mqtt_topic}`);
        console.log(`   Active: ${existing.rows[0].is_active}`);
      }
    } catch (checkError) {
      console.error('❌ Error checking existing sensor:', checkError.message);
    }
    
    process.exit(1);
  }
}

createLuxometroSensor();