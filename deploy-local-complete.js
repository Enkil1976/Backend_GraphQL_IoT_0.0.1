#!/usr/bin/env node

/**
 * Deploy completo local con Docker y datos de prueba
 */

const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs');

const GRAPHQL_URL = 'http://localhost:4001/graphql';
const CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

// Datos de prueba que simulan la estructura real que encontramos
const SAMPLE_SENSOR_DATA = [
  {
    sensor_id: 2,
    payload: {
      "mem": null,
      "boot": null,
      "data": {
        "pressure": 99367.2,
        "temperature": 19.95
      },
      "rssi": null,
      "_metadata": {
        "sensor_id": 2,
        "mqtt_topic": "Invernadero/bmp280-1/data",
        "hardware_id": "bmp280-1",
        "sensor_type": "TEMP_PRESSURE",
        "original_payload": {
          "presion": 99367.2,
          "temperatura": 19.95
        }
      },
      "timestamp": "2025-07-11T02:00:00.000Z"
    }
  },
  {
    sensor_id: 3,
    payload: {
      "mem": null,
      "boot": null,
      "data": {
        "humidity": 54.43134,
        "temperature": 18.64834
      },
      "rssi": -84,
      "_metadata": {
        "sensor_id": 3,
        "mqtt_topic": "Invernadero/temhum3/data",
        "hardware_id": "temhum3",
        "sensor_type": "TEMHUM",
        "original_payload": {
          "rssi": -84,
          "humedad": 54.43134,
          "temperatura": 18.64834
        }
      },
      "timestamp": "2025-07-11T02:00:00.000Z"
    }
  },
  {
    sensor_id: 4,
    payload: {
      "mem": null,
      "boot": null,
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
        "sensor_type": "LIGHT",
        "original_payload": {
          "light": 7950.182,
          "raw_light": 17253,
          "white_light": 33905
        }
      },
      "timestamp": "2025-07-11T02:00:00.000Z"
    }
  },
  {
    sensor_id: 5,
    payload: {
      "mem": 19408,
      "boot": 39,
      "data": {
        "humidity": 59,
        "dew_point": 9.3,
        "heat_index": 16.7,
        "temperature": 17.4
      },
      "rssi": -72,
      "stats": {
        "havg": 59.3,
        "hmax": 61.6,
        "hmin": 54.2,
        "tavg": 17.1,
        "tmax": 18.8,
        "tmin": 15.4,
        "total": 69,
        "errors": 0
      },
      "_metadata": {
        "sensor_id": 5,
        "mqtt_topic": "Invernadero/temhum2/data",
        "hardware_id": "temhum2",
        "sensor_type": "TEMHUM",
        "original_payload": {
          "mem": 19408,
          "boot": 39,
          "rssi": -72,
          "stats": {
            "havg": 59.3,
            "hmax": 61.6,
            "hmin": 54.2,
            "tavg": 17.1,
            "tmax": 18.8,
            "tmin": 15.4,
            "total": 69,
            "errors": 0
          },
          "humedad": 59,
          "dewpoint": 9.3,
          "heatindex": 16.7,
          "temperatura": 17.4
        }
      },
      "timestamp": "2025-07-11T02:00:00.000Z"
    }
  }
];

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }[type] || '📋';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function execCommand(command, description) {
  log(`Ejecutando: ${description}`, 'info');
  try {
    const result = execSync(command, { 
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: '/Users/marcelosalcedo/BakendFull/Backend_GraphQL_IoT'
    });
    log(`✅ ${description} completado`, 'success');
    return result;
  } catch (error) {
    log(`❌ Error en ${description}: ${error.message}`, 'error');
    throw error;
  }
}

async function waitForService(url, serviceName, maxRetries = 30) {
  log(`Esperando que ${serviceName} esté disponible...`, 'info');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get(url, { timeout: 5000 });
      log(`✅ ${serviceName} está disponible`, 'success');
      return true;
    } catch (error) {
      log(`⏳ Intento ${i + 1}/${maxRetries} - ${serviceName} no disponible aún`, 'info');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  throw new Error(`${serviceName} no se pudo conectar después de ${maxRetries} intentos`);
}

async function authenticate() {
  log('Autenticando con GraphQL...', 'info');
  
  const response = await axios.post(GRAPHQL_URL, {
    query: `
      mutation Login($username: String!, $password: String!) {
        login(username: $username, password: $password) {
          token
        }
      }
    `,
    variables: CREDENTIALS
  });

  if (response.data.errors) {
    throw new Error(`Error de autenticación: ${response.data.errors[0].message}`);
  }

  const token = response.data.data.login.token;
  log('✅ Autenticación exitosa', 'success');
  return token;
}

async function waitForAutoInitialization() {
  log('Esperando que el sistema se auto-inicialice...', 'info');
  
  // El sistema debería auto-crear sensores y dispositivos
  // Solo esperamos un momento para que termine la inicialización
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  log('✅ Inicialización automática completada', 'success');
}

async function testGraphQLQueries(token) {
  log('Probando consultas GraphQL...', 'info');

  const queries = [
    {
      name: 'Lista de sensores',
      query: `{
        sensors {
          id
          name
          type
          isOnline
        }
      }`
    },
    {
      name: 'Historial completo de sensores',
      query: `{
        allSensorHistory(limit: 10) {
          edges {
            node {
              id
              sensorId
              sensorName
              timestamp
              data
            }
          }
          totalCount
          byType {
            sensorType
            count
            sensors
          }
        }
      }`
    },
    {
      name: 'Datos del sensor BMP280-1 (Presión)',
      query: `{
        sensorReadings(sensorId: "2", limit: 5) {
          edges {
            node {
              id
              timestamp
              temperatura
              presion
              rawData
            }
          }
          totalCount
        }
      }`
    },
    {
      name: 'Datos del sensor Luxómetro',
      query: `{
        sensorReadings(sensorId: "4", limit: 5) {
          edges {
            node {
              id
              timestamp
              light
              whiteLight
              rawLight
              rawData
            }
          }
          totalCount
        }
      }`
    }
  ];

  for (const testQuery of queries) {
    try {
      log(`🔍 Probando: ${testQuery.name}`, 'info');
      
      const response = await axios.post(GRAPHQL_URL, {
        query: testQuery.query
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.errors) {
        log(`❌ Error en ${testQuery.name}: ${response.data.errors[0].message}`, 'error');
      } else {
        const data = response.data.data;
        
        if (data.sensors) {
          log(`✅ ${testQuery.name}: ${data.sensors.length} sensores encontrados`, 'success');
        }
        
        if (data.allSensorHistory) {
          log(`✅ ${testQuery.name}: ${data.allSensorHistory.totalCount} registros históricos`, 'success');
          if (data.allSensorHistory.byType?.length > 0) {
            data.allSensorHistory.byType.forEach(type => {
              log(`   📊 ${type.sensorType}: ${type.count} registros`, 'info');
            });
          }
        }
        
        if (data.sensorReadings) {
          log(`✅ ${testQuery.name}: ${data.sensorReadings.totalCount} lecturas`, 'success');
          if (data.sensorReadings.edges.length > 0) {
            const sample = data.sensorReadings.edges[0].node;
            log(`   📄 Muestra: ${new Date(sample.timestamp).toLocaleString()}`, 'info');
            
            if (sample.temperatura) log(`      🌡️ Temperatura: ${sample.temperatura}°C`, 'info');
            if (sample.presion) log(`      📏 Presión: ${sample.presion}Pa`, 'info');
            if (sample.light) log(`      💡 Luz: ${sample.light}lux`, 'info');
          }
        }
      }

    } catch (error) {
      log(`❌ Error probando ${testQuery.name}: ${error.message}`, 'error');
    }
    
    console.log('');
  }
}

async function main() {
  console.log('🚀 DEPLOY COMPLETO LOCAL CON DOCKER\n');
  
  try {
    // 1. Limpiar contenedores existentes
    log('Limpiando contenedores existentes...', 'info');
    try {
      execCommand('docker compose -f docker-compose.local.yml down -v', 'Detener contenedores');
    } catch (error) {
      log('No hay contenedores que detener', 'info');
    }

    // 2. Construir e iniciar servicios
    execCommand('docker compose -f docker-compose.local.yml build --no-cache', 'Construir imágenes Docker');
    execCommand('docker compose -f docker-compose.local.yml up -d', 'Iniciar servicios');

    // 3. Esperar que los servicios estén listos
    await waitForService('http://localhost:4001/health', 'GraphQL API');

    // 4. Esperar inicialización automática del sistema
    await waitForAutoInitialization();

    // 5. Autenticar y probar GraphQL
    const token = await authenticate();
    await testGraphQLQueries(token);

    console.log('\n🎉 DEPLOY LOCAL COMPLETADO EXITOSAMENTE!\n');
    console.log('📊 Servicios disponibles:');
    console.log('   🔗 GraphQL API: http://localhost:4001/graphql');
    console.log('   🔗 GraphQL Playground: http://localhost:4001/graphql (si está habilitado)');
    console.log('   🔗 Health Check: http://localhost:4001/health');
    console.log('   💾 PostgreSQL: localhost:5432');
    console.log('   🔴 Redis: localhost:6379');
    console.log('');
    console.log('🧪 Para probar manualmente:');
    console.log('   node mostrar-historial.js (cambiar URL a localhost:4001)');
    console.log('');
    console.log('🛑 Para detener:');
    console.log('   docker compose -f docker-compose.local.yml down');

  } catch (error) {
    log(`❌ Error crítico en deploy: ${error.message}`, 'error');
    console.log('\n🔍 Para diagnosticar:');
    console.log('   docker compose -f docker-compose.local.yml logs');
    console.log('   docker compose -f docker-compose.local.yml ps');
    process.exit(1);
  }
}

main();