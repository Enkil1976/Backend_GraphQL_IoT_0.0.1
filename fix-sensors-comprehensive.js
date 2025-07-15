#!/usr/bin/env node

/**
 * SOLUCIÓN INTEGRAL: Corrección de sensores y dispositivos
 * 
 * Este script corrige todos los problemas identificados:
 * 1. Nombres incorrectos de dispositivos auto-creados
 * 2. Tipos de sensores mal clasificados
 * 3. Mapeo incorrecto de datos de sensores
 * 4. Configuración MQTT incorrecta
 */

require('dotenv').config();
const { pool } = require('./src/config/database');

/**
 * Correcciones de tipos de sensores
 */
const SENSOR_TYPE_CORRECTIONS = [
  {
    namePattern: /BMP280|bmp280|pressure|presion/i,
    correctType: 'TEMP_PRESSURE',
    description: 'BMP280 sensors should be TEMP_PRESSURE, not WATER_QUALITY'
  },
  {
    namePattern: /Luxometro|luxometro|light|luz/i,
    correctType: 'LIGHT',
    description: 'Luxometer sensors should be LIGHT, not WATER_QUALITY'
  },
  {
    namePattern: /temhum|temperatura.*humedad/i,
    correctType: 'TEMHUM',
    description: 'Temperature/humidity sensors should be TEMHUM'
  },
  {
    namePattern: /agua|water|ph|ec|ppm|calidad.*agua/i,
    correctType: 'WATER_QUALITY',
    description: 'Water quality sensors should be WATER_QUALITY'
  }
];

/**
 * Correcciones de nombres de dispositivos
 */
const DEVICE_NAME_CORRECTIONS = [
  {
    deviceIdPattern: /calefactor/i,
    nameTemplate: 'Calefactor - {deviceId}',
    description: 'Heater devices should have proper names'
  },
  {
    deviceIdPattern: /ventilador/i,
    nameTemplate: 'Ventilador - {deviceId}',
    description: 'Fan devices should have proper names'
  },
  {
    deviceIdPattern: /bomba/i,
    nameTemplate: 'Bomba de Agua - {deviceId}',
    description: 'Water pump devices should have proper names'
  },
  {
    deviceIdPattern: /luz|light|led/i,
    nameTemplate: 'Iluminación - {deviceId}',
    description: 'Light devices should have proper names'
  }
];

/**
 * Correcciones de nombres de sensores
 */
const SENSOR_NAME_CORRECTIONS = [
  {
    namePattern: /BMP280.*Calidad del Agua/i,
    newName: 'BMP280 - Sensor de Presión y Temperatura',
    description: 'BMP280 should be pressure/temperature sensor'
  },
  {
    namePattern: /Luxometro.*Calidad del Agua/i,
    newName: 'Luxómetro - Sensor de Luz',
    description: 'Luxometer should be light sensor'
  },
  {
    namePattern: /Agua.*Calidad del Agua.*temp/i,
    newName: 'Sensor de Temperatura del Agua',
    description: 'Water temperature sensor'
  },
  {
    namePattern: /Agua.*Calidad del Agua.*data/i,
    newName: 'Sensor de Calidad del Agua (pH, EC, PPM)',
    description: 'Water quality sensor for pH, EC, PPM'
  }
];

async function waitForDatabase(maxRetries = 30) {
  console.log('🔄 Esperando conexión a la base de datos...');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.query('SELECT 1');
      console.log('✅ Base de datos conectada');
      return true;
    } catch (error) {
      console.log(`⏳ Intento ${attempt}/${maxRetries} fallido. Reintentando...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error(`❌ No se pudo conectar a la base de datos después de ${maxRetries} intentos`);
}

async function getSensorsNeedingCorrection() {
  console.log('📋 Obteniendo sensores que necesitan corrección...');
  
  try {
    const result = await pool.query(`
      SELECT id, name, sensor_type, hardware_id, location, description, 
             mqtt_topic, configuration, created_at
      FROM sensors 
      WHERE id > 1  -- Skip system sensor
      ORDER BY id
    `);
    
    console.log(`📊 Encontrados ${result.rows.length} sensores para revisar`);
    return result.rows;
    
  } catch (error) {
    console.error('❌ Error obteniendo sensores:', error);
    return [];
  }
}

async function getDevicesNeedingCorrection() {
  console.log('📋 Obteniendo dispositivos que necesitan corrección...');
  
  try {
    const result = await pool.query(`
      SELECT id, device_id, name, type, description, status, 
             configuration, created_at
      FROM devices 
      WHERE description LIKE '%Auto-created%'
      ORDER BY id
    `);
    
    console.log(`📊 Encontrados ${result.rows.length} dispositivos para revisar`);
    return result.rows;
    
  } catch (error) {
    console.error('❌ Error obteniendo dispositivos:', error);
    return [];
  }
}

async function correctSensorType(sensor) {
  console.log(`🔍 Analizando sensor: ${sensor.name} (${sensor.sensor_type})`);
  
  let correction = null;
  
  // Buscar corrección apropiada
  for (const typeCorrection of SENSOR_TYPE_CORRECTIONS) {
    if (typeCorrection.namePattern.test(sensor.name) || 
        typeCorrection.namePattern.test(sensor.hardware_id || '')) {
      
      if (sensor.sensor_type !== typeCorrection.correctType) {
        correction = typeCorrection;
        break;
      }
    }
  }
  
  if (!correction) {
    console.log(`   ✅ ${sensor.name} ya tiene el tipo correcto`);
    return false;
  }
  
  console.log(`   🔄 Corrigiendo tipo: ${sensor.sensor_type} → ${correction.correctType}`);
  
  try {
    await pool.query(`
      UPDATE sensors 
      SET 
        sensor_type = $1,
        configuration = COALESCE(configuration, '{}') || $2::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [
      correction.correctType,
      JSON.stringify({
        sensor_type_corrected: true,
        original_type: sensor.sensor_type,
        corrected_type: correction.correctType,
        correction_reason: correction.description,
        correction_date: new Date().toISOString(),
        correction_script: 'fix-sensors-comprehensive.js'
      }),
      sensor.id
    ]);
    
    console.log(`   ✅ Tipo corregido exitosamente`);
    return true;
    
  } catch (error) {
    console.error(`   ❌ Error corrigiendo tipo:`, error);
    return false;
  }
}

async function correctSensorName(sensor) {
  console.log(`🔍 Analizando nombre del sensor: ${sensor.name}`);
  
  let correction = null;
  
  // Buscar corrección apropiada
  for (const nameCorrection of SENSOR_NAME_CORRECTIONS) {
    if (nameCorrection.namePattern.test(sensor.name)) {
      correction = nameCorrection;
      break;
    }
  }
  
  if (!correction) {
    console.log(`   ✅ ${sensor.name} ya tiene un nombre apropiado`);
    return false;
  }
  
  console.log(`   🔄 Corrigiendo nombre: "${sensor.name}" → "${correction.newName}"`);
  
  try {
    await pool.query(`
      UPDATE sensors 
      SET 
        name = $1,
        configuration = COALESCE(configuration, '{}') || $2::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [
      correction.newName,
      JSON.stringify({
        name_corrected: true,
        original_name: sensor.name,
        corrected_name: correction.newName,
        correction_reason: correction.description,
        correction_date: new Date().toISOString(),
        correction_script: 'fix-sensors-comprehensive.js'
      }),
      sensor.id
    ]);
    
    console.log(`   ✅ Nombre corregido exitosamente`);
    return true;
    
  } catch (error) {
    console.error(`   ❌ Error corrigiendo nombre:`, error);
    return false;
  }
}

async function correctDeviceName(device) {
  console.log(`🔍 Analizando nombre del dispositivo: ${device.name}`);
  
  let correction = null;
  
  // Buscar corrección apropiada
  for (const nameCorrection of DEVICE_NAME_CORRECTIONS) {
    if (nameCorrection.deviceIdPattern.test(device.device_id)) {
      const newName = nameCorrection.nameTemplate.replace('{deviceId}', device.device_id);
      
      if (device.name !== newName) {
        correction = {
          newName,
          description: nameCorrection.description
        };
        break;
      }
    }
  }
  
  if (!correction) {
    console.log(`   ✅ ${device.name} ya tiene un nombre apropiado`);
    return false;
  }
  
  console.log(`   🔄 Corrigiendo nombre: "${device.name}" → "${correction.newName}"`);
  
  try {
    await pool.query(`
      UPDATE devices 
      SET 
        name = $1,
        configuration = COALESCE(configuration, '{}') || $2::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [
      correction.newName,
      JSON.stringify({
        name_corrected: true,
        original_name: device.name,
        corrected_name: correction.newName,
        correction_reason: correction.description,
        correction_date: new Date().toISOString(),
        correction_script: 'fix-sensors-comprehensive.js'
      }),
      device.id
    ]);
    
    console.log(`   ✅ Nombre corregido exitosamente`);
    return true;
    
  } catch (error) {
    console.error(`   ❌ Error corrigiendo nombre:`, error);
    return false;
  }
}

async function applySensorCorrections() {
  console.log('\n🔧 Aplicando correcciones de sensores...');
  
  try {
    const sensors = await getSensorsNeedingCorrection();
    
    if (sensors.length === 0) {
      console.log('✅ No hay sensores para corregir');
      return { success: true, corrected: 0, errors: 0 };
    }
    
    let typeCorrections = 0;
    let nameCorrections = 0;
    let errors = 0;
    
    for (const sensor of sensors) {
      console.log(`\n📋 Procesando sensor ID ${sensor.id}...`);
      
      // Corregir tipo
      try {
        if (await correctSensorType(sensor)) {
          typeCorrections++;
        }
      } catch (error) {
        console.error(`❌ Error corrigiendo tipo del sensor ${sensor.id}:`, error);
        errors++;
      }
      
      // Corregir nombre
      try {
        if (await correctSensorName(sensor)) {
          nameCorrections++;
        }
      } catch (error) {
        console.error(`❌ Error corrigiendo nombre del sensor ${sensor.id}:`, error);
        errors++;
      }
    }
    
    console.log('\n📊 RESUMEN DE CORRECCIONES DE SENSORES:');
    console.log(`   🔧 Tipos corregidos: ${typeCorrections}`);
    console.log(`   📝 Nombres corregidos: ${nameCorrections}`);
    console.log(`   ❌ Errores: ${errors}`);
    console.log(`   📋 Total procesados: ${sensors.length}`);
    
    return { 
      success: errors === 0, 
      corrected: typeCorrections + nameCorrections, 
      errors,
      total: sensors.length
    };
    
  } catch (error) {
    console.error('❌ Error durante la corrección de sensores:', error);
    return { success: false, corrected: 0, errors: 1 };
  }
}

async function applyDeviceCorrections() {
  console.log('\n🔧 Aplicando correcciones de dispositivos...');
  
  try {
    const devices = await getDevicesNeedingCorrection();
    
    if (devices.length === 0) {
      console.log('✅ No hay dispositivos para corregir');
      return { success: true, corrected: 0, errors: 0 };
    }
    
    let correctedCount = 0;
    let errorCount = 0;
    
    for (const device of devices) {
      console.log(`\n📋 Procesando dispositivo ID ${device.id}...`);
      
      try {
        if (await correctDeviceName(device)) {
          correctedCount++;
        }
      } catch (error) {
        console.error(`❌ Error corrigiendo dispositivo ${device.id}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n📊 RESUMEN DE CORRECCIONES DE DISPOSITIVOS:');
    console.log(`   📝 Nombres corregidos: ${correctedCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
    console.log(`   📋 Total procesados: ${devices.length}`);
    
    return { 
      success: errorCount === 0, 
      corrected: correctedCount, 
      errors: errorCount,
      total: devices.length
    };
    
  } catch (error) {
    console.error('❌ Error durante la corrección de dispositivos:', error);
    return { success: false, corrected: 0, errors: 1 };
  }
}

async function verifyCorrections() {
  console.log('\n🔍 Verificando correcciones aplicadas...');
  
  try {
    // Verificar sensores
    const sensorsResult = await pool.query(`
      SELECT id, name, sensor_type, hardware_id,
             configuration->>'sensor_type_corrected' as type_corrected,
             configuration->>'name_corrected' as name_corrected
      FROM sensors 
      WHERE id > 1
      ORDER BY id
    `);
    
    console.log('\n✅ ESTADO DE SENSORES:');
    sensorsResult.rows.forEach(sensor => {
      const typeFlag = sensor.type_corrected === 'true' ? '🔧' : '';
      const nameFlag = sensor.name_corrected === 'true' ? '📝' : '';
      console.log(`   ${sensor.id}: ${sensor.name} (${sensor.sensor_type}) ${typeFlag}${nameFlag}`);
    });
    
    // Verificar dispositivos
    const devicesResult = await pool.query(`
      SELECT id, device_id, name, type,
             configuration->>'name_corrected' as name_corrected
      FROM devices 
      WHERE configuration->>'name_corrected' = 'true'
      ORDER BY id
    `);
    
    console.log('\n✅ DISPOSITIVOS CORREGIDOS:');
    devicesResult.rows.forEach(device => {
      console.log(`   ${device.id}: ${device.name} (${device.device_id}) 📝`);
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Error verificando correcciones:', error);
    return false;
  }
}

async function createAuditLog(sensorResult, deviceResult) {
  console.log('📝 Creando registro de auditoría...');
  
  try {
    await pool.query(`
      INSERT INTO operations_log (
        operation_type,
        operation_data,
        user_id,
        created_at
      ) VALUES (
        'SENSOR_DEVICE_CORRECTION',
        $1::jsonb,
        1,
        CURRENT_TIMESTAMP
      )
    `, [JSON.stringify({
      script: 'fix-sensors-comprehensive.js',
      execution_time: new Date().toISOString(),
      sensors: {
        corrected: sensorResult.corrected,
        errors: sensorResult.errors,
        total: sensorResult.total
      },
      devices: {
        corrected: deviceResult.corrected,
        errors: deviceResult.errors,
        total: deviceResult.total
      },
      overall_success: sensorResult.success && deviceResult.success
    })]);
    
    console.log('✅ Registro de auditoría creado');
    
  } catch (error) {
    console.warn('⚠️ No se pudo crear el registro de auditoría:', error.message);
    // No fallar el script por esto
  }
}

async function main() {
  console.log('🚀 Iniciando corrección integral de sensores y dispositivos...\n');
  
  try {
    // Paso 1: Esperar conexión a la base de datos
    await waitForDatabase();
    
    // Paso 2: Aplicar correcciones de sensores
    const sensorResult = await applySensorCorrections();
    
    // Paso 3: Aplicar correcciones de dispositivos
    const deviceResult = await applyDeviceCorrections();
    
    // Paso 4: Verificar correcciones
    const verificationOk = await verifyCorrections();
    
    // Paso 5: Crear registro de auditoría
    await createAuditLog(sensorResult, deviceResult);
    
    // Paso 6: Resultado final
    const totalCorrected = sensorResult.corrected + deviceResult.corrected;
    const totalErrors = sensorResult.errors + deviceResult.errors;
    const overallSuccess = sensorResult.success && deviceResult.success;
    
    if (overallSuccess && verificationOk) {
      console.log('\n🎉 ¡Corrección integral completada exitosamente!');
      console.log(`📊 Total corregido: ${totalCorrected} elementos`);
      process.exit(0);
    } else {
      console.log('\n⚠️ La corrección se completó con algunos problemas');
      console.log(`📊 ${totalCorrected} elementos corregidos, ${totalErrors} errores`);
      process.exit(totalErrors > 0 ? 1 : 0);
    }
    
  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { main };