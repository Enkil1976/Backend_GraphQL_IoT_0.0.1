#!/usr/bin/env node

/**
 * Script para ejecutar la corrección de tipos de dispositivos directamente
 * Este script aplica las correcciones manualmente en producción
 */

const axios = require('axios');
require('dotenv').config();

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'https://biodome.2h4eh9.easypanel.host/graphql';

// Credenciales de administrador usando variables de entorno
const ADMIN_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123'
};

// Mapeo de correcciones necesarias
const DEVICE_TYPE_CORRECTIONS = {
  'invernadero-ventilador': 'VENTILATOR',
  'invernadero-calefactor': 'HEATER',
  'invernadero-calefactoragua': 'HEATER'
  // invernadero-bomba ya es WATER_PUMP correctamente
};

async function authenticateAdmin() {
  console.log('🔐 Autenticando como administrador...');
  
  try {
    const response = await axios.post(GRAPHQL_ENDPOINT, {
      query: `
        mutation Login($username: String!, $password: String!) {
          login(username: $username, password: $password) {
            token
            user {
              id
              username
              role
            }
          }
        }
      `,
      variables: ADMIN_CREDENTIALS
    });
    
    if (response.data.errors) {
      console.error('❌ Error de autenticación:', response.data.errors);
      return null;
    }
    
    const { token, user } = response.data.data.login;
    console.log(`✅ Autenticado como: ${user.username} (${user.role})`);
    return token;
    
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    return null;
  }
}

async function getDevicesNeedingCorrection(token) {
  console.log('\n📋 Obteniendo dispositivos que necesitan corrección...');
  
  try {
    const response = await axios.post(GRAPHQL_ENDPOINT, {
      query: `
        query GetDevices {
          devices {
            id
            deviceId
            name
            type
            status
            description
          }
        }
      `
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.errors) {
      console.error('❌ Error obteniendo dispositivos:', response.data.errors);
      return null;
    }
    
    const devices = response.data.data.devices;
    const devicesNeedingCorrection = devices.filter(device => 
      DEVICE_TYPE_CORRECTIONS[device.deviceId] && 
      device.type !== DEVICE_TYPE_CORRECTIONS[device.deviceId]
    );
    
    console.log(`📊 Dispositivos encontrados: ${devices.length}`);
    console.log(`🔧 Dispositivos que necesitan corrección: ${devicesNeedingCorrection.length}`);
    
    return devicesNeedingCorrection;
    
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    return null;
  }
}

async function updateDeviceType(token, deviceId, newType) {
  console.log(`🔄 Actualizando ${deviceId} a tipo ${newType}...`);
  
  try {
    const response = await axios.post(GRAPHQL_ENDPOINT, {
      query: `
        mutation UpdateDevice($id: ID!, $input: UpdateDeviceInput!) {
          updateDevice(id: $id, input: $input) {
            id
            deviceId
            name
            type
            status
          }
        }
      `,
      variables: {
        id: deviceId,
        input: {
          type: newType
        }
      }
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.errors) {
      console.error(`❌ Error actualizando dispositivo ${deviceId}:`, response.data.errors);
      return false;
    }
    
    const updatedDevice = response.data.data.updateDevice;
    console.log(`✅ ${updatedDevice.deviceId} actualizado a ${updatedDevice.type}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error de conexión actualizando ${deviceId}:`, error.message);
    return false;
  }
}

async function applyDeviceTypeCorrections(token, devices) {
  console.log('\n🔧 Aplicando correcciones de tipos de dispositivos...');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const device of devices) {
    const correctType = DEVICE_TYPE_CORRECTIONS[device.deviceId];
    
    console.log(`\n📋 Dispositivo: ${device.deviceId} (${device.name})`);
    console.log(`   Tipo actual: ${device.type}`);
    console.log(`   Tipo correcto: ${correctType}`);
    
    const success = await updateDeviceType(token, device.id, correctType);
    
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
    
    // Pausa pequeña entre actualizaciones
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n📊 RESUMEN DE CORRECCIONES:');
  console.log(`   ✅ Éxitos: ${successCount}`);
  console.log(`   ❌ Errores: ${errorCount}`);
  console.log(`   📋 Total: ${devices.length}`);
  
  return successCount === devices.length;
}

async function verifyCorrections(token) {
  console.log('\n🔍 Verificando correcciones aplicadas...');
  
  try {
    const response = await axios.post(GRAPHQL_ENDPOINT, {
      query: `
        query GetDevices {
          devices {
            id
            deviceId
            name
            type
            status
          }
        }
      `
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.errors) {
      console.error('❌ Error verificando dispositivos:', response.data.errors);
      return false;
    }
    
    const devices = response.data.data.devices;
    let verificationsOk = 0;
    let verificationsFailed = 0;
    
    console.log('\n✅ VERIFICACIÓN FINAL:');
    
    devices.forEach(device => {
      const expectedType = DEVICE_TYPE_CORRECTIONS[device.deviceId];
      if (expectedType) {
        const isCorrect = device.type === expectedType;
        const status = isCorrect ? '✅' : '❌';
        console.log(`   ${status} ${device.deviceId}: ${device.type} (esperado: ${expectedType})`);
        
        if (isCorrect) {
          verificationsOk++;
        } else {
          verificationsFailed++;
        }
      }
    });
    
    console.log(`\n📈 Verificaciones exitosas: ${verificationsOk}`);
    console.log(`📉 Verificaciones fallidas: ${verificationsFailed}`);
    
    return verificationsFailed === 0;
    
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Ejecutando corrección de tipos de dispositivos en producción...\n');
  
  try {
    // Paso 1: Autenticarse
    const token = await authenticateAdmin();
    if (!token) {
      console.log('❌ No se pudo autenticar.');
      process.exit(1);
    }
    
    // Paso 2: Obtener dispositivos que necesitan corrección
    const devicesNeedingCorrection = await getDevicesNeedingCorrection(token);
    if (!devicesNeedingCorrection) {
      console.log('❌ No se pudieron obtener los dispositivos.');
      process.exit(1);
    }
    
    if (devicesNeedingCorrection.length === 0) {
      console.log('✅ No hay dispositivos que necesiten corrección. ¡Todo está bien!');
      process.exit(0);
    }
    
    // Paso 3: Aplicar correcciones
    const correctionsSuccessful = await applyDeviceTypeCorrections(token, devicesNeedingCorrection);
    
    if (!correctionsSuccessful) {
      console.log('❌ Algunas correcciones fallaron.');
      process.exit(1);
    }
    
    // Paso 4: Verificar correcciones
    const verificationSuccessful = await verifyCorrections(token);
    
    if (verificationSuccessful) {
      console.log('\n🎉 ¡Todas las correcciones de tipos de dispositivos se aplicaron exitosamente!');
      process.exit(0);
    } else {
      console.log('\n❌ Algunas correcciones no se aplicaron correctamente.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { main };