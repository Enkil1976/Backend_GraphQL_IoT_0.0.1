#!/usr/bin/env node

/**
 * Deploy completo en Docker con todos los servicios en la misma red
 */

const { execSync } = require('child_process');
const axios = require('axios');

const GRAPHQL_URL = 'http://localhost:4001/graphql';
const HEALTH_URL = 'http://localhost:4001/health';
const CREDENTIALS = { username: 'admin', password: 'admin123' };

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
    if (error.stdout) log(`Stdout: ${error.stdout}`, 'info');
    if (error.stderr) log(`Stderr: ${error.stderr}`, 'error');
    throw error;
  }
}

async function waitForService(url, serviceName, maxRetries = 30) {
  log(`Esperando que ${serviceName} esté disponible...`, 'info');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(url, { timeout: 5000 });
      log(`✅ ${serviceName} está disponible (status: ${response.status})`, 'success');
      return true;
    } catch (error) {
      log(`⏳ Intento ${i + 1}/${maxRetries} - ${serviceName} no disponible aún`, 'info');
      await new Promise(resolve => setTimeout(resolve, 10000)); // Esperar 10 segundos
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

async function testHistorialSensores(token) {
  log('Probando consultas de historial de sensores...', 'info');

  const queries = [
    {
      name: 'Lista de sensores',
      query: `{
        sensors {
          id
          hardwareId
          name
          type
          isOnline
          location
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
              sensorType
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
      name: 'Datos del sensor BMP280 (ID: 2)',
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
      name: 'Datos del sensor Luxómetro (ID: 4)',
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
          data.sensors.forEach(sensor => {
            log(`   📡 ${sensor.name} (${sensor.hardwareId}) - ${sensor.type}`, 'info');
          });
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
  console.log('🚀 DEPLOY COMPLETO EN DOCKER - TODOS LOS SERVICIOS EN LA MISMA RED\n');
  
  try {
    // 1. Limpiar contenedores existentes
    log('Limpiando contenedores existentes...', 'info');
    try {
      execCommand('docker compose -f docker-compose.full.yml down -v', 'Detener contenedores anteriores');
      execCommand('docker compose -f docker-compose.simple.yml down -v', 'Detener contenedores simples');
      execCommand('docker compose -f docker-compose.local.yml down -v', 'Detener contenedores locales');
    } catch (error) {
      log('No hay contenedores que detener o error menor', 'warning');
    }

    // 2. Construir e iniciar servicios en orden
    log('Construyendo imágenes Docker...', 'info');
    execCommand('docker compose -f docker-compose.full.yml build --no-cache', 'Construir imágenes');

    log('Iniciando servicios de base de datos...', 'info');
    execCommand('docker compose -f docker-compose.full.yml up -d postgres redis', 'Iniciar PostgreSQL y Redis');

    // 3. Esperar que las bases de datos estén listas
    log('Esperando que PostgreSQL y Redis estén listos...', 'info');
    await new Promise(resolve => setTimeout(resolve, 30000)); // Esperar 30 segundos

    // 4. Inicializar base de datos
    log('Inicializando base de datos...', 'info');
    execCommand('docker compose -f docker-compose.full.yml up db-init', 'Inicializar base de datos');

    // 5. Iniciar aplicación principal
    log('Iniciando aplicación principal...', 'info');
    execCommand('docker compose -f docker-compose.full.yml up -d app', 'Iniciar aplicación GraphQL');

    // 6. Esperar que la aplicación esté lista
    await waitForService(HEALTH_URL, 'GraphQL API');

    // 7. Insertar datos de prueba
    log('Insertando datos de prueba...', 'info');
    execCommand('docker compose -f docker-compose.full.yml up data-seeder', 'Insertar datos de prueba');

    // 8. Autenticar y probar GraphQL
    const token = await authenticate();
    await testHistorialSensores(token);

    console.log('\n🎉 DEPLOY COMPLETO EXITOSO!\n');
    console.log('📊 Servicios disponibles:');
    console.log('   🔗 GraphQL API: http://localhost:4001/graphql');
    console.log('   🔗 GraphQL Playground: http://localhost:4001/graphql');
    console.log('   🔗 Health Check: http://localhost:4001/health');
    console.log('   💾 PostgreSQL: localhost:5432');
    console.log('   🔴 Redis: localhost:6379');
    console.log('');
    console.log('🧪 Para probar manualmente:');
    console.log('   curl http://localhost:4001/health');
    console.log('   docker compose -f docker-compose.full.yml logs app');
    console.log('');
    console.log('🛑 Para detener:');
    console.log('   docker compose -f docker-compose.full.yml down');

  } catch (error) {
    log(`❌ Error crítico en deploy: ${error.message}`, 'error');
    console.log('\n🔍 Para diagnosticar:');
    console.log('   docker compose -f docker-compose.full.yml logs');
    console.log('   docker compose -f docker-compose.full.yml ps');
    process.exit(1);
  }
}

main();