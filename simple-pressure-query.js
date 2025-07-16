#!/usr/bin/env node

/**
 * Consulta simple y directa para datos de presión
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

async function queryDirectData(token) {
  console.log('🔍 Intentando consultas directas para datos de presión...\n');

  const queries = [
    // Primero veamos si hay datos básicos sin filtrar
    {
      name: 'sensorReadings basic',
      query: `{ 
        sensorReadings(limit: 5) { 
          edges { 
            node { 
              id 
              timestamp 
            } 
          } 
        } 
      }`
    },
    // Intentar otros campos posibles en SensorReading
    {
      name: 'sensorReadings with measurement',
      query: `{ 
        sensorReadings(limit: 5) { 
          edges { 
            node { 
              id 
              timestamp 
              measurement
            } 
          } 
        } 
      }`
    },
    // Intentar con reading en lugar de value
    {
      name: 'latestSensorData with reading',
      query: `{ latestSensorData { timestamp reading } }`
    },
    // Intentar stats básicos
    {
      name: 'sensorStats basic',
      query: `{ sensorStats(sensorId: "2") { sensor { name } count } }`
    },
    // Ver si hay consultas de datos históricos específicas
    {
      name: 'tempPressureHistory',
      query: `{ tempPressureHistory(sensorId: "2", limit: 10) { temperatura presion timestamp } }`
    },
    // Consultar todos los sensores filtrados por tipo
    {
      name: 'pressure sensors',
      query: `{ sensors(filter: { type: "TEMP_PRESSURE" }) { id name type location isOnline } }`
    }
  ];

  for (const q of queries) {
    try {
      console.log(`🔍 Probando: ${q.name}...`);
      
      const response = await axios.post(GRAPHQL_URL, {
        query: q.query
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.errors) {
        console.log(`   ❌ ${response.data.errors[0].message}`);
      } else {
        console.log(`   ✅ Éxito!`);
        console.log('   📊 Datos:', JSON.stringify(response.data.data, null, 2));
        return;
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
  }
}

async function main() {
  console.log('🚀 Consulta simple de datos de presión\n');
  
  const token = await authenticate();
  console.log('✅ Autenticado\n');
  
  await queryDirectData(token);
  
  console.log('\n✅ Consulta completada');
}

main().catch(console.error);