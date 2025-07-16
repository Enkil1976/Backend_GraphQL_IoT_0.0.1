#!/usr/bin/env node

const { query } = require('./src/config/database.js');

async function createWaterQualitySensor() {
  console.log('💧 Creating water quality sensor...');
  
  try {
    // Create sensor directly in database
    const result = await query(`
      INSERT INTO sensors (
        name, sensor_type, hardware_id, mqtt_topic, 
        location, description, configuration, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      ) RETURNING *
    `, [
      'Sensor de Calidad de Agua',
      'WATER_QUALITY',
      'WQ-001',
      'Invernadero/Agua/data',
      'Sistema de Riego',
      'Sensor de pH, EC, PPM y temperatura del agua',
      JSON.stringify({
        payload_template: {
          ph: { type: 'float', required: true, min: 0, max: 14 },
          ec: { type: 'int', required: true, min: 0, max: 10000 },
          ppm: { type: 'int', required: true, min: 0, max: 10000 },
          temp: { type: 'float', required: true, min: -10, max: 50 }
        },
        sampling_interval: 60,
        retention_days: 180,
        example_payload: {
          ph: 5,
          ec: 1000,
          ppm: 1000,
          temp: 18
        }
      }),
      true
    ]);
    
    console.log('✅ Water quality sensor created successfully!');
    console.log('📋 Sensor details:');
    console.log(`   ID: ${result.rows[0].id}`);
    console.log(`   Name: ${result.rows[0].name}`);
    console.log(`   Hardware ID: ${result.rows[0].hardware_id}`);
    console.log(`   MQTT Topic: ${result.rows[0].mqtt_topic}`);
    console.log(`   Type: ${result.rows[0].sensor_type}`);
    console.log(`   Location: ${result.rows[0].location}`);
    console.log(`   Active: ${result.rows[0].is_active}`);
    
    // Test payload format
    console.log('\n🔍 Example payload structure:');
    console.log('Topic: Invernadero/Agua/data');
    console.log('Payload: {"ph": 5, "ec": 1000, "ppm": 1000, "temp": 18}');
    
  } catch (error) {
    console.error('❌ Error creating water quality sensor:', error.message);
    
    // Check if sensor already exists
    try {
      const existing = await query('SELECT * FROM sensors WHERE hardware_id = $1', ['WQ-001']);
      if (existing.rows.length > 0) {
        console.log('ℹ️  Sensor already exists:');
        console.log(`   Name: ${existing.rows[0].name}`);
        console.log(`   MQTT Topic: ${existing.rows[0].mqtt_topic}`);
        console.log(`   Active: ${existing.rows[0].is_active}`);
      }
    } catch (checkError) {
      console.error('❌ Error checking existing sensor:', checkError.message);
    }
  }
  
  process.exit(0);
}

createWaterQualitySensor().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});