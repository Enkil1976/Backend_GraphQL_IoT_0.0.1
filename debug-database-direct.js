#!/usr/bin/env node

/**
 * Script para diagnosticar directamente la base de datos
 */

require('dotenv').config();
const { pool } = require('./src/config/database');

async function debugDatabase() {
  console.log('🔍 Diagnóstico directo de la base de datos...\n');

  try {
    // Check what's in sensor_data_generic
    console.log('📊 Verificando sensor_data_generic...');
    const genericResult = await pool.query(`
      SELECT sensor_id, COUNT(*) as count, 
             MIN(timestamp) as first_data, 
             MAX(timestamp) as last_data,
             (data::jsonb ? 'temperatura') as has_temp,
             (data::jsonb ? 'presion') as has_pressure
      FROM sensor_data_generic 
      GROUP BY sensor_id, (data::jsonb ? 'temperatura'), (data::jsonb ? 'presion')
      ORDER BY sensor_id
    `);
    
    console.log(`   Encontrados ${genericResult.rows.length} grupos de datos`);
    genericResult.rows.forEach(row => {
      console.log(`   📈 Sensor ${row.sensor_id}: ${row.count} registros`);
      console.log(`      Desde: ${row.first_data}`);
      console.log(`      Hasta: ${row.last_data}`);
      console.log(`      Temp: ${row.has_temp}, Presión: ${row.has_pressure}`);
    });

    // Check sample data from sensor_data_generic
    console.log('\n🔍 Muestra de datos en sensor_data_generic...');
    const sampleResult = await pool.query(`
      SELECT sensor_id, data, timestamp 
      FROM sensor_data_generic 
      ORDER BY timestamp DESC 
      LIMIT 10
    `);
    
    sampleResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. Sensor: ${row.sensor_id}, Tiempo: ${row.timestamp}`);
      console.log(`      Datos: ${JSON.stringify(row.data, null, 6)}`);
    });

    // Check sensors table
    console.log('\n📋 Verificando tabla sensors...');
    const sensorsResult = await pool.query(`
      SELECT id, hardware_id, name, sensor_type 
      FROM sensors 
      ORDER BY id
    `);
    
    sensorsResult.rows.forEach(row => {
      console.log(`   Sensor ID ${row.id}: ${row.hardware_id} (${row.name}) - Tipo: ${row.sensor_type}`);
    });

    // Check legacy tables
    console.log('\n🗂️ Verificando tablas legacy...');
    const legacyTables = ['sensor_data_temhum1', 'sensor_data_temhum2', 'sensor_data_calidad_agua', 'sensor_data_luxometro'];
    
    for (const table of legacyTables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ${table}: ${countResult.rows[0].count} registros`);
        
        if (countResult.rows[0].count > 0) {
          const sampleLegacy = await pool.query(`SELECT * FROM ${table} ORDER BY timestamp DESC LIMIT 3`);
          sampleLegacy.rows.forEach((row, index) => {
            console.log(`      ${index + 1}. ${JSON.stringify(row, null, 6)}`);
          });
        }
      } catch (error) {
        console.log(`   ${table}: ❌ Error - ${error.message}`);
      }
    }

    // Check if there are matching sensor_ids
    console.log('\n🔗 Verificando correspondencia sensor_id <-> hardware_id...');
    const matchQuery = await pool.query(`
      SELECT s.id, s.hardware_id, s.name, 
             COUNT(sd.id) as data_count
      FROM sensors s
      LEFT JOIN sensor_data_generic sd ON sd.sensor_id = s.hardware_id
      GROUP BY s.id, s.hardware_id, s.name
      ORDER BY s.id
    `);
    
    matchQuery.rows.forEach(row => {
      console.log(`   Sensor ${row.id} (${row.hardware_id}): ${row.data_count} registros de datos`);
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  } finally {
    await pool.end();
  }
}

debugDatabase();