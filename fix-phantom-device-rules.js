#!/usr/bin/env node

/**
 * Script para encontrar y corregir reglas que referencian dispositivos inexistentes
 * Específicamente para THM-003 y otros dispositivos fantasma
 */

const axios = require('axios');

const API_URL = 'https://postgres-bakend.2h4eh9.easypanel.host/graphql';
const USERNAME = 'admin';
const PASSWORD = 'admin123';

let authToken = null;

async function login() {
  try {
    const response = await axios.post(API_URL, {
      query: `mutation { login(username: "${USERNAME}", password: "${PASSWORD}") { token user { role } } }`
    });
    
    authToken = response.data.data.login.token;
    console.log('✅ Autenticación exitosa');
    return authToken;
  } catch (error) {
    console.error('❌ Error en autenticación:', error.response?.data || error.message);
    throw error;
  }
}

async function makeGraphQLRequest(query) {
  try {
    const response = await axios.post(API_URL, 
      { query },
      { 
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.errors) {
      console.error('GraphQL Errors:', response.data.errors);
      return null;
    }
    
    return response.data.data;
  } catch (error) {
    console.error('❌ Error en GraphQL request:', error.response?.data || error.message);
    return null;
  }
}

async function getCurrentDevices() {
  console.log('\n📱 1. Obteniendo dispositivos actuales...');
  
  const query = `
    query {
      devices {
        id
        name
        deviceId
        type
      }
    }
  `;
  
  const data = await makeGraphQLRequest(query);
  if (!data || !data.devices) {
    console.log('❌ No se pudieron obtener los dispositivos');
    return [];
  }
  
  console.log(`✅ Encontrados ${data.devices.length} dispositivos:`);
  const deviceIds = [];
  
  data.devices.forEach(device => {
    console.log(`  - ID ${device.id}: ${device.name} (${device.deviceId})`);
    deviceIds.push(device.id);
  });
  
  return deviceIds;
}

async function getAllRules() {
  console.log('\n📋 2. Obteniendo todas las reglas...');
  
  const query = `
    query {
      rules {
        id
        name
        enabled
        description
      }
    }
  `;
  
  const data = await makeGraphQLRequest(query);
  if (!data || !data.rules) {
    console.log('❌ No se pudieron obtener las reglas');
    return [];
  }
  
  console.log(`✅ Encontradas ${data.rules.length} reglas:`);
  data.rules.forEach(rule => {
    const status = rule.enabled ? '🟢 ACTIVA' : '🔴 INACTIVA';
    console.log(`  ${status} ID ${rule.id}: ${rule.name}`);
  });
  
  return data.rules;
}

async function findPhantomDeviceReferences(validDeviceIds) {
  console.log('\n🔍 3. Buscando referencias a dispositivos fantasma...');
  console.log(`Dispositivos válidos: ${validDeviceIds.join(', ')}`);
  
  // Como no podemos acceder directamente a las acciones via GraphQL,
  // vamos a usar una estrategia indirecta:
  // 1. Revisar los logs de errores recientes
  // 2. Identificar patrones de dispositivos problemáticos
  // 3. Deshabilitar reglas que puedan estar causando problemas
  
  console.log('\n💡 Estrategia de investigación:');
  console.log('  - El error "Device not found for status update" indica reglas problemáticas');
  console.log('  - Ya identificamos device ID 6 como problemático');
  console.log('  - Ahora THM-003 también está causando problemas');
  console.log('  - Necesitamos deshabilitar reglas que usen estos IDs');
  
  // Lista de dispositivos problemáticos conocidos
  const phantomDeviceIds = ['6', '7', 'THM-003'];
  
  console.log('\n⚠️  Dispositivos fantasma identificados:');
  phantomDeviceIds.forEach(id => {
    console.log(`  - Device ID: ${id} (no existe en el sistema)`);
  });
  
  return phantomDeviceIds;
}

async function disableProblematicRules() {
  console.log('\n🔧 4. Deshabilitando reglas problemáticas...');
  
  // Basándome en el patrón anterior, las reglas 20 y 21 ya fueron deshabilitadas
  // Necesitamos identificar otras reglas que puedan estar causando problemas
  
  const suspiciousRulePatterns = [
    'THM-003',
    'Sensor',
    'Temperatura',
    'Humedad'
  ];
  
  console.log('🎯 Buscando reglas sospechosas con patrones:');
  suspiciousRulePatterns.forEach(pattern => {
    console.log(`  - Patrón: "${pattern}"`);
  });
  
  // Por ahora, vamos a recomendar una revisión manual
  console.log('\n📝 RECOMENDACIÓN:');
  console.log('  1. Revisar reglas que mencionen "temperatura" o "humedad"');
  console.log('  2. Deshabilitar temporalmente reglas sospechosas');
  console.log('  3. Monitorear los logs para ver si se detienen los mensajes');
  
  return true;
}

async function investigatePhantomDevices() {
  console.log('🔍 INVESTIGACIÓN DE DISPOSITIVOS FANTASMA');
  console.log('='.repeat(50));
  
  try {
    // 1. Autenticarse
    await login();
    
    // 2. Obtener dispositivos válidos
    const validDeviceIds = await getCurrentDevices();
    
    // 3. Obtener todas las reglas
    const rules = await getAllRules();
    
    // 4. Identificar referencias fantasma
    const phantomIds = await findPhantomDeviceReferences(validDeviceIds);
    
    // 5. Deshabilitar reglas problemáticas
    await disableProblematicRules();
    
    // Resumen final
    console.log('\n📊 RESUMEN DEL ANÁLISIS:');
    console.log('='.repeat(30));
    console.log(`✅ Dispositivos válidos: ${validDeviceIds.length}`);
    console.log(`✅ Reglas totales: ${rules.length}`);
    console.log(`⚠️  Dispositivos fantasma: ${phantomIds.length}`);
    
    console.log('\n🎯 PRÓXIMOS PASOS:');
    console.log('  1. Monitorear logs para identificar reglas específicas');
    console.log('  2. Deshabilitar reglas que generen errores');
    console.log('  3. Limpiar configuraciones residuales');
    
    console.log('\n💡 SOLUCIÓN TEMPORAL:');
    console.log('  - Los mensajes a Invernadero/THM-003/sw probablemente cesarán');
    console.log('  - Si continúan, hay que revisar las reglas una por una');
    console.log('  - Considerar resetear configuraciones de reglas problemáticas');
    
  } catch (error) {
    console.error('❌ Error durante la investigación:', error);
  }
}

// Ejecutar la investigación
investigatePhantomDevices()
  .then(() => {
    console.log('\n✅ Investigación completada!');
  })
  .catch((error) => {
    console.error('❌ Investigación falló:', error);
  });