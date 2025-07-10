const { query } = require('../config/database');
const { cache } = require('../config/redis');
const { pubsub, SENSOR_EVENTS } = require('../utils/pubsub');

/**
 * Servicio para manejo de tipos de sensores y plantillas de payload
 * Permite crear sensores dinámicamente con tópicos y payloads configurables
 */
class SensorTypeService {
  constructor() {
    this.sensorTypes = new Map();
    this.payloadTemplates = new Map();
    this.initializeSensorTypes();
  }

  /**
   * Inicializa los tipos de sensores predefinidos
   */
  initializeSensorTypes() {
    // Tipos de sensores existentes
    this.registerSensorType('TEMHUM', {
      name: 'Temperatura y Humedad',
      description: 'Sensor de temperatura y humedad ambiental',
      mqttTopicTemplate: 'Invernadero/{sensorId}/data',
      tableName: 'sensor_data_generic',
      payloadTemplate: {
        temperatura: { type: 'float', required: true, min: -50, max: 80 },
        humedad: { type: 'float', required: true, min: 0, max: 100 },
        heatindex: { type: 'float', required: false },
        dewpoint: { type: 'float', required: false },
        rssi: { type: 'integer', required: false },
        boot: { type: 'integer', required: false, default: 0 },
        mem: { type: 'integer', required: false },
        stats: {
          type: 'object',
          required: false,
          properties: {
            tmin: { type: 'float' },
            tmax: { type: 'float' },
            tavg: { type: 'float' },
            hmin: { type: 'float' },
            hmax: { type: 'float' },
            havg: { type: 'float' },
            total: { type: 'integer' },
            errors: { type: 'integer' }
          }
        }
      },
      cacheKeyTemplate: 'sensor_latest:{sensorId}',
      metricsFields: ['temperatura', 'humedad', 'heatindex', 'dewpoint']
    });

    this.registerSensorType('TEMP_PRESSURE', {
      name: 'Temperatura y Presión',
      description: 'Sensor de temperatura y presión atmosférica (BMP280)',
      mqttTopicTemplate: 'Invernadero/{sensorId}/data',
      tableName: 'temp_pressure_data',
      payloadTemplate: {
        temperatura: { type: 'float', required: true, min: -50, max: 80 },
        presion: { type: 'float', required: true, min: 30000, max: 110000 },
        altitude: { type: 'float', required: false },
        rssi: { type: 'integer', required: false },
        boot: { type: 'integer', required: false, default: 0 },
        mem: { type: 'integer', required: false }
      },
      cacheKeyTemplate: 'sensor_latest:{sensorId}',
      metricsFields: ['temperatura', 'presion', 'altitude']
    });

    this.registerSensorType('WATER_QUALITY', {
      name: 'Calidad del Agua',
      description: 'Sensor de calidad del agua (pH, EC, PPM)',
      mqttTopicTemplate: 'Invernadero/{sensorId}/data',
      tableName: 'sensor_data_generic',
      payloadTemplate: {
        ph: { type: 'float', required: true, min: 0, max: 14 },
        ec: { type: 'float', required: true, min: 0, max: 10000 },
        ppm: { type: 'float', required: true, min: 0, max: 5000 },
        temperatura_agua: { type: 'float', required: false, min: 0, max: 50 },
        rssi: { type: 'integer', required: false },
        boot: { type: 'integer', required: false, default: 0 },
        mem: { type: 'integer', required: false }
      },
      cacheKeyTemplate: 'sensor_latest:{sensorId}',
      metricsFields: ['ph', 'ec', 'ppm', 'temperatura_agua']
    });

    this.registerSensorType('LIGHT', {
      name: 'Sensor de Luz',
      description: 'Sensor de luz ambiental y espectro',
      mqttTopicTemplate: 'Invernadero/{sensorId}/data',
      tableName: 'sensor_data_generic',
      payloadTemplate: {
        light: { type: 'float', required: true, min: 0, max: 100000 },
        white_light: { type: 'float', required: false, min: 0, max: 100000 },
        raw_light: { type: 'float', required: false, min: 0, max: 100000 },
        uv_index: { type: 'float', required: false, min: 0, max: 15 },
        rssi: { type: 'integer', required: false },
        boot: { type: 'integer', required: false, default: 0 },
        mem: { type: 'integer', required: false },
        stats: {
          type: 'object',
          required: false,
          properties: {
            lmin: { type: 'float' },
            lmax: { type: 'float' },
            lavg: { type: 'float' },
            wmin: { type: 'float' },
            wmax: { type: 'float' },
            wavg: { type: 'float' },
            total: { type: 'integer' },
            errors: { type: 'integer' }
          }
        }
      },
      cacheKeyTemplate: 'sensor_latest:{sensorId}',
      metricsFields: ['light', 'white_light', 'raw_light', 'uv_index']
    });

    this.registerSensorType('SOIL_MOISTURE', {
      name: 'Humedad del Suelo',
      description: 'Sensor de humedad del suelo y nutrientes',
      mqttTopicTemplate: 'Invernadero/{sensorId}/data',
      tableName: 'sensor_data_generic',
      payloadTemplate: {
        humedad_suelo: { type: 'float', required: true, min: 0, max: 100 },
        temperatura_suelo: { type: 'float', required: false, min: -10, max: 50 },
        conductividad: { type: 'float', required: false, min: 0, max: 2000 },
        nitrogeno: { type: 'float', required: false, min: 0, max: 500 },
        fosforo: { type: 'float', required: false, min: 0, max: 500 },
        potasio: { type: 'float', required: false, min: 0, max: 500 },
        rssi: { type: 'integer', required: false },
        boot: { type: 'integer', required: false, default: 0 },
        mem: { type: 'integer', required: false }
      },
      cacheKeyTemplate: 'sensor_latest:{sensorId}',
      metricsFields: ['humedad_suelo', 'temperatura_suelo', 'conductividad', 'nitrogeno', 'fosforo', 'potasio']
    });

    this.registerSensorType('CO2', {
      name: 'Dióxido de Carbono',
      description: 'Sensor de CO2 y calidad del aire',
      mqttTopicTemplate: 'Invernadero/{sensorId}/data',
      tableName: 'sensor_data_generic',
      payloadTemplate: {
        co2: { type: 'float', required: true, min: 0, max: 10000 },
        tvoc: { type: 'float', required: false, min: 0, max: 1000 },
        temperatura: { type: 'float', required: false, min: -50, max: 80 },
        humedad: { type: 'float', required: false, min: 0, max: 100 },
        rssi: { type: 'integer', required: false },
        boot: { type: 'integer', required: false, default: 0 },
        mem: { type: 'integer', required: false }
      },
      cacheKeyTemplate: 'sensor_latest:{sensorId}',
      metricsFields: ['co2', 'tvoc', 'temperatura', 'humedad']
    });

    this.registerSensorType('POWER_MONITOR', {
      name: 'Monitor de Consumo',
      description: 'Sensor de consumo eléctrico',
      mqttTopicTemplate: 'Invernadero/{sensorId}/data',
      tableName: 'power_monitor_logs',
      payloadTemplate: {
        voltage: { type: 'float', required: true, min: 0, max: 300 },
        current: { type: 'float', required: true, min: 0, max: 50 },
        watts: { type: 'float', required: true, min: 0, max: 5000 },
        frequency: { type: 'float', required: false, min: 40, max: 70 },
        power_factor: { type: 'float', required: false, min: 0, max: 1 },
        energy_total: { type: 'float', required: false, min: 0 },
        rssi: { type: 'integer', required: false },
        boot: { type: 'integer', required: false, default: 0 },
        mem: { type: 'integer', required: false }
      },
      cacheKeyTemplate: 'sensor_latest:{sensorId}',
      metricsFields: ['voltage', 'current', 'watts', 'frequency', 'power_factor', 'energy_total'],
      specialHandling: {
        deviceLinking: true, // Requiere vincular a un dispositivo
        deviceIdField: 'monitors_device_id'
      }
    });

    this.registerSensorType('WEATHER_STATION', {
      name: 'Estación Meteorológica',
      description: 'Estación meteorológica completa',
      mqttTopicTemplate: 'Invernadero/{sensorId}/data',
      tableName: 'weather_current',
      payloadTemplate: {
        temperatura: { type: 'float', required: true, min: -50, max: 80 },
        humedad: { type: 'float', required: true, min: 0, max: 100 },
        presion: { type: 'float', required: false, min: 300, max: 1200 },
        velocidad_viento: { type: 'float', required: false, min: 0, max: 200 },
        direccion_viento: { type: 'string', required: false },
        precipitacion: { type: 'float', required: false, min: 0, max: 500 },
        uv_index: { type: 'float', required: false, min: 0, max: 15 },
        visibilidad: { type: 'float', required: false, min: 0, max: 50 },
        rssi: { type: 'integer', required: false },
        boot: { type: 'integer', required: false, default: 0 },
        mem: { type: 'integer', required: false }
      },
      cacheKeyTemplate: 'sensor_latest:{sensorId}',
      metricsFields: ['temperatura', 'humedad', 'presion', 'velocidad_viento', 'precipitacion', 'uv_index']
    });

    this.registerSensorType('MOTION', {
      name: 'Sensor de Movimiento',
      description: 'Sensor de movimiento y presencia',
      mqttTopicTemplate: 'Invernadero/{sensorId}/data',
      tableName: 'sensor_data_generic',
      payloadTemplate: {
        motion_detected: { type: 'boolean', required: true },
        confidence: { type: 'float', required: false, min: 0, max: 100 },
        distance: { type: 'float', required: false, min: 0, max: 10 },
        rssi: { type: 'integer', required: false },
        boot: { type: 'integer', required: false, default: 0 },
        mem: { type: 'integer', required: false }
      },
      cacheKeyTemplate: 'sensor_latest:{sensorId}',
      metricsFields: ['motion_detected', 'confidence', 'distance']
    });

    this.registerSensorType('CUSTOM', {
      name: 'Sensor Personalizado',
      description: 'Sensor con campos personalizables',
      mqttTopicTemplate: 'Invernadero/{sensorId}/data',
      tableName: 'sensor_data_generic',
      payloadTemplate: {
        value: { type: 'float', required: true },
        unit: { type: 'string', required: false },
        rssi: { type: 'integer', required: false },
        boot: { type: 'integer', required: false, default: 0 },
        mem: { type: 'integer', required: false }
      },
      cacheKeyTemplate: 'sensor_latest:{sensorId}',
      metricsFields: ['value'],
      customizable: true
    });

    console.log(`✅ Initialized ${this.sensorTypes.size} sensor types`);
  }

  /**
   * Registra un nuevo tipo de sensor
   */
  registerSensorType(typeId, config) {
    this.sensorTypes.set(typeId, {
      id: typeId,
      ...config,
      createdAt: new Date()
    });
  }

  /**
   * Obtiene un tipo de sensor por ID
   */
  getSensorType(typeId) {
    return this.sensorTypes.get(typeId);
  }

  /**
   * Obtiene todos los tipos de sensores
   */
  getAllSensorTypes() {
    return Array.from(this.sensorTypes.values());
  }

  /**
   * Genera un tópico MQTT para un sensor específico
   */
  generateMqttTopic(sensorTypeId, sensorId) {
    const sensorType = this.getSensorType(sensorTypeId);
    if (!sensorType) {
      throw new Error(`Tipo de sensor no encontrado: ${sensorTypeId}`);
    }

    return sensorType.mqttTopicTemplate.replace('{sensorId}', sensorId);
  }

  /**
   * Genera una clave de caché para un sensor
   */
  generateCacheKey(sensorTypeId, sensorId) {
    const sensorType = this.getSensorType(sensorTypeId);
    if (!sensorType) {
      throw new Error(`Tipo de sensor no encontrado: ${sensorTypeId}`);
    }

    return sensorType.cacheKeyTemplate.replace('{sensorId}', sensorId);
  }

  /**
   * Valida un payload contra la plantilla del tipo de sensor
   */
  validatePayload(sensorTypeId, payload) {
    const sensorType = this.getSensorType(sensorTypeId);
    if (!sensorType) {
      return { valid: false, error: `Tipo de sensor no encontrado: ${sensorTypeId}` };
    }

    const template = sensorType.payloadTemplate;
    const errors = [];

    // Validar campos requeridos
    for (const [field, config] of Object.entries(template)) {
      if (config.required && payload[field] === undefined) {
        errors.push(`Campo requerido faltante: ${field}`);
      }

      if (payload[field] !== undefined) {
        const fieldError = this.validateField(field, payload[field], config);
        if (fieldError) {
          errors.push(fieldError);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Valida un campo individual
   */
  validateField(fieldName, value, config) {
    switch (config.type) {
    case 'float':
      if (typeof value !== 'number') {
        return `${fieldName} debe ser un número`;
      }
      if (config.min !== undefined && value < config.min) {
        return `${fieldName} debe ser mayor o igual a ${config.min}`;
      }
      if (config.max !== undefined && value > config.max) {
        return `${fieldName} debe ser menor o igual a ${config.max}`;
      }
      break;

    case 'integer':
      if (!Number.isInteger(value)) {
        return `${fieldName} debe ser un número entero`;
      }
      if (config.min !== undefined && value < config.min) {
        return `${fieldName} debe ser mayor o igual a ${config.min}`;
      }
      if (config.max !== undefined && value > config.max) {
        return `${fieldName} debe ser menor o igual a ${config.max}`;
      }
      break;

    case 'string':
      if (typeof value !== 'string') {
        return `${fieldName} debe ser una cadena de texto`;
      }
      if (config.maxLength && value.length > config.maxLength) {
        return `${fieldName} debe tener máximo ${config.maxLength} caracteres`;
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return `${fieldName} debe ser true o false`;
      }
      break;

    case 'object':
      if (typeof value !== 'object' || value === null) {
        return `${fieldName} debe ser un objeto`;
      }
      if (config.properties) {
        for (const [prop, propConfig] of Object.entries(config.properties)) {
          if (value[prop] !== undefined) {
            const propError = this.validateField(prop, value[prop], propConfig);
            if (propError) {
              return `${fieldName}.${propError}`;
            }
          }
        }
      }
      break;
    }

    return null;
  }

  /**
   * Genera un payload de ejemplo para un tipo de sensor
   */
  generateSamplePayload(sensorTypeId) {
    const sensorType = this.getSensorType(sensorTypeId);
    if (!sensorType) {
      throw new Error(`Tipo de sensor no encontrado: ${sensorTypeId}`);
    }

    const payload = {};
    const template = sensorType.payloadTemplate;

    for (const [field, config] of Object.entries(template)) {
      if (config.required || Math.random() > 0.3) {
        payload[field] = this.generateSampleValue(config);
      }
    }

    return payload;
  }

  /**
   * Genera un valor de ejemplo basado en la configuración del campo
   */
  generateSampleValue(config) {
    switch (config.type) {
    case 'float':
      const min = config.min || 0;
      const max = config.max || 100;
      return parseFloat((min + Math.random() * (max - min)).toFixed(2));

    case 'integer':
      const intMin = config.min || 0;
      const intMax = config.max || 100;
      return Math.floor(intMin + Math.random() * (intMax - intMin));

    case 'string':
      return config.default || 'sample_value';

    case 'boolean':
      return Math.random() > 0.5;

    case 'object':
      const obj = {};
      if (config.properties) {
        for (const [prop, propConfig] of Object.entries(config.properties)) {
          if (Math.random() > 0.4) {
            obj[prop] = this.generateSampleValue(propConfig);
          }
        }
      }
      return obj;

    default:
      return config.default || null;
    }
  }

  /**
   * Obtiene los campos de métricas para un tipo de sensor
   */
  getMetricsFields(sensorTypeId) {
    const sensorType = this.getSensorType(sensorTypeId);
    return sensorType ? sensorType.metricsFields : [];
  }

  /**
   * Verifica si un tipo de sensor tiene manejo especial
   */
  hasSpecialHandling(sensorTypeId) {
    const sensorType = this.getSensorType(sensorTypeId);
    return sensorType ? Boolean(sensorType.specialHandling) : false;
  }

  /**
   * Obtiene la configuración de manejo especial
   */
  getSpecialHandling(sensorTypeId) {
    const sensorType = this.getSensorType(sensorTypeId);
    return sensorType ? sensorType.specialHandling : null;
  }
}

module.exports = new SensorTypeService();
