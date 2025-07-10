#!/usr/bin/env node

const { query } = require('./src/config/database.js');

async function createAllSensors() {
  console.log('🌡️ Creating all missing sensors...');
  
  const sensors = [
    {
      sensor_id: 'temhum1',
      name: 'Sensor Temperatura y Humedad 1',
      type: 'TEMPERATURE_HUMIDITY',
      description: 'Sensor de temperatura y humedad ambiente principal',
      location: 'Zona Principal Invernadero',
      mqtt_topic: 'Invernadero/TempHum1/data',
      hardware_id: 'THM-001',
      table_name: 'temhum1',
      cache_key: 'sensor_latest:temhum1',
      data_fields: ['temperature', 'humidity', 'rssi', 'boot', 'mem'],
      metrics_fields: ['temperature', 'humidity'],
      payload_template: {
        "temperature": {"type": "float", "required": true, "min": -40, "max": 80},
        "humidity": {"type": "float", "required": true, "min": 0, "max": 100},
        "rssi": {"type": "int", "required": false, "min": -120, "max": 0},
        "boot": {"type": "int", "required": false, "min": 0},
        "mem": {"type": "int", "required": false, "min": 0}
      },
      validation_rules: {
        "temperature": {"min": -40, "max": 80},
        "humidity": {"min": 0, "max": 100}
      }
    },
    {
      sensor_id: 'temhum2',
      name: 'Sensor Temperatura y Humedad 2',
      type: 'TEMPERATURE_HUMIDITY',
      description: 'Sensor de temperatura y humedad secundario',
      location: 'Zona Secundaria Invernadero',
      mqtt_topic: 'Invernadero/TempHum2/data',
      hardware_id: 'THM-002',
      table_name: 'temhum2',
      cache_key: 'sensor_latest:temhum2',
      data_fields: ['temperature', 'humidity', 'rssi', 'boot', 'mem'],
      metrics_fields: ['temperature', 'humidity'],
      payload_template: {
        "temperature": {"type": "float", "required": true, "min": -40, "max": 80},
        "humidity": {"type": "float", "required": true, "min": 0, "max": 100},
        "rssi": {"type": "int", "required": false, "min": -120, "max": 0},
        "boot": {"type": "int", "required": false, "min": 0},
        "mem": {"type": "int", "required": false, "min": 0}
      },
      validation_rules: {
        "temperature": {"min": -40, "max": 80},
        "humidity": {"min": 0, "max": 100}
      }
    },
    {
      sensor_id: 'bmp280-1',
      name: 'Sensor BMP280 Presión y Temperatura',
      type: 'PRESSURE_TEMPERATURE',
      description: 'Sensor de presión atmosférica y temperatura BMP280',
      location: 'Estación Meteorológica',
      mqtt_topic: 'Invernadero/BMP280-1/data',
      hardware_id: 'BMP-001',
      table_name: 'temp_pressure_data',
      cache_key: 'sensor_latest:bmp280-1',
      data_fields: ['temperature', 'pressure', 'altitude', 'rssi', 'boot', 'mem'],
      metrics_fields: ['temperature', 'pressure', 'altitude'],
      payload_template: {
        "temperature": {"type": "float", "required": true, "min": -40, "max": 80},
        "pressure": {"type": "float", "required": true, "min": 300, "max": 1200},
        "altitude": {"type": "float", "required": false, "min": -500, "max": 10000},
        "rssi": {"type": "int", "required": false, "min": -120, "max": 0},
        "boot": {"type": "int", "required": false, "min": 0},
        "mem": {"type": "int", "required": false, "min": 0}
      },
      validation_rules: {
        "temperature": {"min": -40, "max": 80},
        "pressure": {"min": 300, "max": 1200},
        "altitude": {"min": -500, "max": 10000}
      }
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const sensor of sensors) {
    try {
      console.log(`\n🔧 Creating sensor: ${sensor.name}...`);
      
      const result = await query(`
        INSERT INTO sensors (
          name, sensor_type, description, location, mqtt_topic, 
          hardware_id, configuration, is_active, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW()
        ) RETURNING *;
      `, [
        sensor.name,
        sensor.type,
        sensor.description,
        sensor.location,
        sensor.mqtt_topic,
        sensor.hardware_id,
        JSON.stringify({
          table_name: sensor.table_name,
          data_fields: sensor.data_fields,
          metrics_fields: sensor.metrics_fields,
          payload_template: sensor.payload_template,
          validation_rules: sensor.validation_rules,
          sampling_interval: 30,
          retention_days: 90
        }),
        true
      ]);
      
      console.log(`✅ Created sensor: ${result.rows[0].id}`);
      console.log(`   Name: ${sensor.name}`);
      console.log(`   MQTT Topic: ${sensor.mqtt_topic}`);
      console.log(`   Hardware ID: ${sensor.hardware_id}`);
      console.log(`   Table: ${sensor.table_name}`);
      
      successCount++;
      
    } catch (error) {
      console.error(`❌ Error creating sensor ${sensor.sensor_id}: ${error.message}`);
      
      // Check if sensor already exists
      try {
        const existing = await query('SELECT * FROM sensors WHERE hardware_id = $1', [sensor.hardware_id]);
        if (existing.rows.length > 0) {
          console.log(`ℹ️  Sensor ${sensor.hardware_id} already exists`);
        }
      } catch (checkError) {
        console.error(`❌ Error checking existing sensor: ${checkError.message}`);
      }
      
      errorCount++;
    }
  }
  
  console.log(`\n📊 Sensor Creation Summary:`);
  console.log(`✅ Created: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  
  // Verify all sensors
  console.log('\n🔍 Verifying all sensors...');
  try {
    const allSensors = await query('SELECT id, name, mqtt_topic, is_active FROM sensors ORDER BY id');
    console.log(`📋 Total sensors in database: ${allSensors.rows.length}`);
    
    allSensors.rows.forEach(sensor => {
      console.log(`   ${sensor.id} - ${sensor.name} (${sensor.is_active ? 'Active' : 'Inactive'})`);
    });
    
  } catch (error) {
    console.error('❌ Error verifying sensors:', error.message);
  }
  
  console.log('\n🎉 All sensors creation process completed!');
  process.exit(0);
}

createAllSensors().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});