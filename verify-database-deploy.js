#!/usr/bin/env node

/**
 * Script de verificación automática para deployment de base de datos
 * Valida que todas las tablas necesarias estén creadas después del deploy
 */

require('dotenv').config();
const { query } = require('./src/config/database');

async function verifyDatabaseDeployment() {
  console.log('🔍 Verificando deployment de base de datos...\n');

  try {
    // Tablas principales requeridas
    const requiredTables = [
      // Tablas principales del sistema
      'users',
      'devices', 
      'rules',
      'notifications',
      
      // Tablas de sensores legacy
      'temhum1',
      'temhum2', 
      'calidad_agua',
      'luxometro',
      'power_monitor_logs',
      'weather_current',
      
      // Tablas de operaciones
      'rule_executions',
      'operations_log',
      'scheduled_operations',
      
      // Tablas de seguridad
      'audit_logs',
      'user_sessions',
      'security_events',
      
      // Tablas de sensores dinámicos (nuevas)
      'sensors',
      'sensor_data_generic',
      'sensor_statistics',
      'sensor_alerts',
      'temp_pressure_data',
      'soil_moisture_data',
      'co2_data',
      'motion_data',
      'custom_sensor_data',
      
      // Tabla de versión de esquema
      'schema_version'
    ];

    console.log('📋 Verificando tablas requeridas...');
    const missingTables = [];
    const existingTables = [];

    for (const table of requiredTables) {
      try {
        const result = await query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [table]);

        if (result.rows[0].exists) {
          existingTables.push(table);
          console.log(`   ✅ ${table}`);
        } else {
          missingTables.push(table);
          console.log(`   ❌ ${table} - MISSING`);
        }
      } catch (error) {
        missingTables.push(table);
        console.log(`   ❌ ${table} - ERROR: ${error.message}`);
      }
    }

    // Verificar índices críticos
    console.log('\n🔍 Verificando índices críticos...');
    const criticalIndexes = [
      'idx_sensors_sensor_type',
      'idx_temp_pressure_data_sensor_id',
      'idx_temp_pressure_data_received_at',
      'idx_audit_logs_timestamp',
      'idx_notifications_user_id'
    ];

    const missingIndexes = [];
    for (const index of criticalIndexes) {
      try {
        const result = await query(`
          SELECT indexname FROM pg_indexes 
          WHERE schemaname = 'public' AND indexname = $1
        `, [index]);

        if (result.rows.length > 0) {
          console.log(`   ✅ ${index}`);
        } else {
          missingIndexes.push(index);
          console.log(`   ❌ ${index} - MISSING`);
        }
      } catch (error) {
        missingIndexes.push(index);
        console.log(`   ❌ ${index} - ERROR: ${error.message}`);
      }
    }

    // Verificar versión del esquema
    console.log('\n📊 Verificando versión del esquema...');
    try {
      const versionResult = await query('SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1');
      if (versionResult.rows.length > 0) {
        const currentVersion = versionResult.rows[0].version;
        console.log(`   ✅ Versión actual del esquema: ${currentVersion}`);
      } else {
        console.log('   ⚠️ No se encontró información de versión del esquema');
      }
    } catch (error) {
      console.log(`   ❌ Error obteniendo versión del esquema: ${error.message}`);
    }

    // Verificar datos de prueba de sensores dinámicos
    console.log('\n🌡️ Verificando sistema de sensores dinámicos...');
    try {
      // Verificar que la tabla sensors tenga al menos la configuración del sistema
      const sensorsResult = await query('SELECT COUNT(*) as count FROM sensors');
      const sensorsCount = parseInt(sensorsResult.rows[0].count);
      console.log(`   📋 Sensores registrados: ${sensorsCount}`);

      // Verificar que la tabla temp_pressure_data esté lista para BMP280
      const tempPressureResult = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'temp_pressure_data' 
        ORDER BY ordinal_position
      `);
      const columns = tempPressureResult.rows.map(row => row.column_name);
      console.log(`   🌡️ Columnas temp_pressure_data: ${columns.join(', ')}`);

      // Verificar que las columnas requeridas para BMP280 existan
      const requiredColumns = ['sensor_id', 'temperatura', 'presion', 'altitude', 'received_at'];
      const hasAllColumns = requiredColumns.every(col => columns.includes(col));
      
      if (hasAllColumns) {
        console.log('   ✅ Tabla temp_pressure_data lista para sensores BMP280');
      } else {
        const missing = requiredColumns.filter(col => !columns.includes(col));
        console.log(`   ❌ Faltan columnas para BMP280: ${missing.join(', ')}`);
      }

    } catch (error) {
      console.log(`   ❌ Error verificando sensores dinámicos: ${error.message}`);
    }

    // Verificar funciones y triggers
    console.log('\n⚙️ Verificando funciones y triggers...');
    try {
      const functionsResult = await query(`
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_type = 'FUNCTION'
      `);
      const functions = functionsResult.rows.map(row => row.routine_name);
      
      if (functions.includes('update_sensor_timestamp')) {
        console.log('   ✅ Función update_sensor_timestamp existe');
      } else {
        console.log('   ❌ Función update_sensor_timestamp no encontrada');
      }

      const triggersResult = await query(`
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE trigger_schema = 'public'
      `);
      const triggers = triggersResult.rows.map(row => row.trigger_name);
      
      if (triggers.includes('trigger_update_sensor_timestamp')) {
        console.log('   ✅ Trigger trigger_update_sensor_timestamp existe');
      } else {
        console.log('   ❌ Trigger trigger_update_sensor_timestamp no encontrado');
      }

    } catch (error) {
      console.log(`   ❌ Error verificando funciones/triggers: ${error.message}`);
    }

    // Resumen final
    console.log('\n📊 RESUMEN DE VERIFICACIÓN:');
    console.log(`   ✅ Tablas existentes: ${existingTables.length}/${requiredTables.length}`);
    console.log(`   ❌ Tablas faltantes: ${missingTables.length}`);
    console.log(`   ❌ Índices faltantes: ${missingIndexes.length}`);

    if (missingTables.length > 0) {
      console.log('\n⚠️ TABLAS FALTANTES:');
      missingTables.forEach(table => console.log(`   - ${table}`));
    }

    if (missingIndexes.length > 0) {
      console.log('\n⚠️ ÍNDICES FALTANTES:');
      missingIndexes.forEach(index => console.log(`   - ${index}`));
    }

    // Verificar si todo está bien para el sistema de sensores BMP280
    const bmp280Ready = existingTables.includes('sensors') && 
                       existingTables.includes('temp_pressure_data') &&
                       existingTables.includes('sensor_data_generic');

    console.log('\n🌡️ ESTADO DEL SISTEMA BMP280:');
    if (bmp280Ready) {
      console.log('   ✅ Sistema listo para sensores BMP280 dinámicos');
      console.log('   📡 MQTT Topic soportado: Invernadero/BMP280-1/data');
      console.log('   📝 Payload soportado: {"temperatura":12.36,"presion":99167.67}');
    } else {
      console.log('   ❌ Sistema NO está listo para sensores BMP280');
    }

    // Determinar si el deployment fue exitoso
    const deploymentSuccess = missingTables.length === 0 && bmp280Ready;
    
    console.log('\n🚀 RESULTADO DEL DEPLOYMENT:');
    if (deploymentSuccess) {
      console.log('   ✅ DEPLOYMENT EXITOSO - Todas las tablas están listas');
      console.log('   🎉 Sistema de sensores dinámicos funcionando');
      console.log('   📡 Backend listo para crear sensores BMP280 via GraphQL');
      return true;
    } else {
      console.log('   ❌ DEPLOYMENT INCOMPLETO - Faltan componentes críticos');
      if (missingTables.length > 0) {
        console.log('   🔧 Ejecutar: node init-database.js');
      }
      return false;
    }

  } catch (error) {
    console.error('❌ Error en verificación de deployment:', error);
    return false;
  }
}

// Ejecutar verificación si se llama directamente
if (require.main === module) {
  verifyDatabaseDeployment()
    .then(success => {
      if (success) {
        console.log('\n🎉 Verificación completada exitosamente!');
        process.exit(0);
      } else {
        console.log('\n❌ Verificación falló - revisar deployment');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Error crítico en verificación:', error);
      process.exit(1);
    });
}

module.exports = { verifyDatabaseDeployment };