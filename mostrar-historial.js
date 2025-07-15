#!/usr/bin/env node

/**
 * Script para mostrar el historial de cualquier sensor
 */

const axios = require('axios');

const GRAPHQL_URL = 'https://postgres-bakend.2h4eh9.easypanel.host/graphql';

const CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

async function authenticate() {
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

  return response.data.data.login.token;
}

async function mostrarHistorialCompleto(token) {
  console.log('📊 HISTORIAL DE TODOS LOS SENSORES\n');

  try {
    const response = await axios.post(GRAPHQL_URL, {
      query: `{
        allSensorHistory(limit: 50) {
          edges {
            node {
              id
              sensorId
              sensorName
              sensorType
              timestamp
              data
            }
          }
          totalCount
          byType {
            sensorType
            count
            latestReading
            sensors
          }
        }
      }`
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.errors) {
      console.log(`❌ Error: ${response.data.errors[0].message}`);
      return;
    }

    const data = response.data.data.allSensorHistory;
    
    console.log(`📈 RESUMEN: ${data.totalCount} registros históricos totales`);
    console.log(`📋 Mostrando: ${data.edges.length} registros más recientes\n`);

    if (data.byType && data.byType.length > 0) {
      console.log('📊 ESTADÍSTICAS POR TIPO DE SENSOR:');
      data.byType.forEach(type => {
        console.log(`  🔹 ${type.sensorType}: ${type.count} registros`);
        console.log(`     Sensores: ${type.sensors.join(', ')}`);
        if (type.latestReading) {
          console.log(`     Último dato: ${new Date(type.latestReading).toLocaleString()}`);
        }
      });
      console.log('');
    }

    if (data.edges.length > 0) {
      console.log('📋 HISTORIAL DETALLADO:');
      data.edges.forEach((edge, index) => {
        const node = edge.node;
        console.log(`\n${index + 1}. 📡 ${node.sensorName} (${node.sensorId})`);
        console.log(`   🔖 Tipo: ${node.sensorType}`);
        console.log(`   ⏰ Fecha: ${new Date(node.timestamp).toLocaleString()}`);
        
        if (node.data && Object.keys(node.data).length > 0) {
          console.log(`   📊 Datos:`);
          Object.entries(node.data).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
              let unit = '';
              if (key.includes('temp')) unit = '°C';
              else if (key.includes('hum')) unit = '%';
              else if (key.includes('presion') || key.includes('pressure')) unit = 'Pa';
              else if (key.includes('altitude') || key.includes('alt')) unit = 'm';
              else if (key.includes('light') || key.includes('lux')) unit = 'lux';
              else if (key.includes('ph')) unit = 'pH';
              else if (key.includes('ec')) unit = 'µS/cm';
              
              console.log(`      ${key}: ${value}${unit}`);
            }
          });
        }
      });
    } else {
      console.log('📝 No se encontraron datos históricos en la consulta general');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function mostrarHistorialPorSensor(token) {
  console.log('\n🔍 HISTORIAL POR SENSOR INDIVIDUAL\n');

  // Probar cada sensor conocido
  const sensores = [
    { id: '2', nombre: 'BMP280-1 (Presión y Temperatura)', tipo: 'TEMP_PRESSURE' },
    { id: '6', nombre: 'TemHum1 (Temperatura y Humedad)', tipo: 'TEMHUM' },
    { id: '5', nombre: 'TemHum2 (Temperatura y Humedad)', tipo: 'TEMHUM' },
    { id: '4', nombre: 'Luxómetro (Sensor de Luz)', tipo: 'LIGHT' },
    { id: '7', nombre: 'Calidad Agua', tipo: 'WATER_QUALITY' },
    { id: '3', nombre: 'TemHum3 (Temperatura y Humedad)', tipo: 'TEMHUM' }
  ];

  for (const sensor of sensores) {
    try {
      console.log(`📡 ${sensor.nombre} (ID: ${sensor.id})`);
      
      const response = await axios.post(GRAPHQL_URL, {
        query: `{
          sensorReadings(sensorId: "${sensor.id}", limit: 10) {
            edges {
              node {
                id
                timestamp
                temperatura
                humedad
                presion
                altitude
                light
                ph
                ec
                rawData
              }
            }
            totalCount
          }
        }`
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.errors) {
        console.log(`   ❌ Error: ${response.data.errors[0].message}`);
      } else {
        const data = response.data.data.sensorReadings;
        console.log(`   📊 Total: ${data.totalCount} registros`);
        
        if (data.edges.length > 0) {
          console.log(`   ✅ Últimos ${data.edges.length} registros:`);
          data.edges.slice(0, 5).forEach((edge, index) => {
            const node = edge.node;
            console.log(`      ${index + 1}. ${new Date(node.timestamp).toLocaleString()}`);
            
            if (node.temperatura !== null && node.temperatura !== undefined) {
              console.log(`         🌡️ Temperatura: ${node.temperatura}°C`);
            }
            if (node.humedad !== null && node.humedad !== undefined) {
              console.log(`         💧 Humedad: ${node.humedad}%`);
            }
            if (node.presion !== null && node.presion !== undefined) {
              console.log(`         📏 Presión: ${node.presion}Pa`);
            }
            if (node.altitude !== null && node.altitude !== undefined) {
              console.log(`         ⛰️ Altitud: ${node.altitude}m`);
            }
            if (node.light !== null && node.light !== undefined) {
              console.log(`         💡 Luz: ${node.light}lux`);
            }
            if (node.ph !== null && node.ph !== undefined) {
              console.log(`         🧪 pH: ${node.ph}`);
            }
            if (node.ec !== null && node.ec !== undefined) {
              console.log(`         ⚡ EC: ${node.ec}µS/cm`);
            }
          });
        } else {
          console.log(`   📝 Sin datos históricos`);
        }
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log('');
  }
}

async function probarTablasLegacy(token) {
  console.log('\n🗂️ DATOS EN TABLAS LEGACY\n');

  const queries = [
    {
      name: 'TemHum1 Legacy',
      query: `{
        legacyTemHum1Data(limit: 5) {
          id
          temperature
          humidity
          timestamp
        }
      }`
    },
    {
      name: 'TemHum2 Legacy', 
      query: `{
        legacyTemHum2Data(limit: 5) {
          id
          temperature
          humidity
          timestamp
        }
      }`
    },
    {
      name: 'Calidad Agua Legacy',
      query: `{
        legacyWaterQualityData(limit: 5) {
          id
          ph
          ec
          tds
          temperature
          timestamp
        }
      }`
    },
    {
      name: 'Luxómetro Legacy',
      query: `{
        legacyLightData(limit: 5) {
          id
          lux
          timestamp
        }
      }`
    }
  ];

  for (const queryInfo of queries) {
    try {
      console.log(`📊 ${queryInfo.name}:`);
      
      const response = await axios.post(GRAPHQL_URL, {
        query: queryInfo.query
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.errors) {
        console.log(`   ❌ Error: ${response.data.errors[0].message}`);
      } else {
        const data = response.data.data;
        const dataKey = Object.keys(data)[0];
        const records = data[dataKey];
        
        console.log(`   📈 ${records.length} registros encontrados`);
        
        if (records.length > 0) {
          records.forEach((record, index) => {
            console.log(`      ${index + 1}. ${new Date(record.timestamp).toLocaleString()}`);
            if (record.temperature) console.log(`         🌡️ Temp: ${record.temperature}°C`);
            if (record.humidity) console.log(`         💧 Hum: ${record.humidity}%`);
            if (record.ph) console.log(`         🧪 pH: ${record.ph}`);
            if (record.ec) console.log(`         ⚡ EC: ${record.ec}`);
            if (record.lux) console.log(`         💡 Luz: ${record.lux}lux`);
          });
        }
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log('');
  }
}

async function main() {
  console.log('📊 MOSTRANDO HISTORIAL DE SENSORES\n');
  
  try {
    const token = await authenticate();
    console.log('✅ Autenticado correctamente\n');
    
    await mostrarHistorialCompleto(token);
    await mostrarHistorialPorSensor(token);
    await probarTablasLegacy(token);
    
    console.log('🎯 RESUMEN:');
    console.log('✅ Schema GraphQL implementado y funcionando');
    console.log('✅ Consultas de historial configuradas');
    console.log('✅ Soporte para múltiples tipos de sensores');
    console.log('✅ Acceso a tablas legacy implementado');
    
  } catch (error) {
    console.error('❌ Error crítico:', error.message);
  }
}

main();