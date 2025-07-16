#!/usr/bin/env node

/**
 * Script para corregir tipos de dispositivos mal clasificados por el autodiscovery
 * 
 * Este script identifica y corrige dispositivos que fueron incorrectamente 
 * clasificados como WATER_PUMP cuando deberían ser VENTILATOR, HEATER, etc.
 */

const { query } = require('../src/config/database');

// Mapeo de device_id a tipo correcto
const DEVICE_TYPE_CORRECTIONS = {
  'invernadero-ventilador': 'VENTILATOR',
  'invernadero-calefactor': 'HEATER', 
  'invernadero-calefactoragua': 'HEATER',
  'invernadero-bomba': 'WATER_PUMP', // Este está correcto
};

// Patrones para detectar tipos por device_id
const DEVICE_TYPE_PATTERNS = [
  { pattern: /ventilador|fan/i, correctType: 'VENTILATOR' },
  { pattern: /calefactor|heater/i, correctType: 'HEATER' },
  { pattern: /bomba|pump/i, correctType: 'WATER_PUMP' },
  { pattern: /luz|light|led/i, correctType: 'LIGHTS' },
  { pattern: /valve|valvula/i, correctType: 'VALVE' },
];

async function main() {
  console.log('🔧 Iniciando corrección de tipos de dispositivos...\n');
  
  try {
    // 1. Obtener todos los dispositivos activos
    const devicesQuery = `
      SELECT id, device_id, name, type, configuration 
      FROM devices 
      WHERE type IS NOT NULL
      ORDER BY device_id
    `;
    
    const result = await query(devicesQuery);
    const devices = result.rows;
    
    console.log(`📋 Encontrados ${devices.length} dispositivos para revisar\n`);
    
    let correctionsMade = 0;
    const corrections = [];
    
    // 2. Revisar cada dispositivo
    for (const device of devices) {
      const deviceId = device.device_id || 'unknown';
      const currentType = device.type;
      
      console.log(`🔍 Revisando: ${deviceId} (tipo actual: ${currentType})`);
      
      let correctType = null;
      let correctionReason = '';
      
      // 3. Verificar si necesita corrección usando mapeo directo
      if (DEVICE_TYPE_CORRECTIONS[deviceId]) {
        correctType = DEVICE_TYPE_CORRECTIONS[deviceId];
        correctionReason = 'mapeo directo';
      }
      // 4. Verificar usando patrones si no hay mapeo directo
      else {
        for (const pattern of DEVICE_TYPE_PATTERNS) {
          if (pattern.pattern.test(deviceId)) {
            correctType = pattern.correctType;
            correctionReason = `patrón: ${pattern.pattern}`;
            break;
          }
        }
      }
      
      // 5. Aplicar corrección si es necesaria
      if (correctType && correctType !== currentType) {
        console.log(`   ✅ CORRECCIÓN NECESARIA: ${currentType} → ${correctType} (${correctionReason})`);
        
        const updateQuery = `
          UPDATE devices 
          SET 
            type = $1,
            configuration = COALESCE(configuration, '{}') || $2::jsonb,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `;
        
        const configUpdate = {
          device_type_corrected: true,
          original_type: currentType,
          corrected_type: correctType,
          correction_reason: correctionReason,
          correction_date: new Date().toISOString()
        };
        
        await query(updateQuery, [
          correctType,
          JSON.stringify(configUpdate),
          device.id
        ]);
        
        correctionsMade++;
        corrections.push({
          deviceId: deviceId,
          name: device.name,
          from: currentType,
          to: correctType,
          reason: correctionReason
        });
        
        console.log(`   🔧 CORREGIDO: ${deviceId} actualizado a ${correctType}`);
      } else if (correctType && correctType === currentType) {
        console.log(`   ✅ CORRECTO: ${deviceId} ya tiene el tipo correcto (${currentType})`);
      } else {
        console.log(`   ⏭️  OMITIDO: ${deviceId} no requiere corrección (${currentType})`);
      }
      
      console.log(''); // Línea en blanco para separar
    }
    
    // 6. Resumen de correcciones
    console.log('\n📊 RESUMEN DE CORRECCIONES:');
    console.log(`   Total dispositivos revisados: ${devices.length}`);
    console.log(`   Correcciones realizadas: ${correctionsMade}`);
    
    if (corrections.length > 0) {
      console.log('\n🔧 DETALLE DE CORRECCIONES:');
      corrections.forEach((correction, index) => {
        console.log(`   ${index + 1}. ${correction.deviceId}`);
        console.log(`      Nombre: ${correction.name}`);
        console.log(`      Cambio: ${correction.from} → ${correction.to}`);
        console.log(`      Razón: ${correction.reason}`);
        console.log('');
      });
    }
    
    // 7. Verificar dispositivos actualizados
    console.log('🔍 VERIFICACIÓN POST-CORRECCIÓN:');
    const verificationQuery = `
      SELECT device_id, name, type 
      FROM devices 
      WHERE device_id IN (${Object.keys(DEVICE_TYPE_CORRECTIONS).map(id => `'${id}'`).join(', ')})
      ORDER BY device_id
    `;
    
    const verificationResult = await query(verificationQuery);
    verificationResult.rows.forEach(device => {
      const expectedType = DEVICE_TYPE_CORRECTIONS[device.device_id];
      const status = device.type === expectedType ? '✅' : '❌';
      console.log(`   ${status} ${device.device_id}: ${device.type} (esperado: ${expectedType})`);
    });
    
    console.log('\n🎉 Corrección de tipos de dispositivos completada!');
    
  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
    process.exit(1);
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main().then(() => {
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { main, DEVICE_TYPE_CORRECTIONS, DEVICE_TYPE_PATTERNS };