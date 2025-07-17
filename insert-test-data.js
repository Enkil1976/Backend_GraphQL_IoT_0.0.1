#!/usr/bin/env node

/**
 * Script para insertar datos de prueba en sensor_data_generic
 * para poder probar el historial de sensores
 */

const { Pool } = require('pg');
require('dotenv').config();

// Usar la misma configuración que el resto de la aplicación
const dbConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
} : process.env.PG_URI ? {
  connectionString: process.env.PG_URI,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
} : {
  host: process.env.PG_HOST || 'postgres',
  port: parseInt(process.env.PG_PORT, 10) || 5432,
  database: process.env.PG_DATABASE || 'invernadero_iot',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  ssl: false
};

const pool = new Pool(dbConfig);

// Datos de sensores que vimos en los logs MQTT
const sensorData = [
  {
    sensor_id: 2,
    payload: {
      "data": {
        "pressure": 99367.2,
        "temperature": 19.95
      },
      "rssi": null,
      "_metadata": {
        "sensor_id": 2,
        "mqtt_topic": "Invernadero/bmp280-1/data",
        "hardware_id": "bmp280-1",
        "sensor_type": "TEMP_PRESSURE"
      },
      "timestamp": "2025-07-11T02:00:00.000Z"
    }
  },
  {
    sensor_id: 3,
    payload: {
      "data": {
        "humidity": 54.43134,
        "temperature": 18.64834
      },
      "rssi": -84,
      "_metadata": {
        "sensor_id": 3,
        "mqtt_topic": "Invernadero/temhum3/data",
        "hardware_id": "temhum3",
        "sensor_type": "TEMHUM"
      },
      "timestamp": "2025-07-11T02:00:00.000Z"
    }
  },
  {
    sensor_id: 4,
    payload: {
      "data": {
        "light": 7950.182,
        "raw_light": 17253,
        "white_light": 33905
      },
      "rssi": null,
      "_metadata": {
        "sensor_id": 4,
        "mqtt_topic": "Invernadero/luxometro/data",
        "hardware_id": "luxometro",
        "sensor_type": "LIGHT"
      },
      "timestamp": "2025-07-11T02:00:00.000Z"
    }
  },
  {
    sensor_id: 5,
    payload: {
      "data": {
        "humidity": 59,
        "dew_point": 9.3,
        "heat_index": 16.7,
        "temperature": 17.4
      },
      "rssi": -72,
      "_metadata": {
        "sensor_id": 5,
        "mqtt_topic": "Invernadero/temhum2/data",
        "hardware_id": "temhum2",
        "sensor_type": "TEMHUM"
      },
      "timestamp": "2025-07-11T02:00:00.000Z"
    }
  }
];

async function insertTestData() {
  try {
    console.log('🔌 Conectando a PostgreSQL...');
    
    // Verificar conexión
    const client = await pool.connect();
    console.log('✅ Conectado a PostgreSQL');
    
    // Verificar si existe la tabla sensor_data_generic
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'sensor_data_generic'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ La tabla sensor_data_generic no existe');
      client.release();
      return;
    }
    
    console.log('✅ Tabla sensor_data_generic encontrada');
    
    // Primero insertar sensores si no existen
    console.log('📡 Insertando configuración de sensores...');
    
    const sensorsToInsert = [
      { id: 2, hardware_id: 'bmp280-1', name: 'BMP280 Presión', type: 'TEMP_PRESSURE', mqtt_topic: 'Invernadero/bmp280-1/data' },
      { id: 3, hardware_id: 'temhum3', name: 'TemHum3', type: 'TEMHUM', mqtt_topic: 'Invernadero/temhum3/data' },
      { id: 4, hardware_id: 'luxometro', name: 'Luxómetro', type: 'LIGHT', mqtt_topic: 'Invernadero/luxometro/data' },
      { id: 5, hardware_id: 'temhum2', name: 'TemHum2', type: 'TEMHUM', mqtt_topic: 'Invernadero/temhum2/data' }
    ];
    
    for (const sensor of sensorsToInsert) {
      const insertSensorQuery = `
        INSERT INTO sensors (id, hardware_id, name, sensor_type, mqtt_topic, is_active, location)
        VALUES ($1, $2, $3, $4, $5, true, 'Invernadero')
        ON CONFLICT (id) DO UPDATE SET
          hardware_id = EXCLUDED.hardware_id,
          name = EXCLUDED.name,
          sensor_type = EXCLUDED.sensor_type,
          mqtt_topic = EXCLUDED.mqtt_topic
      `;
      
      await client.query(insertSensorQuery, [
        sensor.id, sensor.hardware_id, sensor.name, sensor.type, sensor.mqtt_topic
      ]);
      
      console.log(`✅ Sensor configurado: ${sensor.name} (ID: ${sensor.id})`);
    }
    
    // Insertar datos de prueba
    console.log('📊 Insertando datos de prueba...');
    
    for (const data of sensorData) {
      const insertQuery = `
        INSERT INTO sensor_data_generic 
        (sensor_id, payload, received_at, processed_at)
        VALUES ($1, $2, NOW(), NOW())
      `;
      
      await client.query(insertQuery, [
        data.sensor_id,
        JSON.stringify(data.payload)
      ]);
      
      console.log(`✅ Insertado sensor ${data.sensor_id} (${data.payload._metadata.hardware_id})`);
    }
    
    // Verificar datos insertados
    const countQuery = `
      SELECT sensor_id, COUNT(*) as count 
      FROM sensor_data_generic 
      GROUP BY sensor_id 
      ORDER BY sensor_id
    `;
    
    const result = await client.query(countQuery);
    console.log('\n📊 RESUMEN DE DATOS EN LA BASE:');
    result.rows.forEach(row => {
      console.log(`   Sensor ${row.sensor_id}: ${row.count} registros`);
    });
    
    // Mostrar una muestra de datos
    const sampleQuery = `
      SELECT sensor_id, payload->>'_metadata' as metadata, received_at
      FROM sensor_data_generic 
      ORDER BY received_at DESC 
      LIMIT 5
    `;
    
    const sampleResult = await client.query(sampleQuery);
    console.log('\n📄 MUESTRA DE DATOS RECIENTES:');
    sampleResult.rows.forEach((row, index) => {
      const metadata = JSON.parse(row.metadata);
      console.log(`   ${index + 1}. Sensor ${row.sensor_id} (${metadata.hardware_id}) - ${row.received_at}`);
    });
    
    client.release();
    console.log('\n✅ Datos de prueba insertados correctamente');
    console.log('🔍 Ahora puedes probar las consultas GraphQL');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

insertTestData();