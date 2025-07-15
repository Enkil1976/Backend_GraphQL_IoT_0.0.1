#!/usr/bin/env node

/**
 * SOLUCIÓN ESTABLE: Corrección de tipos de dispositivos
 * 
 * Este script se ejecuta automáticamente en cada deploy para corregir
 * los tipos de dispositivos mal clasificados por el autodiscovery.
 * 
 * Características:
 * - Robusto y estable
 * - Maneja errores graciosamente
 * - Se ejecuta automáticamente en deploy
 * - Idempotente (se puede ejecutar múltiples veces)
 * - Logging detallado
 */

require('dotenv').config();
const { pool } = require('./src/config/database');

/**
 * Mapeo de correcciones necesarias
 */
const DEVICE_TYPE_CORRECTIONS = [
  {
    pattern: '%ventilador%',
    correctType: 'VENTILATOR',
    description: 'Ventilador devices'
  },
  {
    pattern: '%calefactor%',
    correctType: 'HEATER',
    description: 'Calefactor devices (heaters)'
  },
  {
    pattern: '%luz%',
    correctType: 'LIGHTS',
    description: 'Luz devices (lights)'
  },
  {
    pattern: '%light%',
    correctType: 'LIGHTS',
    description: 'Light devices'
  },
  {
    pattern: '%led%',
    correctType: 'LIGHTS',
    description: 'LED devices'
  },
  {
    pattern: '%valve%',
    correctType: 'VALVE',
    description: 'Valve devices'
  },
  {
    pattern: '%valvula%',
    correctType: 'VALVE',
    description: 'Válvula devices'
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

async function checkDevicesTable() {
  console.log('🔍 Verificando tabla de dispositivos...');
  
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'devices'
      );
    `);
    
    if (!result.rows[0].exists) {
      console.log('⚠️ La tabla devices no existe. Saltando corrección.');
      return false;
    }
    
    console.log('✅ Tabla devices encontrada');
    return true;
    
  } catch (error) {
    console.error('❌ Error verificando tabla devices:', error);
    return false;
  }
}

async function getDevicesNeedingCorrection() {
  console.log('📋 Obteniendo dispositivos que necesitan corrección...');
  
  try {
    const result = await pool.query(`
      SELECT id, device_id, name, type, status, description, created_at
      FROM devices 
      WHERE type = 'WATER_PUMP'
      AND (
        device_id ILIKE '%ventilador%' OR
        device_id ILIKE '%calefactor%' OR
        device_id ILIKE '%luz%' OR
        device_id ILIKE '%light%' OR
        device_id ILIKE '%led%' OR
        device_id ILIKE '%valve%' OR
        device_id ILIKE '%valvula%'
      )
      ORDER BY id
    `);
    
    console.log(`📊 Encontrados ${result.rows.length} dispositivos que necesitan corrección`);
    return result.rows;
    
  } catch (error) {
    console.error('❌ Error obteniendo dispositivos:', error);
    return [];
  }
}

async function determineCorrectType(deviceId) {
  const deviceIdLower = deviceId.toLowerCase();
  
  for (const correction of DEVICE_TYPE_CORRECTIONS) {
    const pattern = correction.pattern.replace(/%/g, '');
    if (deviceIdLower.includes(pattern)) {
      return correction.correctType;
    }
  }
  
  return null;
}

async function updateDeviceType(device, newType) {
  console.log(`🔄 Actualizando ${device.device_id}: ${device.type} → ${newType}`);
  
  try {
    const result = await pool.query(`
      UPDATE devices 
      SET 
        type = $1,
        configuration = COALESCE(configuration, '{}') || $2::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, device_id, name, type
    `, [
      newType,
      JSON.stringify({
        device_type_corrected: true,
        original_type: device.type,
        corrected_type: newType,
        correction_date: new Date().toISOString(),
        correction_script: 'fix-device-types-stable.js'
      }),
      device.id
    ]);
    
    if (result.rows.length > 0) {
      const updated = result.rows[0];
      console.log(`✅ ${updated.device_id} actualizado exitosamente a ${updated.type}`);
      return true;
    } else {
      console.log(`⚠️ No se pudo actualizar ${device.device_id}`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Error actualizando ${device.device_id}:`, error);
    return false;
  }
}

async function applyDeviceTypeCorrections() {
  console.log('🔧 Aplicando correcciones de tipos de dispositivos...');
  
  try {
    const devices = await getDevicesNeedingCorrection();
    
    if (devices.length === 0) {
      console.log('✅ No hay dispositivos que necesiten corrección');
      return { success: true, corrected: 0, errors: 0 };
    }
    
    let correctedCount = 0;
    let errorCount = 0;
    
    for (const device of devices) {
      const correctType = await determineCorrectType(device.device_id);
      
      if (!correctType) {
        console.log(`⚠️ No se pudo determinar el tipo correcto para ${device.device_id}`);
        errorCount++;
        continue;
      }
      
      if (device.type === correctType) {
        console.log(`✅ ${device.device_id} ya tiene el tipo correcto (${correctType})`);
        continue;
      }
      
      const success = await updateDeviceType(device, correctType);
      
      if (success) {
        correctedCount++;
      } else {
        errorCount++;
      }
    }
    
    console.log('\n📊 RESUMEN DE CORRECCIONES:');
    console.log(`   ✅ Dispositivos corregidos: ${correctedCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
    console.log(`   📋 Total procesados: ${devices.length}`);
    
    return { 
      success: errorCount === 0, 
      corrected: correctedCount, 
      errors: errorCount,
      total: devices.length
    };
    
  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
    return { success: false, corrected: 0, errors: 1 };
  }
}

async function verifyCorrections() {
  console.log('\n🔍 Verificando correcciones aplicadas...');
  
  try {
    const result = await pool.query(`
      SELECT device_id, type, 
             configuration->>'device_type_corrected' as corrected,
             configuration->>'original_type' as original_type,
             configuration->>'correction_date' as correction_date
      FROM devices 
      WHERE (
        device_id ILIKE '%ventilador%' OR
        device_id ILIKE '%calefactor%' OR
        device_id ILIKE '%luz%' OR
        device_id ILIKE '%light%' OR
        device_id ILIKE '%led%' OR
        device_id ILIKE '%valve%' OR
        device_id ILIKE '%valvula%'
      )
      AND device_id NOT ILIKE '%bomba%'
      ORDER BY device_id
    `);
    
    console.log('\n✅ ESTADO ACTUAL DE DISPOSITIVOS:');
    
    let correctCount = 0;
    let incorrectCount = 0;
    
    for (const row of result.rows) {
      const expectedType = await determineCorrectType(row.device_id);
      const isCorrect = row.type === expectedType;
      const status = isCorrect ? '✅' : '❌';
      const correctedFlag = row.corrected === 'true' ? '🔧' : '';
      
      console.log(`   ${status} ${row.device_id}: ${row.type} ${correctedFlag}`);
      
      if (row.corrected === 'true') {
        console.log(`      📝 Corregido desde: ${row.original_type} el ${row.correction_date}`);
      }
      
      if (isCorrect) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    }
    
    console.log(`\n📈 Dispositivos correctos: ${correctCount}`);
    console.log(`📉 Dispositivos incorrectos: ${incorrectCount}`);
    
    return incorrectCount === 0;
    
  } catch (error) {
    console.error('❌ Error verificando correcciones:', error);
    return false;
  }
}

async function createAuditLog(result) {
  console.log('📝 Creando registro de auditoría...');
  
  try {
    await pool.query(`
      INSERT INTO operations_log (
        operation_type,
        operation_data,
        user_id,
        created_at
      ) VALUES (
        'DEVICE_TYPE_CORRECTION',
        $1::jsonb,
        1,
        CURRENT_TIMESTAMP
      )
    `, [JSON.stringify({
      script: 'fix-device-types-stable.js',
      execution_time: new Date().toISOString(),
      devices_corrected: result.corrected,
      errors: result.errors,
      total_processed: result.total,
      success: result.success
    })]);
    
    console.log('✅ Registro de auditoría creado');
    
  } catch (error) {
    console.warn('⚠️ No se pudo crear el registro de auditoría:', error.message);
    // No fallar el script por esto
  }
}

async function main() {
  console.log('🚀 Iniciando corrección estable de tipos de dispositivos...\n');
  
  try {
    // Paso 1: Esperar conexión a la base de datos
    await waitForDatabase();
    
    // Paso 2: Verificar que la tabla devices existe
    const tableExists = await checkDevicesTable();
    if (!tableExists) {
      console.log('✅ Script completado (tabla devices no existe)');
      return;
    }
    
    // Paso 3: Aplicar correcciones
    const result = await applyDeviceTypeCorrections();
    
    // Paso 4: Verificar correcciones
    const verificationOk = await verifyCorrections();
    
    // Paso 5: Crear registro de auditoría
    await createAuditLog(result);
    
    // Paso 6: Resultado final
    if (result.success && verificationOk) {
      console.log('\n🎉 ¡Corrección de tipos de dispositivos completada exitosamente!');
      console.log(`📊 ${result.corrected} dispositivos corregidos`);
      process.exit(0);
    } else {
      console.log('\n⚠️ La corrección se completó con algunos problemas');
      console.log(`📊 ${result.corrected} dispositivos corregidos, ${result.errors} errores`);
      process.exit(result.errors > 0 ? 1 : 0);
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