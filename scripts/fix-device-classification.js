#!/usr/bin/env node

/**
 * Script para corregir la clasificación de dispositivos
 * Elimina dispositivos incorrectamente clasificados y mejora la detección
 */

const { query } = require('../src/config/database');
const { cache } = require('../src/config/redis');

// Mapeo correcto de nombres de dispositivos a tipos
const CORRECT_DEVICE_MAPPING = {
  // Bombas de agua - solo las que realmente son bombas
  'bombaagua1': 'WATER_PUMP',
  'bombaagua2': 'WATER_PUMP',
  'bombaagua': 'WATER_PUMP',
  'bomba': 'WATER_PUMP',
  'bomba_agua_01': 'WATER_PUMP',
  
  // Bomba de aire
  'bombaaire': 'WATER_PUMP', // Usar WATER_PUMP por compatibilidad
  
  // Ventiladores y extractores
  'ventilador': 'VENTILATOR',
  'ventilador1': 'VENTILATOR',
  'ventilador2': 'VENTILATOR',
  'ventilador_01': 'VENTILATOR',
  'extractor1': 'VENTILATOR',
  'extractor2': 'VENTILATOR',
  
  // Calefactores
  'calefactor': 'HEATER',
  'calefactor_01': 'HEATER',
  'calefactoragua': 'HEATER',
  'calefactor_agua_01': 'RELAY',
  
  // Luces
  'luz': 'LIGHTS',
  'led_grow_01': 'LIGHTS',
  'fococrecimiento': 'LIGHTS',
  
  // Actuadores/sensores
  'cortina': 'SENSOR_ACTUATOR',
  'goteo': 'SENSOR_ACTUATOR',
  'humidificador': 'SENSOR_ACTUATOR',
  'nebulizador': 'SENSOR_ACTUATOR',
  'generico': 'SENSOR_ACTUATOR'
};

// Dispositivos que definitivamente NO son bombas de agua
const NOT_WATER_PUMPS = [
  'extractor1', 'extractor2', 'cortina', 'nebulizador', 'goteo', 
  'humidificador', 'fococrecimiento', 'generico'
];

async function fixDeviceClassification() {
  try {
    console.log('🔧 Iniciando corrección de clasificación de dispositivos...\n');
    
    // 1. Obtener todos los dispositivos
    const devicesResult = await query('SELECT * FROM devices ORDER BY id');
    const devices = devicesResult.rows;
    
    console.log(`📋 Encontrados ${devices.length} dispositivos\n`);
    
    let corrections = 0;
    let deletions = 0;
    
    for (const device of devices) {
      const deviceId = device.device_id.toLowerCase();
      const currentType = device.type;
      
      // Extraer el nombre base del device_id
      const baseName = deviceId.replace(/-status$/, '').replace(/^invernadero-/, '');
      
      console.log(`🔍 Analizando: ${device.name} (${deviceId})`);
      console.log(`   Tipo actual: ${currentType}`);
      
      // Verificar si es un dispositivo mal clasificado como WATER_PUMP
      if (currentType === 'WATER_PUMP' && NOT_WATER_PUMPS.some(name => baseName.includes(name))) {
        console.log(`   ❌ INCORRECTAMENTE clasificado como WATER_PUMP`);
        
        // Determinar el tipo correcto
        const correctType = CORRECT_DEVICE_MAPPING[baseName] || 'SENSOR_ACTUATOR';
        
        if (correctType !== currentType) {
          console.log(`   ✅ Corrigiendo a: ${correctType}`);
          
          await query(
            'UPDATE devices SET type = $1, updated_at = NOW() WHERE id = $2',
            [correctType, device.id]
          );
          
          corrections++;
        }
      }
      
      // Verificar dispositivos duplicados con -status
      if (deviceId.endsWith('-status')) {
        const baseDeviceId = deviceId.replace('-status', '');
        const duplicateCheck = await query(
          'SELECT id FROM devices WHERE device_id = $1 AND id != $2',
          [baseDeviceId, device.id]
        );
        
        if (duplicateCheck.rows.length > 0) {
          console.log(`   🗑️  Eliminando duplicado con -status: ${deviceId}`);
          
          await query('DELETE FROM devices WHERE id = $1', [device.id]);
          deletions++;
        }
      }
      
      console.log('');
    }
    
    console.log('✅ Corrección completada');
    console.log(`📊 Resumen:`);
    console.log(`   - Correcciones realizadas: ${corrections}`);
    console.log(`   - Dispositivos eliminados: ${deletions}`);
    
    // Limpiar cache
    await cache.del('devices:*');
    console.log('🧹 Cache limpiado');
    
  } catch (error) {
    console.error('❌ Error en la corrección:', error);
  }
}

// Función para mostrar estadísticas después de la corrección
async function showDeviceStats() {
  try {
    const statsResult = await query(`
      SELECT 
        type,
        COUNT(*) as count,
        array_agg(device_id ORDER BY device_id) as device_ids
      FROM devices 
      GROUP BY type 
      ORDER BY type
    `);
    
    console.log('\n📊 Estadísticas de dispositivos después de la corrección:');
    console.log('=' * 60);
    
    for (const stat of statsResult.rows) {
      console.log(`\n🔧 ${stat.type} (${stat.count} dispositivos):`);
      stat.device_ids.forEach(id => {
        console.log(`   - ${id}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
  }
}

// Ejecutar el script
if (require.main === module) {
  fixDeviceClassification()
    .then(() => showDeviceStats())
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { fixDeviceClassification, showDeviceStats };