#!/usr/bin/env node

/**
 * Script para corregir deviceIds incorrectos en las reglas
 * y agregar sensorIds faltantes
 */

const { query } = require('./src/config/database');

async function fixRulesAndDevices() {
  console.log('🔧 Iniciando corrección de reglas y dispositivos...');

  try {
    // 1. Verificar dispositivos existentes
    console.log('\n📊 Dispositivos existentes:');
    const devices = await query('SELECT id, name, type FROM devices ORDER BY id');
    devices.rows.forEach(device => {
      console.log(`   ID ${device.id}: ${device.name} (${device.type})`);
    });

    // 2. Verificar sensores existentes
    console.log('\n📡 Sensores existentes:');
    const sensors = await query('SELECT id, hardware_id, name, sensor_type FROM sensors WHERE is_active = true ORDER BY id');
    sensors.rows.forEach(sensor => {
      console.log(`   ID ${sensor.id}: ${sensor.hardware_id} - ${sensor.name} (${sensor.sensor_type})`);
    });

    // 3. Verificar reglas con problemas
    console.log('\n🔍 Verificando reglas con deviceIds problemáticos...');
    const rules = await query('SELECT id, name, actions FROM rules WHERE enabled = true');
    
    for (const rule of rules.rows) {
      let actions = rule.actions;
      if (typeof actions === 'string') {
        actions = JSON.parse(actions);
      }

      if (Array.isArray(actions)) {
        for (const action of actions) {
          if (action.deviceId && action.deviceId === '6') {
            console.log(`❌ Regla "${rule.name}" (ID: ${rule.id}) usa deviceId 6 (no existe)`);
            
            // Corregir a deviceId 1 (Bomba de Agua Principal)
            action.deviceId = '1';
            
            const updateQuery = 'UPDATE rules SET actions = $1 WHERE id = $2';
            await query(updateQuery, [JSON.stringify(actions), rule.id]);
            
            console.log(`✅ Corregido: deviceId 6 → 1 en regla "${rule.name}"`);
          }
        }
      }
    }

    // 4. Verificar reglas sin sensorId en condiciones
    console.log('\n🔍 Verificando reglas sin sensorId...');
    const rulesWithoutSensor = await query('SELECT id, name, conditions FROM rules WHERE enabled = true');
    
    for (const rule of rulesWithoutSensor.rows) {
      let conditions = rule.conditions;
      if (typeof conditions === 'string') {
        conditions = JSON.parse(conditions);
      }

      if (conditions && conditions.rules && Array.isArray(conditions.rules)) {
        let needsUpdate = false;
        
        for (const condition of conditions.rules) {
          if (condition.type === 'SENSOR' && !condition.sensorId) {
            console.log(`❌ Regla "${rule.name}" (ID: ${rule.id}) sin sensorId`);
            
            // Asignar sensor de agua por defecto (agua-quality-01)
            condition.sensorId = 'agua-quality-01';
            needsUpdate = true;
            
            console.log(`✅ Agregado sensorId: agua-quality-01 a regla "${rule.name}"`);
          }
        }
        
        if (needsUpdate) {
          const updateQuery = 'UPDATE rules SET conditions = $1 WHERE id = $2';
          await query(updateQuery, [JSON.stringify(conditions), rule.id]);
        }
      }
    }

    console.log('\n✅ Corrección de reglas completada!');
    console.log('\n📋 Resumen de cambios:');
    console.log('   - DeviceId 6 → 1 (Bomba de Agua Principal)');
    console.log('   - SensorId faltantes → agua-quality-01');
    console.log('\n🚀 Las reglas deberían funcionar correctamente ahora.');

  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  fixRulesAndDevices();
}

module.exports = { fixRulesAndDevices };