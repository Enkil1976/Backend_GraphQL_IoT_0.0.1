#!/usr/bin/env node

/**
 * Script para insertar datos de prueba en las tablas de sensores
 * Esto nos permitirá probar las consultas históricas
 */

const { query } = require('./src/config/database');

async function insertTestData() {
  console.log('📊 Insertando datos de prueba para las consultas históricas...\n');

  try {
    // 1. Insertar datos de prueba para BMP280 (sensor de presión)
    console.log('🌡️ Insertando datos de temperatura y presión...');
    
    const tempPressureData = [];
    const now = new Date();
    
    // Generar 20 registros de los últimos 20 minutos
    for (let i = 0; i < 20; i++) {
      const timestamp = new Date(now.getTime() - (i * 60000)); // Cada minuto hacia atrás
      const temperatura = 20 + Math.random() * 10; // 20-30°C
      const presion = 100000 + Math.random() * 5000; // ~100kPa
      const altitude = 100 + Math.random() * 50; // ~100-150m
      
      tempPressureData.push({
        sensor_id: 'BMP280-1',
        temperatura: parseFloat(temperatura.toFixed(2)),
        presion: parseFloat(presion.toFixed(2)),
        altitude: parseFloat(altitude.toFixed(2)),
        received_at: timestamp
      });
    }

    // Insertar datos de temperatura y presión
    for (const data of tempPressureData) {
      try {
        await query(`
          INSERT INTO temp_pressure_data (sensor_id, temperatura, presion, altitude, received_at)
          VALUES ($1, $2, $3, $4, $5)
        `, [data.sensor_id, data.temperatura, data.presion, data.altitude, data.received_at]);
      } catch (error) {
        console.log(`⚠️ Tabla temp_pressure_data no existe o error: ${error.message}`);
        break;
      }
    }

    console.log(`✅ Insertados ${tempPressureData.length} registros en temp_pressure_data`);

    // 2. Insertar datos genéricos para otros sensores
    console.log('\n💧 Insertando datos genéricos de sensores...');
    
    const sensorIds = [3, 4, 5, 6, 7]; // IDs de sensores existentes
    const sensorTypes = {
      3: 'TEMHUM',
      4: 'LIGHT', 
      5: 'TEMHUM',
      6: 'TEMHUM',
      7: 'WATER_QUALITY'
    };

    let genericDataCount = 0;

    for (const sensorId of sensorIds) {
      const sensorType = sensorTypes[sensorId];
      
      // Generar 10 registros por sensor
      for (let i = 0; i < 10; i++) {
        const timestamp = new Date(now.getTime() - (i * 120000)); // Cada 2 minutos
        let data = {};

        switch (sensorType) {
        case 'TEMHUM':
          data = {
            temperatura: parseFloat((18 + Math.random() * 12).toFixed(2)),
            humedad: parseFloat((40 + Math.random() * 40).toFixed(2)),
            heatindex: parseFloat((20 + Math.random() * 8).toFixed(2)),
            rssi: Math.floor(-60 + Math.random() * 20)
          };
          break;
        case 'LIGHT':
          data = {
            light: parseFloat((1000 + Math.random() * 4000).toFixed(2)),
            white_light: parseFloat((800 + Math.random() * 3000).toFixed(2)),
            raw_light: parseFloat((500 + Math.random() * 2000).toFixed(2)),
            uv_index: parseFloat((Math.random() * 10).toFixed(2))
          };
          break;
        case 'WATER_QUALITY':
          data = {
            ph: parseFloat((6 + Math.random() * 2).toFixed(2)),
            ec: parseFloat((800 + Math.random() * 400).toFixed(2)),
            ppm: parseFloat((400 + Math.random() * 200).toFixed(2)),
            temperatura: parseFloat((15 + Math.random() * 10).toFixed(2))
          };
          break;
        }

        try {
          await query(`
            INSERT INTO sensor_data_generic (sensor_id, data, timestamp)
            VALUES ($1, $2, $3)
          `, [sensorId, JSON.stringify(data), timestamp]);
          genericDataCount++;
        } catch (error) {
          console.log(`⚠️ Error insertando datos genéricos para sensor ${sensorId}: ${error.message}`);
        }
      }
    }

    console.log(`✅ Insertados ${genericDataCount} registros en sensor_data_generic`);

    // 3. Verificar datos insertados
    console.log('\n📊 Verificando datos insertados...');
    
    try {
      const tempPressureCount = await query('SELECT COUNT(*) as count FROM temp_pressure_data');
      console.log(`🌡️ Registros en temp_pressure_data: ${tempPressureCount.rows[0].count}`);
    } catch (error) {
      console.log('⚠️ No se pudo consultar temp_pressure_data');
    }

    try {
      const genericCount = await query('SELECT COUNT(*) as count FROM sensor_data_generic');
      console.log(`📊 Registros en sensor_data_generic: ${genericCount.rows[0].count}`);
    } catch (error) {
      console.log('⚠️ No se pudo consultar sensor_data_generic');
    }

    console.log('\n🎉 Datos de prueba insertados exitosamente!');
    console.log('\n💡 Ahora puedes probar las consultas históricas:');
    console.log('   - node test-real-data.js');
    console.log('   - node test-enhanced-schema.js');

  } catch (error) {
    console.error('❌ Error insertando datos de prueba:', error);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  insertTestData()
    .then(() => {
      console.log('\n✅ Script completado');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Script falló:', error);
      process.exit(1);
    });
}

module.exports = { insertTestData };