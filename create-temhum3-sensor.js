#!/usr/bin/env node

const { query } = require('./src/config/database.js');

async function createTempHum3Sensor() {
  console.log('🌡️ Creating TempHum3 sensor...');
  
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
      'Sensor Temperatura y Humedad 3',
      'TEMHUM',
      'THM-003',
      'Invernadero/TemHum3/data',
      'Zona Terciaria Invernadero',
      'Sensor de temperatura y humedad ambiente terciario',
      JSON.stringify({
        payload_template: {
          temperatura: { type: 'float', required: true, min: -40, max: 80 },
          humedad: { type: 'float', required: true, min: 0, max: 100 },
          rssi: { type: 'int', required: false, min: -120, max: 0 }
        },
        sampling_interval: 30,
        retention_days: 90,
        example_payload: {
          temperatura: 8.52356,
          humedad: 59.53836,
          rssi: -83
        }
      }),
      true
    ]);
    
    console.log('✅ TempHum3 sensor created successfully!');
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
    console.log('Topic: Invernadero/TemHum3/data');
    console.log('Payload: {"temperatura":8.52356,"humedad":59.53836,"rssi":-83}');
    
  } catch (error) {
    console.error('❌ Error creating TempHum3 sensor:', error.message);
    
    // Check if sensor already exists
    try {
      const existing = await query('SELECT * FROM sensors WHERE hardware_id = $1', ['THM-003']);
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

createTempHum3Sensor().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});