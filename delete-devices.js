#!/usr/bin/env node

/**
 * Script para eliminar dispositivos vía GraphQL
 * Permite eliminar dispositivos específicos o todos los auto-creados
 */

const https = require('https');
const readline = require('readline');

const SERVER_URL = 'https://biodomepro.2h4eh9.easypanel.host/graphql';
const USERNAME = 'admin';
const PASSWORD = 'admin123';

let authToken = null;

// Función para hacer peticiones GraphQL
async function graphqlRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    
    const options = {
      hostname: 'biodomepro.2h4eh9.easypanel.host',
      port: 443,
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Función para autenticarse
async function login() {
  const query = `
    mutation {
      login(username: "${USERNAME}", password: "${PASSWORD}") {
        token
        user { id username role }
      }
    }
  `;
  
  const result = await graphqlRequest(query);
  
  if (result.errors) {
    throw new Error('Login failed: ' + result.errors[0].message);
  }
  
  authToken = result.data.login.token;
  console.log('✅ Autenticado como:', result.data.login.user.username);
}

// Función para obtener todos los dispositivos
async function getDevices() {
  const query = `
    query {
      devices {
        id
        name
        deviceId
        type
        status
      }
    }
  `;
  
  const result = await graphqlRequest(query);
  
  if (result.errors) {
    throw new Error('Error getting devices: ' + result.errors[0].message);
  }
  
  return result.data.devices;
}

// Función para eliminar un dispositivo
async function deleteDevice(deviceId) {
  const query = `
    mutation {
      deleteDevice(id: "${deviceId}")
    }
  `;
  
  const result = await graphqlRequest(query);
  
  if (result.errors) {
    throw new Error('Error deleting device: ' + result.errors[0].message);
  }
  
  return result.data.deleteDevice;
}

// Función para eliminar dispositivos en lotes
async function deleteDevicesInBatch(deviceIds) {
  console.log(`\n🗑️  Eliminando ${deviceIds.length} dispositivos...`);
  
  let deleted = 0;
  let failed = 0;
  
  for (const deviceId of deviceIds) {
    try {
      const success = await deleteDevice(deviceId);
      if (success) {
        deleted++;
        console.log(`✅ Eliminado dispositivo ID: ${deviceId}`);
      } else {
        failed++;
        console.log(`❌ Error eliminando dispositivo ID: ${deviceId}`);
      }
    } catch (error) {
      failed++;
      console.log(`❌ Error eliminando dispositivo ID: ${deviceId} - ${error.message}`);
    }
    
    // Pequeña pausa para no sobrecargar el servidor
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n📊 Resumen:`);
  console.log(`   - Eliminados: ${deleted}`);
  console.log(`   - Fallidos: ${failed}`);
  console.log(`   - Total: ${deviceIds.length}`);
}

// Función para mostrar menú interactivo
function showMenu(devices) {
  console.log('\n📋 OPCIONES DE ELIMINACIÓN:');
  console.log('1. Eliminar todos los dispositivos');
  console.log('2. Eliminar dispositivos mal clasificados como WATER_PUMP');
  console.log('3. Eliminar dispositivos con sufijo -status');
  console.log('4. Eliminar dispositivos por tipo específico');
  console.log('5. Eliminar dispositivos por ID específico');
  console.log('6. Mostrar lista de dispositivos');
  console.log('0. Salir');
  console.log('');
}

// Función principal
async function main() {
  try {
    console.log('🔐 Iniciando sesión...');
    await login();
    
    console.log('📋 Obteniendo lista de dispositivos...');
    const devices = await getDevices();
    
    console.log(`✅ Encontrados ${devices.length} dispositivos`);
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const askQuestion = (question) => {
      return new Promise((resolve) => {
        rl.question(question, resolve);
      });
    };
    
    while (true) {
      showMenu(devices);
      const choice = await askQuestion('Selecciona una opción (0-6): ');
      
      switch (choice) {
        case '1':
          // Eliminar todos los dispositivos
          const confirm = await askQuestion('⚠️  ¿Estás seguro de eliminar TODOS los dispositivos? (y/N): ');
          if (confirm.toLowerCase() === 'y') {
            await deleteDevicesInBatch(devices.map(d => d.id));
          }
          break;
          
        case '2':
          // Eliminar dispositivos mal clasificados como WATER_PUMP
          const badPumps = devices.filter(d => 
            d.type === 'WATER_PUMP' && 
            !d.deviceId.includes('bomba') && 
            !d.deviceId.includes('pump')
          );
          console.log(`Encontrados ${badPumps.length} dispositivos mal clasificados como WATER_PUMP:`);
          badPumps.forEach(d => console.log(`   - ${d.name} (${d.deviceId})`));
          
          if (badPumps.length > 0) {
            const confirm2 = await askQuestion('¿Eliminar estos dispositivos? (y/N): ');
            if (confirm2.toLowerCase() === 'y') {
              await deleteDevicesInBatch(badPumps.map(d => d.id));
            }
          }
          break;
          
        case '3':
          // Eliminar dispositivos con sufijo -status
          const statusDevices = devices.filter(d => d.deviceId.endsWith('-status'));
          console.log(`Encontrados ${statusDevices.length} dispositivos con sufijo -status:`);
          statusDevices.forEach(d => console.log(`   - ${d.name} (${d.deviceId})`));
          
          if (statusDevices.length > 0) {
            const confirm3 = await askQuestion('¿Eliminar estos dispositivos? (y/N): ');
            if (confirm3.toLowerCase() === 'y') {
              await deleteDevicesInBatch(statusDevices.map(d => d.id));
            }
          }
          break;
          
        case '4':
          // Eliminar por tipo específico
          const types = [...new Set(devices.map(d => d.type))];
          console.log('Tipos disponibles:', types.join(', '));
          const selectedType = await askQuestion('Ingresa el tipo a eliminar: ');
          const typeDevices = devices.filter(d => d.type === selectedType);
          
          if (typeDevices.length > 0) {
            console.log(`Encontrados ${typeDevices.length} dispositivos tipo ${selectedType}:`);
            typeDevices.forEach(d => console.log(`   - ${d.name} (${d.deviceId})`));
            
            const confirm4 = await askQuestion('¿Eliminar estos dispositivos? (y/N): ');
            if (confirm4.toLowerCase() === 'y') {
              await deleteDevicesInBatch(typeDevices.map(d => d.id));
            }
          } else {
            console.log('No se encontraron dispositivos de ese tipo');
          }
          break;
          
        case '5':
          // Eliminar por ID específico
          const deviceId = await askQuestion('Ingresa el ID del dispositivo a eliminar: ');
          const device = devices.find(d => d.id === deviceId);
          
          if (device) {
            console.log(`Dispositivo encontrado: ${device.name} (${device.deviceId})`);
            const confirm5 = await askQuestion('¿Eliminar este dispositivo? (y/N): ');
            if (confirm5.toLowerCase() === 'y') {
              await deleteDevicesInBatch([deviceId]);
            }
          } else {
            console.log('Dispositivo no encontrado');
          }
          break;
          
        case '6':
          // Mostrar lista de dispositivos
          console.log('\n📋 LISTA DE DISPOSITIVOS:');
          devices.forEach(d => {
            console.log(`   ID: ${d.id.padStart(2)} | ${d.type.padEnd(15)} | ${d.name}`);
          });
          break;
          
        case '0':
          console.log('👋 Saliendo...');
          rl.close();
          return;
          
        default:
          console.log('❌ Opción no válida');
          break;
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar el script
if (require.main === module) {
  main();
}

module.exports = { deleteDevice, deleteDevicesInBatch };