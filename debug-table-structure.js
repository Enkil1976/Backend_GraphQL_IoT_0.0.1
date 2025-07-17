#!/usr/bin/env node

/**
 * Script simple para entender la estructura real de la tabla
 */

const axios = require('axios');
require('dotenv').config();

const GRAPHQL_URL = process.env.GRAPHQL_ENDPOINT || 'https://postgres-bakend.2h4eh9.easypanel.host/graphql';

const CREDENTIALS = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123'
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

async function debugTableStructure(token) {
  console.log('🔍 Debug de estructura de tabla y datos...\n');

  // Test con una query muy simple para entender la estructura
  const simpleQuery = `{
    allSensorHistory(limit: 1) {
      edges {
        node {
          id
          sensorId
          timestamp
        }
      }
      totalCount
    }
  }`;

  try {
    console.log('📊 Query simple para ver si funciona básicamente...');
    
    const response = await axios.post(GRAPHQL_URL, {
      query: simpleQuery
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.errors) {
      console.log(`❌ Error en query simple: ${response.data.errors[0].message}`);
      
      // Ver si hay más detalles del error
      if (response.data.errors[0].extensions) {
        console.log(`🔍 Extensiones del error:`, JSON.stringify(response.data.errors[0].extensions, null, 2));
      }
      
    } else {
      const data = response.data.data.allSensorHistory;
      console.log(`✅ Query simple funcionó! Total: ${data.totalCount} registros`);
      
      if (data.edges.length > 0) {
        console.log(`📄 Primer registro:`, JSON.stringify(data.edges[0].node, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Error de red:', error.message);
    if (error.response?.data) {
      console.log(`📄 Response completa:`, JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function main() {
  console.log('🔧 Debug básico de estructura\n');
  
  try {
    const token = await authenticate();
    console.log('✅ Autenticado correctamente\n');
    
    await debugTableStructure(token);
    
    console.log('\n🎯 NOTA:');
    console.log('Este test ayuda a entender si hay un problema básico con las queries');
    console.log('o si el problema está en la estructura específica de datos');
    
  } catch (error) {
    console.error('❌ Error crítico:', error.message);
  }
}

main();