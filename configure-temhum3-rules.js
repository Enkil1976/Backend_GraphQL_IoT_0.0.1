#!/usr/bin/env node

/**
 * Script para verificar si el cambio a temhum3 solucionó el problema THM-003/sw
 * y documentar la configuración actual
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

async function checkTemhum3Configuration() {
  console.log('🔍 VERIFICACIÓN DE CONFIGURACIÓN TEMHUM3');
  console.log('='.repeat(50));
  
  try {
    await login();
    
    // 1. Verificar sensor temhum3
    console.log('\n📊 1. Verificando sensor temhum3...');
    const sensorsQuery = `
      query {
        sensors {
          id
          name
          hardwareId
          type
          isOnline
        }
      }
    `;
    
    const sensorsData = await makeGraphQLRequest(sensorsQuery);
    if (sensorsData && sensorsData.sensors) {
      const temhum3Sensor = sensorsData.sensors.find(s => 
        s.hardwareId === 'temhum3' || s.name.toLowerCase().includes('temhum3')
      );
      
      if (temhum3Sensor) {
        console.log('✅ Sensor temhum3 encontrado:');
        console.log(`   - ID: ${temhum3Sensor.id}`);
        console.log(`   - Nombre: ${temhum3Sensor.name}`);
        console.log(`   - Hardware ID: ${temhum3Sensor.hardwareId}`);
        console.log(`   - Tipo: ${temhum3Sensor.type}`);
        console.log(`   - Estado: ${temhum3Sensor.isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
      } else {
        console.log('❌ Sensor temhum3 no encontrado');
      }
    }
    
    // 2. Verificar reglas de calefactor y ventilador
    console.log('\n📋 2. Verificando reglas actualizadas...');
    const rulesQuery = `
      query {
        rules {
          id
          name
          enabled
          description
        }
      }
    `;
    
    const rulesData = await makeGraphQLRequest(rulesQuery);
    if (rulesData && rulesData.rules) {
      const targetRules = rulesData.rules.filter(r => 
        ['6', '9', '10'].includes(r.id)
      );
      
      console.log('✅ Reglas de calefactor y ventilador:');
      targetRules.forEach(rule => {
        const status = rule.enabled ? '🟢 ACTIVA' : '🔴 INACTIVA';
        console.log(`   ${status} ID ${rule.id}: ${rule.name}`);
        console.log(`      📝 ${rule.description}`);
      });
    }
    
    // 3. Verificar datos recientes del sensor
    console.log('\n📈 3. Verificando datos recientes de temhum3...');
    const latestDataQuery = `
      query {
        latestSensorData {
          id
          timestamp
          temperatura
          humedad
        }
      }
    `;
    
    const latestData = await makeGraphQLRequest(latestDataQuery);
    if (latestData && latestData.latestSensorData) {
      const temhum3Data = latestData.latestSensorData.find(d => 
        d.id.toLowerCase().includes('temhum3')
      );
      
      if (temhum3Data) {
        console.log('✅ Datos recientes de temhum3:');
        console.log(`   - Temperatura: ${temhum3Data.temperatura}°C`);
        console.log(`   - Humedad: ${temhum3Data.humedad}%`);
        console.log(`   - Timestamp: ${temhum3Data.timestamp}`);
        
        // Evaluar si las reglas deberían activarse
        const temp = parseFloat(temhum3Data.temperatura);
        console.log('\n🎯 Evaluación de reglas:');
        if (temp < 10) {
          console.log('   🔥 Calefactor debería estar ON (temp < 10°C)');
        }
        if (temp > 23) {
          console.log('   🌪️ Ventilador debería estar ON (temp > 23°C)');
        } else if (temp < 21) {
          console.log('   🌪️ Ventilador debería estar OFF (temp < 21°C)');
        }
      } else {
        console.log('❌ No se encontraron datos recientes de temhum3');
      }
    }
    
    console.log('\n💡 ANÁLISIS DEL CAMBIO:');
    console.log('='.repeat(30));
    console.log('✅ Cambios realizados:');
    console.log('   - Reglas de calefactor y ventilador actualizadas');
    console.log('   - Descripciones ahora mencionan temhum3');
    console.log('   - Sistema debería usar temhum3 como fuente de datos');
    console.log('');
    console.log('🔍 Monitoreo requerido:');
    console.log('   - Verificar si los mensajes THM-003/sw se detuvieron');
    console.log('   - Confirmar que las reglas usan temhum3 para evaluaciones');
    console.log('   - Observar logs del motor de reglas');
    console.log('');
    console.log('🎯 Resultado esperado:');
    console.log('   - Las reglas ahora deberían consultar temhum3 existente');
    console.log('   - No más intentos de controlar dispositivo THM-003 fantasma');
    console.log('   - Sistema funcionando con sensor real temhum3');
    
  } catch (error) {
    console.error('❌ Error durante verificación:', error);
  }
}

// Ejecutar verificación
checkTemhum3Configuration()
  .then(() => {
    console.log('\n✅ Verificación completada!');
  })
  .catch((error) => {
    console.error('❌ Verificación falló:', error);
  });