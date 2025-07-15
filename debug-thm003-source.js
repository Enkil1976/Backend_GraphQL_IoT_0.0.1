#!/usr/bin/env node

/**
 * Debug script to investigate THM-003 MQTT message source
 * This script will help identify who is sending messages to Invernadero/THM-003
 */

const { query } = require('./src/config/database');
const { cache } = require('./src/config/redis');

async function debugTHM003Source() {
  try {
    console.log('🔍 Investigating THM-003 MQTT Message Source');
    console.log('='.repeat(50));
    
    // Check database for any THM-003 related entries
    console.log('\n📊 1. Checking database for THM-003 entries...');
    
    const sensorQuery = `
      SELECT id, name, hardware_id, mqtt_topic, type, is_active 
      FROM sensors 
      WHERE hardware_id ILIKE '%thm-003%' 
         OR hardware_id ILIKE '%003%'
         OR mqtt_topic ILIKE '%THM-003%'
         OR name ILIKE '%THM-003%'
    `;
    
    const sensorResult = await query(sensorQuery);
    if (sensorResult.rows.length > 0) {
      console.log('✅ Found sensors matching THM-003:');
      sensorResult.rows.forEach(sensor => {
        console.log(`  - ID ${sensor.id}: ${sensor.name}`);
        console.log(`    Hardware ID: ${sensor.hardware_id}`);
        console.log(`    MQTT Topic: ${sensor.mqtt_topic}`);
        console.log(`    Type: ${sensor.type}`);
        console.log(`    Active: ${sensor.is_active}`);
        console.log('');
      });
    } else {
      console.log('❌ No sensors found with THM-003 identifier');
    }
    
    // Check devices
    console.log('\n🔧 2. Checking devices for THM-003...');
    const deviceQuery = `
      SELECT id, name, device_id, type, configuration 
      FROM devices 
      WHERE device_id ILIKE '%THM-003%' 
         OR name ILIKE '%THM-003%'
         OR configuration::text ILIKE '%THM-003%'
    `;
    
    const deviceResult = await query(deviceQuery);
    if (deviceResult.rows.length > 0) {
      console.log('✅ Found devices matching THM-003:');
      deviceResult.rows.forEach(device => {
        console.log(`  - ID ${device.id}: ${device.name}`);
        console.log(`    Device ID: ${device.device_id}`);
        console.log(`    Type: ${device.type}`);
        console.log(`    Configuration: ${JSON.stringify(device.configuration, null, 4)}`);
        console.log('');
      });
    } else {
      console.log('❌ No devices found with THM-003 identifier');
    }
    
    // Check Redis cache for recent data
    console.log('\n💾 3. Checking Redis cache for THM-003 data...');
    try {
      const keys = await cache.keys('sensor_latest:*thm*');
      if (keys.length > 0) {
        console.log('✅ Found cached sensor data for THM sensors:');
        for (const key of keys) {
          const data = await cache.get(key);
          console.log(`  - Key: ${key}`);
          console.log(`    Data: ${data}`);
          console.log('');
        }
      } else {
        console.log('❌ No cached data found for THM sensors');
      }
    } catch (redisError) {
      console.log('❌ Redis check failed:', redisError.message);
    }
    
    // Check auto-discovery logs
    console.log('\n🤖 4. Checking auto-discovery logs...');
    try {
      const logs = await cache.lrange('auto_discovery_log', 0, 50);
      if (logs.length > 0) {
        console.log('✅ Found auto-discovery logs:');
        logs.forEach((log, index) => {
          try {
            const logEntry = JSON.parse(log);
            if (logEntry.mqtt_topic && logEntry.mqtt_topic.includes('THM-003')) {
              console.log(`  - Log ${index + 1}: ${logEntry.mqtt_topic}`);
              console.log(`    Entity Type: ${logEntry.entity_type}`);
              console.log(`    Created At: ${logEntry.created_at}`);
              console.log('');
            }
          } catch (parseError) {
            // Skip invalid log entries
          }
        });
      } else {
        console.log('❌ No auto-discovery logs found');
      }
    } catch (logError) {
      console.log('❌ Auto-discovery log check failed:', logError.message);
    }
    
    // Recommendations
    console.log('\n💡 5. Recommendations to find the source:');
    console.log('');
    console.log('🔍 Check these physical locations:');
    console.log('  1. Look for Arduino/ESP32 devices in your greenhouse');
    console.log('  2. Check device labels or stickers with "THM-003"');
    console.log('  3. Look for breadboards or development setups');
    console.log('');
    console.log('💻 Check code/configuration:');
    console.log('  1. Search Arduino IDE recent sketches for "THM-003"');
    console.log('  2. Check any ESPHome or Tasmota configurations');
    console.log('  3. Look for hardcoded MQTT topics in your code');
    console.log('');
    console.log('🔧 MQTT Debugging:');
    console.log('  1. Use MQTT Explorer or similar tool');
    console.log('  2. Subscribe to Invernadero/THM-003 and monitor payload');
    console.log('  3. Check MQTT broker logs for client connections');
    console.log('');
    console.log('⚠️  Note: The device might be:');
    console.log('  - A test sensor that was never properly configured');
    console.log('  - An old sensor with outdated firmware');
    console.log('  - A duplicate sensor that should be removed');
    
  } catch (error) {
    console.error('❌ Error during investigation:', error);
  }
}

// Run the investigation
debugTHM003Source()
  .then(() => {
    console.log('\n✅ Investigation completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Investigation failed:', error);
    process.exit(1);
  });