#!/usr/bin/env node

/**
 * Script para verificar la estructura real de sensor_data_generic
 */

require('dotenv').config();
const { pool } = require('./src/config/database');

async function checkTableStructure() {
  console.log('🔍 Verificando estructura real de sensor_data_generic...\n');

  try {
    // Obtener información de columnas
    console.log('📋 Columnas de sensor_data_generic:');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'sensor_data_generic'
      ORDER BY ordinal_position
    `);
    
    columnsResult.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Verificar si hay datos
    console.log('\n📊 Conteo de registros:');
    const countResult = await pool.query('SELECT COUNT(*) as count FROM sensor_data_generic');
    console.log(`   Total registros: ${countResult.rows[0].count}`);

    if (countResult.rows[0].count > 0) {
      // Obtener muestra de datos
      console.log('\n📄 Muestra de datos (primeros 3 registros):');
      const sampleResult = await pool.query(`
        SELECT * FROM sensor_data_generic 
        ORDER BY timestamp DESC 
        LIMIT 3
      `);
      
      sampleResult.rows.forEach((row, index) => {
        console.log(`\n   Registro ${index + 1}:`);
        Object.entries(row).forEach(([key, value]) => {
          if (value && typeof value === 'object') {
            console.log(`      ${key}: ${JSON.stringify(value, null, 4)}`);
          } else {
            console.log(`      ${key}: ${value}`);
          }
        });
      });

      // Verificar valores únicos de sensor_id
      console.log('\n🔢 Valores únicos de sensor_id:');
      const sensorIdsResult = await pool.query(`
        SELECT sensor_id, COUNT(*) as count 
        FROM sensor_data_generic 
        GROUP BY sensor_id 
        ORDER BY sensor_id
      `);
      
      sensorIdsResult.rows.forEach(row => {
        console.log(`   sensor_id: ${row.sensor_id} (${row.count} registros)`);
      });
    } else {
      console.log('   ⚠️ No hay datos en la tabla');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTableStructure();