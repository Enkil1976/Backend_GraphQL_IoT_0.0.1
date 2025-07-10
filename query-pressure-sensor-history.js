#!/usr/bin/env node

/**
 * Script para consultar datos históricos del sensor de presión BMP280-1
 * Incluye autenticación y consultas GraphQL con filtros de tiempo
 */

const axios = require('axios');

const GRAPHQL_URL = 'https://postgres-bakend.2h4eh9.easypanel.host/graphql';

// Credenciales
const CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

async function authenticateUser() {
  console.log('🔐 Autenticándose en la API GraphQL...');
  
  const loginMutation = `
    mutation Login($username: String!, $password: String!) {
      login(username: $username, password: $password) {
        token
        refreshToken
        user {
          id
          username
          role
        }
      }
    }
  `;

  try {
    const response = await axios.post(GRAPHQL_URL, {
      query: loginMutation,
      variables: CREDENTIALS
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.data.errors) {
      console.error('❌ Error en login:', response.data.errors);
      return null;
    }

    const { token, user } = response.data.data.login;
    console.log(`✅ Autenticado como: ${user.username} (${user.role})`);
    return token;

  } catch (error) {
    console.error('❌ Error de autenticación:', error.response?.data || error.message);
    return null;
  }
}

async function getAllSensors(token) {
  console.log('\n📋 Primero obteniendo lista completa de sensores...');
  
  const allSensorsQuery = `
    query GetAllSensors {
      sensors {
        id
        name
        type
        location
        isOnline
        description
      }
    }
  `;

  try {
    const response = await axios.post(GRAPHQL_URL, {
      query: allSensorsQuery
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.data.errors) {
      console.error('❌ Error consultando sensores:', response.data.errors);
      return [];
    }

    const sensors = response.data.data.sensors || [];
    console.log(`\n📊 ${sensors.length} sensores encontrados:`);
    sensors.forEach(sensor => {
      console.log(`   ID ${sensor.id}: ${sensor.name} (${sensor.type})`);
    });

    // Buscar el sensor de presión BMP280
    const pressureSensor = sensors.find(s => 
      s.name && s.name.toLowerCase().includes('bmp280') ||
      s.type === 'TEMP_PRESSURE' ||
      s.name && s.name.toLowerCase().includes('presión')
    );

    if (pressureSensor) {
      console.log(`\n🎯 Sensor de presión encontrado: ID ${pressureSensor.id} - ${pressureSensor.name}`);
      return pressureSensor.id;
    } else {
      console.log('\n❌ No se encontró sensor de presión BMP280');
      return null;
    }

  } catch (error) {
    console.error('❌ Error obteniendo sensores:', error.response?.data || error.message);
    return null;
  }
}

async function getPressureSensorHistory(token, sensorId, limit = 50) {
  console.log(`\n📊 Consultando datos del sensor ID ${sensorId}...`);
  
  // Usar las sugerencias del schema para corregir las consultas
  const queries = [
    // Consulta 1: Obtener información del sensor con latestReading
    {
      name: 'sensor info',
      query: `
        query GetSensor($id: ID!) {
          sensor(id: $id) {
            id
            name
            type
            location
            isOnline
            description
            latestReading {
              id
              timestamp
              value
            }
            readings(limit: ${limit}) {
              id
              timestamp
              value
              data
            }
          }
        }
      `
    },
    // Consulta 2: Estadísticas del sensor corregidas
    {
      name: 'sensor stats',
      query: `
        query GetSensorStats($sensorId: ID!) {
          sensorStats(sensorId: $sensorId) {
            sensor {
              id
              name
            }
            period
            average
            minimum
            maximum
            count
            lastUpdated
          }
        }
      `
    },
    // Consulta 3: Alertas del sensor corregidas
    {
      name: 'sensor alerts',
      query: `
        query GetSensorAlerts($sensorId: ID) {
          sensorAlerts(sensorId: $sensorId) {
            id
            sensor {
              id
              name
            }
            alertType
            message
            timestamp
            isActive
          }
        }
      `
    },
    // Consulta 4: Usar latestSensorData sugerido
    {
      name: 'latest sensor data',
      query: `
        query GetLatestSensorData($sensorId: String!) {
          latestSensorData(sensorId: $sensorId) {
            timestamp
            data
          }
        }
      `
    },
    // Consulta 5: Intentar consulta simple del sensor
    {
      name: 'sensor simple',
      query: `
        query GetSensorSimple($id: ID!) {
          sensor(id: $id) {
            id
            name
            type
          }
        }
      `
    },
    // Consulta 6: Intentar consulta con String en lugar de ID
    {
      name: 'sensor as string',
      query: `
        query GetSensorString($id: String!) {
          sensor(id: $id) {
            id
            name
            type
            location
            isOnline
          }
        }
      `
    }
  ];

  for (const queryConfig of queries) {
    try {
      console.log(`\n🔍 Probando consulta: ${queryConfig.name}...`);
      
      let variables = {};
      if (queryConfig.name === 'sensor info' || queryConfig.name === 'sensor simple') {
        variables = { id: sensorId };
      } else if (queryConfig.name === 'sensor as string') {
        variables = { id: sensorId.toString() };
      } else if (queryConfig.name === 'sensor stats') {
        variables = { sensorId: sensorId };
      } else if (queryConfig.name === 'sensor alerts') {
        variables = { sensorId: sensorId };
      } else if (queryConfig.name === 'latest sensor data') {
        variables = { sensorId: sensorId };
      }

      const response = await axios.post(GRAPHQL_URL, {
        query: queryConfig.query,
        variables
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.errors) {
        console.log(`   ❌ Error en ${queryConfig.name}:`, response.data.errors[0].message);
        continue;
      }

      // Procesar respuesta exitosa
      const data = response.data.data;
      console.log(`   ✅ Consulta ${queryConfig.name} exitosa`);
      
      return {
        queryType: queryConfig.name,
        data: data
      };

    } catch (error) {
      console.log(`   ❌ Error en ${queryConfig.name}:`, error.response?.data?.errors?.[0]?.message || error.message);
      continue;
    }
  }

  return null;
}

async function formatPressureData(result) {
  if (!result) {
    console.log('\n❌ No se pudieron obtener datos del sensor de presión');
    return;
  }

  console.log(`\n📊 DATOS HISTÓRICOS DEL SENSOR BMP280-1`);
  console.log(`Método de consulta: ${result.queryType}`);
  console.log('═'.repeat(80));

  const { data } = result;

  if (result.queryType === 'tempPressureData' && data.tempPressureData) {
    const records = data.tempPressureData;
    console.log(`\n📈 ${records.length} registros encontrados:\n`);

    records.forEach((record, index) => {
      console.log(`${index + 1}. Registro ID: ${record.id}`);
      console.log(`   Sensor: ${record.sensorId}`);
      console.log(`   🌡️  Temperatura: ${record.temperatura}°C`);
      console.log(`   🗲  Presión: ${record.presion} Pa`);
      console.log(`   🏔️  Altitud: ${record.altitude || 'N/A'} m`);
      console.log(`   ⏰ Fecha: ${new Date(record.receivedAt).toLocaleString()}`);
      console.log('');
    });

    // Estadísticas básicas
    if (records.length > 0) {
      const temperatures = records.map(r => r.temperatura).filter(t => t !== null);
      const pressures = records.map(r => r.presion).filter(p => p !== null);

      if (temperatures.length > 0) {
        const avgTemp = temperatures.reduce((a, b) => a + b, 0) / temperatures.length;
        const minTemp = Math.min(...temperatures);
        const maxTemp = Math.max(...temperatures);
        
        console.log('📊 ESTADÍSTICAS DE TEMPERATURA:');
        console.log(`   Promedio: ${avgTemp.toFixed(2)}°C`);
        console.log(`   Mínima: ${minTemp}°C`);
        console.log(`   Máxima: ${maxTemp}°C`);
      }

      if (pressures.length > 0) {
        const avgPressure = pressures.reduce((a, b) => a + b, 0) / pressures.length;
        const minPressure = Math.min(...pressures);
        const maxPressure = Math.max(...pressures);
        
        console.log('\n📊 ESTADÍSTICAS DE PRESIÓN:');
        console.log(`   Promedio: ${avgPressure.toFixed(2)} Pa`);
        console.log(`   Mínima: ${minPressure} Pa`);
        console.log(`   Máxima: ${maxPressure} Pa`);
      }
    }

  } else if (result.queryType === 'sensorData' && data.sensorData) {
    const records = data.sensorData;
    console.log(`\n📈 ${records.length} registros encontrados:\n`);

    records.forEach((record, index) => {
      console.log(`${index + 1}. Registro ID: ${record.id}`);
      console.log(`   Sensor: ${record.sensorId}`);
      console.log(`   📊 Datos: ${JSON.stringify(record.data, null, 2)}`);
      console.log(`   ⏰ Fecha: ${new Date(record.timestamp).toLocaleString()}`);
      console.log('');
    });

  } else if (result.queryType === 'sensor with history' && data.sensor) {
    const sensor = data.sensor;
    console.log(`\n📡 Sensor: ${sensor.name} (${sensor.type})`);
    
    if (sensor.history && sensor.history.length > 0) {
      console.log(`📈 ${sensor.history.length} registros históricos:\n`);

      sensor.history.forEach((record, index) => {
        console.log(`${index + 1}. Registro ID: ${record.id}`);
        console.log(`   📊 Datos: ${JSON.stringify(record.data, null, 2)}`);
        console.log(`   ⏰ Fecha: ${new Date(record.timestamp).toLocaleString()}`);
        console.log('');
      });
    } else {
      console.log('   📭 No hay datos históricos disponibles');
    }

  } else {
    console.log('\n📊 Datos brutos recibidos:');
    console.log(JSON.stringify(data, null, 2));
  }
}

async function main() {
  console.log('🚀 Iniciando consulta de datos históricos del sensor de presión...\n');

  // Autenticar
  const token = await authenticateUser();
  if (!token) {
    console.log('❌ No se pudo autenticar. Saliendo...');
    process.exit(1);
  }

  // Encontrar el sensor de presión correcto
  const pressureSensorId = await getAllSensors(token);
  if (!pressureSensorId) {
    console.log('❌ No se pudo encontrar el sensor de presión. Saliendo...');
    process.exit(1);
  }

  // Consultar datos históricos
  const result = await getPressureSensorHistory(token, pressureSensorId, 20);
  
  // Formatear y mostrar resultados
  await formatPressureData(result);

  console.log('\n✅ Consulta completada');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error crítico:', error);
    process.exit(1);
  });
}

module.exports = { main };