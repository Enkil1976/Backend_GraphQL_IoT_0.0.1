#!/usr/bin/env node

/**
 * Script para listar dispositivos y sensores creados en el sistema
 * Incluye autenticación y consultas GraphQL
 */

const axios = require('axios');

const GRAPHQL_URL = 'https://postgres-bakend.2h4eh9.easypanel.host/graphql';

// Credenciales por defecto (ajustar según sea necesario)
const CREDENTIALS = {
  username: 'admin',
  password: 'admin123' // Ajustar según la configuración
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

async function listDevices(token) {
  console.log('\n📱 Consultando dispositivos...');
  
  const devicesQuery = `
    query GetDevices {
      devices {
        id
        name
        type
        status
        description
      }
    }
  `;

  try {
    const response = await axios.post(GRAPHQL_URL, {
      query: devicesQuery
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.data.errors) {
      console.error('❌ Error consultando dispositivos:', response.data.errors);
      return [];
    }

    return response.data.data.devices || [];

  } catch (error) {
    console.error('❌ Error en consulta de dispositivos:', error.response?.data || error.message);
    return [];
  }
}

async function listSensors(token) {
  console.log('\n🌡️ Consultando sensores...');
  
  const sensorsQuery = `
    query GetSensors {
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
      query: sensorsQuery
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

    return response.data.data.sensors || [];

  } catch (error) {
    console.error('❌ Error en consulta de sensores:', error.response?.data || error.message);
    return [];
  }
}

async function main() {
  console.log('🚀 Iniciando consulta de dispositivos y sensores...\n');

  // Autenticar
  const token = await authenticateUser();
  if (!token) {
    console.log('❌ No se pudo autenticar. Saliendo...');
    process.exit(1);
  }

  // Consultar dispositivos
  const devices = await listDevices(token);
  
  console.log(`\n📊 DISPOSITIVOS ENCONTRADOS: ${devices.length}`);
  console.log('═'.repeat(80));
  
  if (devices.length === 0) {
    console.log('   (No hay dispositivos registrados)');
  } else {
    devices.forEach((device, index) => {
      console.log(`\n${index + 1}. ${device.name || 'Sin nombre'}`);
      console.log(`   ID: ${device.id}`);
      console.log(`   Tipo: ${device.type}`);
      console.log(`   Estado: ${device.status}`);
      console.log(`   Descripción: ${device.description || 'N/A'}`);
    });
  }

  // Consultar sensores
  const sensors = await listSensors(token);
  
  console.log(`\n\n📊 SENSORES ENCONTRADOS: ${sensors.length}`);
  console.log('═'.repeat(80));
  
  if (sensors.length === 0) {
    console.log('   (No hay sensores registrados)');
  } else {
    sensors.forEach((sensor, index) => {
      console.log(`\n${index + 1}. ${sensor.name || 'Sin nombre'}`);
      console.log(`   ID: ${sensor.id}`);
      console.log(`   Tipo: ${sensor.type}`);
      console.log(`   Ubicación: ${sensor.location || 'N/A'}`);
      console.log(`   En línea: ${sensor.isOnline ? 'Sí' : 'No'}`);
      console.log(`   Descripción: ${sensor.description || 'N/A'}`);
    });
  }

  console.log('\n✅ Consulta completada');
  
  // Resumen
  console.log('\n📋 RESUMEN:');
  console.log(`   🔌 Dispositivos: ${devices.length}`);
  console.log(`   🌡️ Sensores: ${sensors.length}`);
  console.log(`   📡 Total entidades: ${devices.length + sensors.length}`);
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error crítico:', error);
    process.exit(1);
  });
}

module.exports = { main };