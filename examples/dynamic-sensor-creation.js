/**
 * Ejemplos de creación dinámica de sensores
 * Este archivo muestra cómo crear sensores dinámicamente usando el sistema
 */

const sensorTypeService = require('../src/services/sensorTypeService');
const dynamicSensorService = require('../src/services/dynamicSensorService');

// Función para crear sensor BMP280 (temperatura y presión)
async function createBMP280Sensor() {
  console.log('🌡️ Creando sensor BMP280 (temperatura y presión)...');
  
  try {
    const sensorData = {
      sensorId: 'BMP280-1',
      name: 'Sensor BMP280 - Zona 1',
      type: 'TEMP_PRESSURE',
      description: 'Sensor barométrico BMP280 para temperatura y presión atmosférica',
      location: 'Invernadero - Zona 1',
      
      // Configuración MQTT - el tópico ya existe: Invernadero/BMP280-1/data
      mqttTopic: 'Invernadero/BMP280-1/data',
      hardwareId: 'BMP280-1',
      
      // Configuración opcional
      samplingInterval: 30, // 30 segundos
      retentionDays: 90,
      
      // Umbrales de alerta
      alertThresholds: {
        temperatura: { min: 5, max: 40 },
        presion: { min: 950, max: 1050 }
      }
    };

    const newSensor = await dynamicSensorService.createSensor(sensorData, 1); // userId = 1 (admin)
    console.log('✅ Sensor BMP280 creado exitosamente:', newSensor.sensor_id);
    return newSensor;
    
  } catch (error) {
    console.error('❌ Error creando sensor BMP280:', error.message);
    throw error;
  }
}

// Función para crear sensor de humedad del suelo
async function createSoilMoistureSensor() {
  console.log('🌱 Creando sensor de humedad del suelo...');
  
  try {
    const sensorData = {
      sensorId: 'SOIL-1',
      name: 'Sensor Humedad Suelo - Zona 1',
      type: 'SOIL_MOISTURE',
      description: 'Sensor de humedad del suelo con medición de nutrientes',
      location: 'Invernadero - Zona 1 - Bancal A',
      
      // Configuración MQTT
      mqttTopic: 'Invernadero/SOIL-1/data',
      hardwareId: 'SOIL-1',
      
      // Configuración
      samplingInterval: 60, // 1 minuto
      retentionDays: 180,
      
      // Umbrales de alerta
      alertThresholds: {
        humedad_suelo: { min: 20, max: 80 },
        temperatura_suelo: { min: 10, max: 35 },
        conductividad: { min: 100, max: 1500 }
      }
    };

    const newSensor = await dynamicSensorService.createSensor(sensorData, 1);
    console.log('✅ Sensor de humedad del suelo creado exitosamente:', newSensor.sensor_id);
    return newSensor;
    
  } catch (error) {
    console.error('❌ Error creando sensor de humedad del suelo:', error.message);
    throw error;
  }
}

// Función para crear sensor de CO2
async function createCO2Sensor() {
  console.log('🫁 Creando sensor de CO2...');
  
  try {
    const sensorData = {
      sensorId: 'CO2-1',
      name: 'Sensor CO2 - Zona Central',
      type: 'CO2',
      description: 'Sensor de CO2 y calidad del aire',
      location: 'Invernadero - Zona Central',
      
      // Configuración MQTT
      mqttTopic: 'Invernadero/CO2-1/data',
      hardwareId: 'CO2-1',
      
      // Configuración
      samplingInterval: 45, // 45 segundos
      retentionDays: 90,
      
      // Umbrales de alerta
      alertThresholds: {
        co2: { min: 300, max: 1200 },
        tvoc: { min: 0, max: 300 }
      }
    };

    const newSensor = await dynamicSensorService.createSensor(sensorData, 1);
    console.log('✅ Sensor de CO2 creado exitosamente:', newSensor.sensor_id);
    return newSensor;
    
  } catch (error) {
    console.error('❌ Error creando sensor de CO2:', error.message);
    throw error;
  }
}

// Función para crear sensor de movimiento
async function createMotionSensor() {
  console.log('🚶 Creando sensor de movimiento...');
  
  try {
    const sensorData = {
      sensorId: 'MOTION-1',
      name: 'Sensor Movimiento - Entrada',
      type: 'MOTION',
      description: 'Sensor de movimiento para detección de presencia',
      location: 'Invernadero - Entrada Principal',
      
      // Configuración MQTT
      mqttTopic: 'Invernadero/MOTION-1/data',
      hardwareId: 'MOTION-1',
      
      // Configuración
      samplingInterval: 1, // 1 segundo (detección rápida)
      retentionDays: 30,
      
      // Umbrales de alerta
      alertThresholds: {
        motion_detected: { trigger: true },
        confidence: { min: 70 }
      }
    };

    const newSensor = await dynamicSensorService.createSensor(sensorData, 1);
    console.log('✅ Sensor de movimiento creado exitosamente:', newSensor.sensor_id);
    return newSensor;
    
  } catch (error) {
    console.error('❌ Error creando sensor de movimiento:', error.message);
    throw error;
  }
}

// Función para crear sensor personalizado
async function createCustomSensor() {
  console.log('🔧 Creando sensor personalizado...');
  
  try {
    const sensorData = {
      sensorId: 'CUSTOM-1',
      name: 'Sensor Personalizado - Prueba',
      type: 'CUSTOM',
      description: 'Sensor personalizado para pruebas',
      location: 'Invernadero - Zona de Pruebas',
      
      // Configuración MQTT
      mqttTopic: 'Invernadero/CUSTOM-1/data',
      hardwareId: 'CUSTOM-1',
      
      // Campos personalizados
      customFields: {
        value: 'Valor principal del sensor',
        unit: 'Unidad de medida'
      },
      
      // Configuración
      samplingInterval: 120, // 2 minutos
      retentionDays: 60,
      
      // Umbrales de alerta
      alertThresholds: {
        value: { min: 0, max: 100 }
      }
    };

    const newSensor = await dynamicSensorService.createSensor(sensorData, 1);
    console.log('✅ Sensor personalizado creado exitosamente:', newSensor.sensor_id);
    return newSensor;
    
  } catch (error) {
    console.error('❌ Error creando sensor personalizado:', error.message);
    throw error;
  }
}

// Función para generar payloads de ejemplo
function generateSamplePayloads() {
  console.log('📄 Generando payloads de ejemplo...');
  
  const sensorTypes = ['TEMP_PRESSURE', 'SOIL_MOISTURE', 'CO2', 'MOTION', 'CUSTOM'];
  
  sensorTypes.forEach(type => {
    try {
      const samplePayload = sensorTypeService.generateSamplePayload(type);
      console.log(`\n${type} - Payload de ejemplo:`);
      console.log(JSON.stringify(samplePayload, null, 2));
    } catch (error) {
      console.error(`❌ Error generando payload para ${type}:`, error.message);
    }
  });
}

// Función para validar payload real del BMP280
function validateBMP280Payload() {
  console.log('🔍 Validando payload real del BMP280...');
  
  const realPayload = {
    "temperatura": 12.36,
    "presion": 99167.67
  };
  
  try {
    const validation = sensorTypeService.validatePayload('TEMP_PRESSURE', realPayload);
    console.log('Resultado de validación:', validation);
    
    if (validation.valid) {
      console.log('✅ Payload válido para BMP280');
    } else {
      console.log('❌ Payload inválido:', validation.errors);
    }
    
  } catch (error) {
    console.error('❌ Error validando payload:', error.message);
  }
}

// Función para mostrar información de tipos de sensores
function showSensorTypes() {
  console.log('📋 Tipos de sensores disponibles:');
  
  const sensorTypes = sensorTypeService.getAllSensorTypes();
  
  sensorTypes.forEach(type => {
    console.log(`\n🔹 ${type.id}: ${type.name}`);
    console.log(`   Descripción: ${type.description}`);
    console.log(`   Tópico MQTT: ${type.mqttTopicTemplate}`);
    console.log(`   Tabla BD: ${type.tableName}`);
    console.log(`   Campos métricas: ${type.metricsFields.join(', ')}`);
    console.log(`   Personalizable: ${type.customizable ? 'Sí' : 'No'}`);
  });
}

// Función principal para ejecutar ejemplos
async function runExamples() {
  console.log('🚀 Ejecutando ejemplos de creación dinámica de sensores...\n');
  
  try {
    // Mostrar tipos de sensores disponibles
    showSensorTypes();
    
    // Generar payloads de ejemplo
    generateSamplePayloads();
    
    // Validar payload real del BMP280
    validateBMP280Payload();
    
    // Crear sensor BMP280 (para el sensor real que tienes)
    await createBMP280Sensor();
    
    // Crear otros sensores de ejemplo
    await createSoilMoistureSensor();
    await createCO2Sensor();
    await createMotionSensor();
    await createCustomSensor();
    
    console.log('\n✅ Todos los ejemplos ejecutados exitosamente');
    
  } catch (error) {
    console.error('\n❌ Error ejecutando ejemplos:', error.message);
  }
}

// Función para simular datos del BMP280
function simulateBMP280Data() {
  console.log('🌡️ Simulando datos del BMP280...');
  
  const mqttTopic = 'Invernadero/BMP280-1/data';
  const samplePayloads = [
    { temperatura: 12.36, presion: 99167.67 },
    { temperatura: 13.45, presion: 99156.23 },
    { temperatura: 11.89, presion: 99178.90 },
    { temperatura: 14.12, presion: 99145.67 },
    { temperatura: 12.78, presion: 99162.34 }
  ];
  
  samplePayloads.forEach((payload, index) => {
    setTimeout(() => {
      console.log(`📡 Enviando payload ${index + 1}:`, JSON.stringify(payload));
      // Aquí simularías el envío MQTT
      // En producción, esto sería manejado por dynamicSensorService.processSensorData()
    }, index * 2000); // Enviar cada 2 segundos
  });
}

// Exportar funciones para uso en otros módulos
module.exports = {
  createBMP280Sensor,
  createSoilMoistureSensor,
  createCO2Sensor,
  createMotionSensor,
  createCustomSensor,
  generateSamplePayloads,
  validateBMP280Payload,
  showSensorTypes,
  simulateBMP280Data,
  runExamples
};

// Ejecutar ejemplos si se ejecuta directamente
if (require.main === module) {
  runExamples();
}