#!/usr/bin/env node

/**
 * SOLUCIÓN DIRECTA: Corrección inmediata de sensores específicos
 * 
 * Script simple que corrige directamente los sensores problemáticos
 */

require('dotenv').config();
const { pool } = require('./src/config/database');

// Correcciones específicas identificadas
const DIRECT_CORRECTIONS = [
  {
    sensorId: 7,
    currentName: 'BMP280-1 - Calidad del Agua (Auto)',
    newName: 'BMP280-1 - Sensor de Presión y Temperatura',
    currentType: 'WATER_QUALITY',
    newType: 'TEMP_PRESSURE',
    reason: 'BMP280 is a pressure/temperature sensor, not water quality'
  },
  {
    sensorId: 5,
    currentName: 'Luxometro - Calidad del Agua (Auto)',
    newName: 'Luxómetro - Sensor de Luz',
    currentType: 'WATER_QUALITY',
    newType: 'LIGHT',
    reason: 'Luxometer is a light sensor, not water quality'
  }
];

async function waitForDatabase() {
  console.log('🔄 Conectando a la base de datos...');
  
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await pool.query('SELECT 1');
      console.log('✅ Base de datos conectada');
      return true;
    } catch (error) {
      console.log(`⏳ Intento ${attempt}/10. Reintentando...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error('❌ No se pudo conectar a la base de datos');
}

async function getCurrentSensorData() {
  console.log('📋 Obteniendo datos actuales de sensores...');
  
  try {
    const result = await pool.query(`
      SELECT id, name, sensor_type, hardware_id 
      FROM sensors 
      WHERE id IN (5, 7)
      ORDER BY id
    `);
    
    console.log('📊 Sensores actuales:');
    result.rows.forEach(sensor => {
      console.log(`   ID ${sensor.id}: ${sensor.name} (${sensor.sensor_type})`);
    });
    
    return result.rows;
    
  } catch (error) {
    console.error('❌ Error obteniendo sensores:', error);
    return [];
  }
}

async function applySensorCorrection(correction) {
  console.log(`\n🔧 Aplicando corrección para sensor ID ${correction.sensorId}...`);
  console.log(`   Nombre: "${correction.currentName}" → "${correction.newName}"`);
  console.log(`   Tipo: ${correction.currentType} → ${correction.newType}`);
  
  try {
    const result = await pool.query(`
      UPDATE sensors 
      SET 
        name = $1,
        sensor_type = $2,
        configuration = COALESCE(configuration, '{}') || $3::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, name, sensor_type
    `, [
      correction.newName,
      correction.newType,
      JSON.stringify({
        corrected_directly: true,
        original_name: correction.currentName,
        original_type: correction.currentType,
        correction_reason: correction.reason,
        correction_date: new Date().toISOString(),
        correction_script: 'fix-sensors-direct.js'
      }),
      correction.sensorId
    ]);
    
    if (result.rows.length > 0) {
      const updated = result.rows[0];
      console.log(`   ✅ ÉXITO: ${updated.name} (${updated.sensor_type})`);
      return true;
    } else {
      console.log(`   ❌ No se encontró el sensor ID ${correction.sensorId}`);
      return false;
    }
    
  } catch (error) {
    console.error(`   ❌ ERROR aplicando corrección:`, error.message);
    return false;
  }
}

async function verifyCorrections() {
  console.log('\n🔍 Verificando correcciones aplicadas...');
  
  try {
    const result = await pool.query(`
      SELECT id, name, sensor_type, 
             configuration->>'corrected_directly' as corrected
      FROM sensors 
      WHERE id IN (5, 7)
      ORDER BY id
    `);
    
    console.log('\n✅ ESTADO FINAL:');
    result.rows.forEach(sensor => {
      const flag = sensor.corrected === 'true' ? '🔧' : '';
      console.log(`   ID ${sensor.id}: ${sensor.name} (${sensor.sensor_type}) ${flag}`);
    });
    
    return result.rows;
    
  } catch (error) {
    console.error('❌ Error verificando correcciones:', error);
    return [];
  }
}

async function main() {
  console.log('🚀 Iniciando corrección directa de sensores problemáticos...\n');
  
  try {
    // Paso 1: Conectar a BD
    await waitForDatabase();
    
    // Paso 2: Obtener datos actuales
    const currentSensors = await getCurrentSensorData();
    
    // Paso 3: Aplicar correcciones
    let successCount = 0;
    let errorCount = 0;
    
    for (const correction of DIRECT_CORRECTIONS) {
      const success = await applySensorCorrection(correction);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
    }
    
    // Paso 4: Verificar resultados
    const finalSensors = await verifyCorrections();
    
    // Paso 5: Resultado final
    console.log('\n📊 RESUMEN:');
    console.log(`   ✅ Correcciones exitosas: ${successCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
    console.log(`   📋 Total: ${DIRECT_CORRECTIONS.length}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 ¡Todas las correcciones se aplicaron exitosamente!');
      
      console.log('\n📋 CAMBIOS APLICADOS:');
      console.log('   • BMP280 ahora es tipo TEMP_PRESSURE (antes WATER_QUALITY)');
      console.log('   • Luxómetro ahora es tipo LIGHT (antes WATER_QUALITY)');
      console.log('   • Nombres actualizados para ser más descriptivos');
      
      process.exit(0);
    } else {
      console.log('\n⚠️ Algunas correcciones fallaron');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  }
}

// Ejecutar
if (require.main === module) {
  main();
}

module.exports = { main };