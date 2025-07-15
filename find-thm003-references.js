#!/usr/bin/env node

/**
 * Buscar todas las referencias a THM-003 en la base de datos
 * para encontrar qué regla o configuración está generando el tópico MQTT
 */

const { query } = require('./src/config/database');

async function findTHM003References() {
  try {
    console.log('🔍 Buscando todas las referencias a THM-003 en la base de datos');
    console.log('='.repeat(60));
    
    // 1. Buscar en reglas (conditions y actions)
    console.log('\n📋 1. Buscando en reglas...');
    const rulesQuery = `
      SELECT id, name, enabled, conditions, actions, description
      FROM rules 
      WHERE conditions::text ILIKE '%THM-003%' 
         OR actions::text ILIKE '%THM-003%'
         OR conditions::text ILIKE '%thm%'
         OR actions::text ILIKE '%thm%'
    `;
    
    const rulesResult = await query(rulesQuery);
    if (rulesResult.rows.length > 0) {
      console.log('✅ Reglas que referencian THM o sensores de temperatura:');
      rulesResult.rows.forEach(rule => {
        console.log(`\n  🔧 Regla ID ${rule.id}: ${rule.name} (${rule.enabled ? 'ACTIVA' : 'INACTIVA'})`);
        console.log(`     Descripción: ${rule.description}`);
        console.log(`     Condiciones: ${JSON.stringify(rule.conditions, null, 2)}`);
        console.log(`     Acciones: ${JSON.stringify(rule.actions, null, 2)}`);
        console.log('     ' + '-'.repeat(50));
      });
    } else {
      console.log('❌ No se encontraron reglas con referencias directas a THM');
    }
    
    // 2. Buscar en sensor_data tables para ver si hay datos de THM-003
    console.log('\n📊 2. Buscando datos de sensores THM-003...');
    
    // Check different sensor data tables
    const tables = ['sensor_data_temhum1', 'sensor_data_temhum2', 'sensor_data_generic'];
    
    for (const table of tables) {
      try {
        const dataQuery = `
          SELECT sensor_id, timestamp, temperatura, humedad 
          FROM ${table} 
          WHERE sensor_id ILIKE '%THM-003%' 
             OR sensor_id ILIKE '%003%'
          ORDER BY timestamp DESC 
          LIMIT 5
        `;
        
        const dataResult = await query(dataQuery);
        if (dataResult.rows.length > 0) {
          console.log(`✅ Datos encontrados en ${table}:`);
          dataResult.rows.forEach(row => {
            console.log(`  - Sensor: ${row.sensor_id}, Temp: ${row.temperatura}°C, Hum: ${row.humedad}%, Timestamp: ${row.timestamp}`);
          });
        }
      } catch (tableError) {
        console.log(`  ⚠️ Tabla ${table} no existe o no accesible`);
      }
    }
    
    // 3. Buscar en configuraciones de dispositivos
    console.log('\n🔧 3. Buscando en configuraciones de dispositivos...');
    const devConfigQuery = `
      SELECT id, name, device_id, configuration 
      FROM devices 
      WHERE configuration::text ILIKE '%THM-003%'
         OR configuration::text ILIKE '%thm%'
    `;
    
    const devConfigResult = await query(devConfigQuery);
    if (devConfigResult.rows.length > 0) {
      console.log('✅ Dispositivos con configuraciones THM:');
      devConfigResult.rows.forEach(device => {
        console.log(`\n  🔧 Dispositivo ID ${device.id}: ${device.name}`);
        console.log(`     Device ID: ${device.device_id}`);
        console.log(`     Configuración: ${JSON.stringify(device.configuration, null, 2)}`);
      });
    }
    
    // 4. Buscar en scheduled_operations
    console.log('\n⏰ 4. Buscando en operaciones programadas...');
    try {
      const schedQuery = `
        SELECT id, name, device_id, operation_type, parameters
        FROM scheduled_operations 
        WHERE parameters::text ILIKE '%THM-003%'
           OR device_id::text ILIKE '%THM-003%'
      `;
      
      const schedResult = await query(schedQuery);
      if (schedResult.rows.length > 0) {
        console.log('✅ Operaciones programadas con THM-003:');
        schedResult.rows.forEach(op => {
          console.log(`  - ID ${op.id}: ${op.name} (Device: ${op.device_id})`);
          console.log(`    Tipo: ${op.operation_type}`);
          console.log(`    Parámetros: ${JSON.stringify(op.parameters, null, 2)}`);
        });
      }
    } catch (schedError) {
      console.log('  ⚠️ Tabla scheduled_operations no accesible');
    }
    
    // 5. Buscar en ejecuciones de reglas recientes
    console.log('\n🔄 5. Buscando ejecuciones recientes de reglas...');
    try {
      const execQuery = `
        SELECT re.id, re.rule_id, r.name, re.triggered_at, re.success, re.metadata
        FROM rule_executions re
        JOIN rules r ON re.rule_id = r.id
        WHERE re.metadata::text ILIKE '%THM-003%'
           OR re.metadata::text ILIKE '%thm%'
        ORDER BY re.triggered_at DESC
        LIMIT 10
      `;
      
      const execResult = await query(execQuery);
      if (execResult.rows.length > 0) {
        console.log('✅ Ejecuciones de reglas con referencias THM:');
        execResult.rows.forEach(exec => {
          console.log(`  - ${exec.triggered_at}: Regla "${exec.name}" (${exec.success ? 'ÉXITO' : 'FALLO'})`);
          if (exec.metadata) {
            console.log(`    Metadata: ${JSON.stringify(exec.metadata, null, 2)}`);
          }
        });
      }
    } catch (execError) {
      console.log('  ⚠️ Tabla rule_executions no accesible');
    }
    
    // Conclusiones
    console.log('\n💡 CONCLUSIONES:');
    console.log('='.repeat(40));
    console.log('');
    console.log('Si aparecen mensajes MQTT en Invernadero/THM-003 sin dispositivo físico,');
    console.log('las posibles causas son:');
    console.log('');
    console.log('1. 🔧 Una regla está intentando leer datos de un sensor THM-003 configurado');
    console.log('   pero que no existe físicamente');
    console.log('');
    console.log('2. 🤖 El sistema de auto-discovery está generando mensajes de prueba');
    console.log('');
    console.log('3. 💾 Hay datos cached o configuraciones residuales que referencian THM-003');
    console.log('');
    console.log('4. 🔄 El motor de reglas está evaluando condiciones que consultan este sensor');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error durante la búsqueda:', error);
  }
}

// Ejecutar la búsqueda
findTHM003References()
  .then(() => {
    console.log('\n✅ Búsqueda completada!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Búsqueda falló:', error);
    process.exit(1);
  });