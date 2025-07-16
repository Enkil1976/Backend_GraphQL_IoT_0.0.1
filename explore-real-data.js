#!/usr/bin/env node

/**
 * Script para explorar y encontrar los datos reales en la base de datos
 * Busca en todas las tablas posibles donde pueden estar los datos históricos
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

async function exploreDatabase(token) {
  console.log('🔍 Explorando base de datos para encontrar datos reales...\n');

  // Queries para explorar diferentes tablas y esquemas posibles
  const explorationQueries = [
    {
      name: 'Sensores con hardware_id y mqtt_topic',
      query: `{
        sensors {
          id
          name
          type
          location
          isOnline
        }
      }`
    },
    {
      name: 'Buscar datos directos por GraphQL - sensorReadings sensor 2',
      query: `{
        sensorReadings(sensorId: "2", limit: 5) {
          edges {
            node {
              id
              timestamp
            }
          }
          totalCount
        }
      }`
    },
    {
      name: 'Buscar datos directos por GraphQL - sensorReadings BMP280-1',
      query: `{
        sensorReadings(sensorId: "BMP280-1", limit: 5) {
          edges {
            node {
              id
              timestamp
            }
          }
          totalCount
        }
      }`
    },
    {
      name: 'Probar consulta de estadísticas del sensor 2',
      query: `{
        sensorStats(sensorId: "2", timeRange: {from: "2024-01-01T00:00:00Z", to: "2024-12-31T23:59:59Z"}) {
          sensor {
            id
            name
          }
          totalReadings
          validReadings
        }
      }`
    },
    {
      name: 'Últimos datos de sensores',
      query: `{
        latestSensorData {
          id
          timestamp
        }
      }`
    },
    {
      name: 'Tipos de sensores disponibles',
      query: `{
        sensorTypes {
          id
          name
          description
        }
      }`
    }
  ];

  for (const explorationQuery of explorationQueries) {
    try {
      console.log(`🔍 ${explorationQuery.name}...`);
      
      const response = await axios.post(GRAPHQL_URL, {
        query: explorationQuery.query
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.errors) {
        console.log(`   ❌ Error: ${response.data.errors[0].message}`);
      } else {
        console.log(`   ✅ Éxito!`);
        const data = response.data.data;
        
        // Analizar resultados
        Object.keys(data).forEach(key => {
          const value = data[key];
          if (Array.isArray(value)) {
            console.log(`      📊 ${key}: ${value.length} elementos`);
            
            // Mostrar muestra de los primeros elementos
            if (value.length > 0) {
              console.log(`         Muestra:`, JSON.stringify(value[0], null, 8));
            }
          } else if (value && typeof value === 'object') {
            if (value.edges) {
              console.log(`      📊 ${key}: ${value.edges.length} registros (total: ${value.totalCount || 'N/A'})`);
              if (value.edges.length > 0) {
                console.log(`         Primer registro:`, JSON.stringify(value.edges[0].node, null, 8));
              }
            } else {
              console.log(`      📊 ${key}:`, JSON.stringify(value, null, 8));
            }
          } else {
            console.log(`      📊 ${key}: ${value}`);
          }
        });
      }

    } catch (error) {
      console.log(`   ❌ Error de red: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
    
    console.log('');
  }
}

async function testRawDatabaseAccess(token) {
  console.log('🔬 Intentando acceso directo a tablas específicas...\n');

  // Lista de posibles nombres de tablas donde pueden estar los datos
  const possibleQueries = [
    {
      name: 'Query directa a temhum1',
      query: `{
        temhum1Data: __type(name: "TemHum1Data") {
          name
          fields {
            name
            type {
              name
            }
          }
        }
      }`
    },
    {
      name: 'Intentar consulta a tabla legacy temhum1',
      query: `{
        sensorData(table: "temhum1", limit: 5) {
          id
          timestamp
          data
        }
      }`
    }
  ];

  for (const testQuery of possibleQueries) {
    try {
      console.log(`🔬 ${testQuery.name}...`);
      
      const response = await axios.post(GRAPHQL_URL, {
        query: testQuery.query
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.errors) {
        console.log(`   ❌ Error: ${response.data.errors[0].message}`);
      } else {
        console.log(`   ✅ Éxito!`);
        console.log('   📊 Datos:', JSON.stringify(response.data.data, null, 2));
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log('');
  }
}

async function main() {
  console.log('🕵️ Exploración de datos reales en la base de datos\n');
  
  try {
    const token = await authenticate();
    console.log('✅ Autenticado correctamente\n');
    
    await exploreDatabase(token);
    await testRawDatabaseAccess(token);
    
    console.log('🎯 CONCLUSIONES:');
    console.log('1. Si los datos existen pero no aparecen, pueden estar en:');
    console.log('   - Tablas legacy (sensor_data_temhum1, sensor_data_temhum2, etc.)');
    console.log('   - Con IDs diferentes (hardware_id vs id numérico)');
    console.log('   - Con nombres de campos diferentes');
    console.log('');
    console.log('2. Siguiente paso: Verificar resolvers para incluir tablas legacy');
    console.log('3. O crear consultas específicas para tablas conocidas');
    
  } catch (error) {
    console.error('❌ Error crítico:', error.message);
  }
}

main();