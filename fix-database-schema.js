#!/usr/bin/env node

/**
 * Script para corregir esquema de base de datos
 * Arregla problemas de columnas faltantes
 */

const { query } = require('./src/config/database');

async function fixDatabaseSchema() {
  console.log('🔧 Iniciando corrección del esquema de base de datos...');

  try {
    // 1. Verificar y agregar columna location a devices si no existe
    console.log('\n📊 Verificando tabla devices...');
    
    const deviceColumns = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'devices' AND table_schema = 'public'
    `);
    
    const hasLocationColumn = deviceColumns.rows.some(row => row.column_name === 'location');
    
    if (!hasLocationColumn) {
      console.log('❌ Columna location faltante en devices, agregando...');
      await query('ALTER TABLE devices ADD COLUMN location VARCHAR(255) DEFAULT \'Unknown\'');
      console.log('✅ Columna location agregada a devices');
    } else {
      console.log('✅ Columna location ya existe en devices');
    }

    // 2. Verificar esquema de sensors para mqtt_topic
    console.log('\n📡 Verificando tabla sensors...');
    
    const sensorColumns = await query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'sensors' AND table_schema = 'public'
    `);
    
    const mqttTopicColumn = sensorColumns.rows.find(row => row.column_name === 'mqtt_topic');
    
    if (!mqttTopicColumn) {
      console.log('❌ Columna mqtt_topic faltante en sensors, agregando...');
      await query('ALTER TABLE sensors ADD COLUMN mqtt_topic VARCHAR(255)');
      console.log('✅ Columna mqtt_topic agregada a sensors');
    } else {
      console.log('✅ Columna mqtt_topic existe en sensors');
      
      if (mqttTopicColumn.is_nullable === 'NO') {
        console.log('⚠️ mqtt_topic tiene constraint NOT NULL, esto puede causar errores');
        console.log('💡 Considerando hacer mqtt_topic nullable temporalmente...');
        
        await query('ALTER TABLE sensors ALTER COLUMN mqtt_topic DROP NOT NULL');
        console.log('✅ Constraint NOT NULL removido de mqtt_topic');
      }
    }

    // 3. Limpiar sensores duplicados auto-creados con mqtt_topic null
    console.log('\n🧹 Limpiando sensores duplicados con mqtt_topic null...');
    
    const duplicateSensors = await query(`
      SELECT id, hardware_id, name, mqtt_topic
      FROM sensors 
      WHERE description LIKE '%Auto-created from MQTT topic%' 
        AND mqtt_topic IS NULL
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 Encontrados ${duplicateSensors.rows.length} sensores auto-creados con mqtt_topic null`);
    
    if (duplicateSensors.rows.length > 0) {
      // Eliminar los sensores duplicados
      const deleteQuery = `
        DELETE FROM sensors 
        WHERE description LIKE '%Auto-created from MQTT topic%' 
          AND mqtt_topic IS NULL
      `;
      
      const deleteResult = await query(deleteQuery);
      console.log(`✅ Eliminados ${deleteResult.rowCount} sensores duplicados`);
    }

    // 4. Verificar sensores existentes válidos
    console.log('\n📊 Sensores válidos en el sistema:');
    const validSensors = await query(`
      SELECT id, hardware_id, name, sensor_type, mqtt_topic
      FROM sensors 
      WHERE is_active = true AND mqtt_topic IS NOT NULL
      ORDER BY id
    `);
    
    validSensors.rows.forEach(sensor => {
      console.log(`   ID ${sensor.id}: ${sensor.hardware_id} (${sensor.sensor_type}) → ${sensor.mqtt_topic}`);
    });

    // 5. Verificar dispositivos existentes
    console.log('\n🎛️ Dispositivos en el sistema:');
    const devices = await query('SELECT id, name, type, status FROM devices ORDER BY id');
    
    devices.rows.forEach(device => {
      console.log(`   ID ${device.id}: ${device.name} (${device.type}) → ${device.status}`);
    });

    console.log('\n✅ Corrección del esquema completada!');
    console.log('\n📋 Resumen de cambios:');
    console.log('   - Verificada/agregada columna location en devices');
    console.log('   - Verificada columna mqtt_topic en sensors');
    console.log('   - Removido constraint NOT NULL de mqtt_topic (temporal)');
    console.log('   - Limpiados sensores duplicados auto-creados');
    console.log('\n🚀 El esquema debería estar listo para el código actualizado.');

  } catch (error) {
    console.error('❌ Error durante la corrección del esquema:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  fixDatabaseSchema();
}

module.exports = { fixDatabaseSchema };