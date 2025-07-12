const { query } = require('../config/database');
const { cache } = require('../config/redis');
const dynamicSensorService = require('./dynamicSensorService');
const axios = require('axios');

/**
 * MQTT Auto-Discovery Service
 * Detecta automáticamente tópicos MQTT nuevos y crea sensores/dispositivos
 */
class MQTTAutoDiscoveryService {
  constructor() {
    this.unknownTopics = new Map();
    this.analysisQueue = [];
    this.detectionConfig = {
      enabled: process.env.MQTT_AUTO_DISCOVERY !== 'false',
      analysisWindow: 60000, // 60 segundos
      minSamples: 1, // Reducido para dispositivos que envían una sola muestra
      autoCreateThreshold: 70, // Reducido para testing
      approvalThreshold: 50
    };
    
    this.sensorDetectionRules = this.initializeSensorRules();
    this.deviceDetectionRules = this.initializeDeviceRules();
    
    console.log('🔍 MQTT Auto-Discovery Service initialized');
  }

  /**
   * Inicializa reglas de detección de sensores
   */
  initializeSensorRules() {
    return {
      topicPatterns: [
        { pattern: /\/data$/, score: 20, description: 'Ends with /data' },
        { pattern: /\/sensor\//, score: 15, description: 'Contains /sensor/' },
        { pattern: /\/reading$/, score: 15, description: 'Ends with /reading' },
        { pattern: /temhum|temp|humidity|light|water|ph|ec|ppm|pressure/i, score: 15, description: 'Sensor keywords' }
      ],
      
      payloadRules: [
        {
          name: 'hasNumericValues',
          test: (payload) => {
            const numbers = Object.values(payload).filter(v => typeof v === 'number' && !isNaN(v));
            return numbers.length >= 1;
          },
          score: 25,
          description: 'Has numeric sensor readings'
        },
        {
          name: 'hasSensorFields',
          test: (payload) => {
            const sensorFields = ['temperatura', 'humedad', 'ph', 'ec', 'ppm', 'light', 'pressure', 'lux', 'temp'];
            return sensorFields.some(field => 
              Object.keys(payload).some(key => key.toLowerCase().includes(field.toLowerCase()))
            );
          },
          score: 25,
          description: 'Contains sensor field names'
        },
        {
          name: 'lacksControlFields',
          test: (payload) => {
            const controlFields = ['sw', 'switch', 'estado', 'command', 'action', 'control'];
            return !controlFields.some(field => 
              Object.keys(payload).some(key => key.toLowerCase().includes(field.toLowerCase()))
            );
          },
          score: 10,
          description: 'Lacks control/command fields'
        },
        {
          name: 'hasMetadata',
          test: (payload) => {
            const metadataFields = ['rssi', 'timestamp', 'boot', 'mem', 'battery'];
            return metadataFields.some(field => payload.hasOwnProperty(field));
          },
          score: 5,
          description: 'Has metadata fields'
        }
      ],
      
      sensorTypes: [
        {
          type: 'TEMHUM',
          patterns: [/temhum|temp.*hum/i],
          requiredFields: ['temperatura', 'humedad'],
          optionalFields: ['heatindex', 'dewpoint', 'temp', 'humidity']
        },
        {
          type: 'WATER_QUALITY',
          patterns: [/agua|water|quality/i],
          requiredFields: [],
          optionalFields: ['ph', 'ec', 'ppm', 'temperatura', 'voltage', 'temp']
        },
        {
          type: 'WATER_PH',
          patterns: [/ph|aguaph/i],
          requiredFields: ['ph'],
          optionalFields: ['temperatura', 'voltage', 'temp']
        },
        {
          type: 'WATER_EC_PPM',
          patterns: [/ec|ppm|conductivity/i],
          requiredFields: ['ec', 'ppm'],
          optionalFields: ['temperatura', 'voltage', 'temp']
        },
        {
          type: 'LIGHT',
          patterns: [/luz|light|lux/i],
          requiredFields: ['light'],
          optionalFields: ['white_light', 'raw_light', 'lux']
        },
        {
          type: 'TEMP_PRESSURE',
          patterns: [/pressure|presion|bmp/i],
          requiredFields: ['pressure'],
          optionalFields: ['temperatura', 'temp', 'altitude']
        },
        {
          type: 'POWER',
          patterns: [/power|energia|watts/i],
          requiredFields: ['watts'],
          optionalFields: ['voltage', 'current', 'frequency', 'power_factor']
        }
      ]
    };
  }

  /**
   * Inicializa reglas de detección de dispositivos
   */
  initializeDeviceRules() {
    return {
      topicPatterns: [
        { pattern: /\/sw$/, score: 25, description: 'Ends with /sw' },
        { pattern: /\/control$/, score: 25, description: 'Ends with /control' },
        { pattern: /\/command$/, score: 20, description: 'Ends with /command' },
        { pattern: /\/set$/, score: 20, description: 'Ends with /set' },
        { pattern: /bomba|ventilador|calefactor|light|pump|fan|heater|led/i, score: 15, description: 'Device keywords' }
      ],
      
      payloadRules: [
        {
          name: 'hasBooleanValues',
          test: (payload) => {
            const booleans = Object.values(payload).filter(v => typeof v === 'boolean');
            return booleans.length >= 1;
          },
          score: 30,
          description: 'Has boolean control values'
        },
        {
          name: 'hasControlFields',
          test: (payload) => {
            const controlFields = ['sw', 'switch', 'estado', 'command', 'action', 'control'];
            return controlFields.some(field => 
              Object.keys(payload).some(key => key.toLowerCase().includes(field.toLowerCase()))
            );
          },
          score: 20,
          description: 'Contains control field names'
        },
        {
          name: 'hasStateValues',
          test: (payload) => {
            const stateValues = ['ON', 'OFF', 'true', 'false', 'ACTIVE', 'INACTIVE'];
            return Object.values(payload).some(v => 
              stateValues.includes(String(v).toUpperCase())
            );
          },
          score: 10,
          description: 'Has state values (ON/OFF)'
        },
        {
          name: 'hasDeviceId',
          test: (payload) => {
            return payload.hasOwnProperty('device_id') && typeof payload.device_id === 'string';
          },
          score: 25,
          description: 'Has device_id field'
        },
        {
          name: 'hasDeviceType',
          test: (payload) => {
            return payload.hasOwnProperty('device_type') && typeof payload.device_type === 'string';
          },
          score: 15,
          description: 'Has device_type field'
        }
      ],
      
      deviceTypes: [
        {
          type: 'water_pump',
          patterns: [/bomba|pump|water/i],
          controlFields: ['bombaSw', 'pumpSw', 'sw', 'switch', 'estado'],
          deviceTypeValues: ['water_pump', 'pump']
        },
        {
          type: 'fan',
          patterns: [/ventilador|fan|air/i],
          controlFields: ['ventiladorSw', 'fanSw', 'sw', 'switch', 'estado'],
          deviceTypeValues: ['fan', 'ventilador']
        },
        {
          type: 'heater',
          patterns: [/calefactor|heater|heat/i],
          controlFields: ['calefactorSw', 'heaterSw', 'sw', 'switch', 'estado'],
          deviceTypeValues: ['heater', 'calefactor']
        },
        {
          type: 'water_heater',
          patterns: [/calefactor.*agua|water.*heater/i],
          controlFields: ['calefactorAguaSw', 'waterHeaterSw', 'sw', 'switch', 'estado'],
          deviceTypeValues: ['water_heater', 'calefactor_agua']
        },
        {
          type: 'led_light',
          patterns: [/luz|light|led|lamp/i],
          controlFields: ['lightSw', 'ledSw', 'lampSw', 'sw', 'switch', 'estado'],
          deviceTypeValues: ['led_light', 'light', 'led']
        },
        {
          type: 'valve',
          patterns: [/valve|valvula/i],
          controlFields: ['valveSw', 'valvulaSw', 'sw', 'switch', 'estado'],
          deviceTypeValues: ['valve', 'valvula']
        },
        {
          type: 'actuator',
          patterns: [/actuator|actuador/i],
          controlFields: ['sw', 'switch', 'estado', 'command', 'action'],
          deviceTypeValues: ['actuator', 'actuador']
        }
      ]
    };
  }

  /**
   * Procesa mensaje MQTT desconocido
   */
  async processUnknownMessage(topic, payload) {
    if (!this.detectionConfig.enabled) {
      console.log('🚫 Auto-discovery disabled');
      return false;
    }

    try {
      console.log(`🔍 Processing unknown message for topic: ${topic}`);
      
      // Verificar si el tópico ya existe
      if (await this.isKnownTopic(topic)) {
        console.log(`✅ Topic ${topic} is already known, skipping`);
        return false;
      }

      console.log(`🆕 Topic ${topic} is unknown, adding to analysis queue`);
      
      // Agregar a cola de análisis
      await this.addToAnalysisQueue(topic, payload);
      
      // Verificar si tenemos suficientes muestras para análisis
      const topicData = this.unknownTopics.get(topic);
      console.log(`📊 Topic ${topic} has ${topicData.payloads.length}/${this.detectionConfig.minSamples} samples`);
      
      if (topicData && topicData.payloads.length >= this.detectionConfig.minSamples) {
        console.log(`🚀 Analyzing topic ${topic} (threshold reached)`);
        await this.analyzeAndCreate(topic, topicData);
      } else {
        console.log(`⏳ Topic ${topic} needs ${this.detectionConfig.minSamples - topicData.payloads.length} more samples`);
      }

      return true;
    } catch (error) {
      console.error('❌ Error processing unknown message:', error);
      return false;
    }
  }

  /**
   * Verifica si un tópico ya es conocido
   */
  async isKnownTopic(topic) {
    try {
      // Obtener todos los sensores activos para mapeo inteligente
      const sensorQuery = `
        SELECT id, mqtt_topic FROM sensors 
        WHERE is_active = true
      `;
      const sensorResult = await query(sensorQuery);
      
      // Aplicar la misma lógica de mapping que en dynamicSensorService
      const foundSensor = sensorResult.rows.find(sensor => {
        if (!sensor.mqtt_topic) return false;
        
        const sensorTopic = sensor.mqtt_topic.toLowerCase();
        const incomingTopic = topic.toLowerCase();
        
        // Coincidencia exacta
        if (sensorTopic === incomingTopic) {
          return true;
        }
        
        // Extraer partes del tópico para comparación inteligente
        const sensorParts = sensorTopic.split('/');
        const incomingParts = incomingTopic.split('/');
        
        // Deben tener la misma estructura básica (Invernadero/sensor/data)
        if (sensorParts.length !== incomingParts.length) {
          return false;
        }
        
        // El primer y último segmento deben coincidir
        if (sensorParts[0] !== incomingParts[0] || sensorParts[sensorParts.length - 1] !== incomingParts[incomingParts.length - 1]) {
          return false;
        }
        
        // Comparar el segmento del sensor (posición 1) con variaciones específicas
        const sensorName = sensorParts[1];
        const incomingName = incomingParts[1];
        
        // Normalizar nombres para comparación flexible
        const normalizeName = (name) => name.toLowerCase().replace(/[-_]/g, '');
        
        // Mapeo directo con normalización
        if (normalizeName(sensorName) === normalizeName(incomingName)) {
          return true;
        }
        
        // Mapeos específicos conocidos
        const specificMappings = {
          'agua': 'aguaquality01',
          'water': 'aguaquality01',
          'calidadagua': 'aguaquality01',
          'th1': 'temhum1',
          'th2': 'temhum2', 
          'th3': 'temhum3',
          'light': 'luxometro',
          'luz': 'luxometro',
          'lux': 'luxometro',
          'pressure1': 'bmp2801',
          'presion1': 'bmp2801'
        };
        
        const normalizedSensor = normalizeName(sensorName);
        const normalizedIncoming = normalizeName(incomingName);
        
        return specificMappings[normalizedIncoming] === normalizedSensor;
      });
      
      if (foundSensor) {
        console.log(`✅ Topic ${topic} is known (matches sensor ID ${foundSensor.id})`);
        return true;
      }

      // Verificar en dispositivos
      const deviceQuery = `
        SELECT id FROM devices 
        WHERE configuration->>'mqtt_topic' = $1
      `;
      const deviceResult = await query(deviceQuery, [topic]);
      if (deviceResult.rows.length > 0) {
        console.log(`✅ Topic ${topic} is known (matches device)`);
        return true;
      }

      console.log(`🆕 Topic ${topic} is truly unknown`);
      return false;
    } catch (error) {
      console.error('❌ Error checking known topic:', error);
      return false;
    }
  }

  /**
   * Agrega mensaje a cola de análisis
   */
  async addToAnalysisQueue(topic, payload) {
    const now = new Date();
    
    if (!this.unknownTopics.has(topic)) {
      this.unknownTopics.set(topic, {
        topic,
        firstSeen: now,
        lastSeen: now,
        payloads: [],
        messageCount: 0
      });
    }

    const topicData = this.unknownTopics.get(topic);
    topicData.lastSeen = now;
    topicData.messageCount++;
    
    // Guardar los primeros payloads para análisis
    if (topicData.payloads.length < 5) {
      topicData.payloads.push({
        payload: payload,
        timestamp: now
      });
    }

    console.log(`🔍 Unknown topic: ${topic} (${topicData.messageCount} messages, ${topicData.payloads.length} samples)`);
    
    // Log cuando alcance el mínimo de muestras
    if (topicData.payloads.length === this.detectionConfig.minSamples) {
      console.log(`✅ Topic ${topic} reached minimum samples (${this.detectionConfig.minSamples}), ready for analysis!`);
    }
  }

  /**
   * Analiza y crea automáticamente sensor o dispositivo
   */
  async analyzeAndCreate(topic, topicData) {
    try {
      const analysis = await this.analyzeTopicData(topic, topicData);
      
      console.log(`🤖 Analysis for ${topic}:`, {
        sensorScore: analysis.sensorScore,
        deviceScore: analysis.deviceScore,
        suggestedType: analysis.suggestedType,
        confidence: analysis.confidence
      });

      // Decisión de creación automática
      if (analysis.confidence >= this.detectionConfig.autoCreateThreshold) {
        if (analysis.suggestedType === 'sensor') {
          await this.createAutoSensor(topic, topicData, analysis);
        } else if (analysis.suggestedType === 'device') {
          await this.createAutoDevice(topic, topicData, analysis);
        }
        
        // Remover de unknownTopics después de crear
        this.unknownTopics.delete(topic);
        
      } else if (analysis.confidence >= this.detectionConfig.approvalThreshold) {
        console.log(`⏳ Topic ${topic} requires manual approval (confidence: ${analysis.confidence})`);
        await this.markForApproval(topic, topicData, analysis);
      } else {
        console.log(`❓ Topic ${topic} ignored (low confidence: ${analysis.confidence})`);
        await this.markAsIgnored(topic, topicData, analysis);
      }

    } catch (error) {
      console.error(`❌ Error analyzing topic ${topic}:`, error);
    }
  }

  /**
   * Analiza datos del tópico para clasificación
   */
  async analyzeTopicData(topic, topicData) {
    const payloads = topicData.payloads.map(p => p.payload);
    
    // Calcular scores
    const sensorScore = this.calculateSensorScore(topic, payloads);
    const deviceScore = this.calculateDeviceScore(topic, payloads);
    
    // Determinar tipo sugerido
    let suggestedType, confidence;
    if (sensorScore > deviceScore) {
      suggestedType = 'sensor';
      confidence = sensorScore;
    } else {
      suggestedType = 'device';
      confidence = deviceScore;
    }

    // Detectar subtipos específicos
    const sensorSubtype = this.detectSensorType(topic, payloads);
    const deviceSubtype = this.detectDeviceType(topic, payloads);

    return {
      topic,
      sensorScore,
      deviceScore,
      suggestedType,
      confidence,
      sensorSubtype,
      deviceSubtype,
      payloadAnalysis: this.analyzePayloadStructure(payloads)
    };
  }

  /**
   * Calcula score de sensor
   */
  calculateSensorScore(topic, payloads) {
    let score = 0;
    
    // Puntos por patrones de tópico
    for (const rule of this.sensorDetectionRules.topicPatterns) {
      if (rule.pattern.test(topic)) {
        score += rule.score;
      }
    }
    
    // Puntos por análisis de payload
    for (const payload of payloads) {
      for (const rule of this.sensorDetectionRules.payloadRules) {
        if (rule.test(payload)) {
          score += rule.score / payloads.length; // Promedio entre payloads
        }
      }
    }
    
    return Math.min(score, 100); // Máximo 100 puntos
  }

  /**
   * Calcula score de dispositivo
   */
  calculateDeviceScore(topic, payloads) {
    let score = 0;
    
    // Puntos por patrones de tópico
    for (const rule of this.deviceDetectionRules.topicPatterns) {
      if (rule.pattern.test(topic)) {
        score += rule.score;
      }
    }
    
    // Puntos por análisis de payload
    for (const payload of payloads) {
      for (const rule of this.deviceDetectionRules.payloadRules) {
        if (rule.test(payload)) {
          score += rule.score / payloads.length; // Promedio entre payloads
        }
      }
    }
    
    return Math.min(score, 100); // Máximo 100 puntos
  }

  /**
   * Detecta tipo específico de sensor
   */
  detectSensorType(topic, payloads) {
    for (const sensorType of this.sensorDetectionRules.sensorTypes) {
      // Verificar patrón de tópico
      const matchesPattern = sensorType.patterns.some(pattern => pattern.test(topic));
      
      // Verificar campos requeridos en payloads
      const hasRequiredFields = payloads.some(payload => 
        sensorType.requiredFields.every(field => 
          Object.keys(payload).some(key => key.toLowerCase().includes(field.toLowerCase()))
        )
      );
      
      if (matchesPattern || hasRequiredFields) {
        return sensorType.type;
      }
    }
    
    return 'CUSTOM'; // Tipo genérico si no coincide con ninguno específico
  }

  /**
   * Detecta tipo específico de dispositivo
   */
  detectDeviceType(topic, payloads) {
    // Primero revisar si algún payload tiene device_type específico
    for (const payload of payloads) {
      if (payload.device_type) {
        const deviceTypeValue = payload.device_type.toLowerCase();
        
        // Buscar coincidencia directa en deviceTypeValues
        for (const deviceType of this.deviceDetectionRules.deviceTypes) {
          if (deviceType.deviceTypeValues && 
              deviceType.deviceTypeValues.some(value => value.toLowerCase() === deviceTypeValue)) {
            console.log(`🎯 Device type detected from payload: ${deviceType.type}`);
            return deviceType.type;
          }
        }
        
        // Si no encuentra coincidencia directa, usar el valor tal como viene
        console.log(`🎯 Device type from payload (direct): ${payload.device_type}`);
        return payload.device_type;
      }
    }
    
    // Si no hay device_type en payload, usar detección por patrones
    for (const deviceType of this.deviceDetectionRules.deviceTypes) {
      // Verificar patrón de tópico
      const matchesPattern = deviceType.patterns.some(pattern => pattern.test(topic));
      
      // Verificar campos de control en payloads
      const hasControlFields = payloads.some(payload => 
        deviceType.controlFields.some(field => 
          Object.keys(payload).some(key => key.toLowerCase().includes(field.toLowerCase()))
        )
      );
      
      if (matchesPattern || hasControlFields) {
        console.log(`🎯 Device type detected from pattern: ${deviceType.type}`);
        return deviceType.type;
      }
    }
    
    return 'actuator'; // Tipo genérico si no coincide con ninguno específico
  }

  /**
   * Analiza estructura del payload
   */
  analyzePayloadStructure(payloads) {
    const allKeys = new Set();
    const keyTypes = {};
    
    payloads.forEach(payload => {
      Object.keys(payload).forEach(key => {
        allKeys.add(key);
        const value = payload[key];
        const type = typeof value;
        
        if (!keyTypes[key]) {
          keyTypes[key] = new Set();
        }
        keyTypes[key].add(type);
      });
    });
    
    return {
      fields: Array.from(allKeys),
      fieldTypes: Object.fromEntries(
        Object.entries(keyTypes).map(([key, types]) => [key, Array.from(types)])
      ),
      samplePayload: payloads[0]
    };
  }

  /**
   * Crea sensor automáticamente
   */
  async createAutoSensor(topic, topicData, analysis) {
    try {
      const topicParts = topic.split('/');
      const sensorName = this.generateSensorName(topicParts, analysis.sensorSubtype);
      const hardwareId = this.generateHardwareId(topicParts);
      
      console.log(`🤖 Creating auto-sensor: ${sensorName} (${analysis.sensorSubtype})`);
      
      // Crear sensor vía GraphQL interno
      const sensorData = {
        sensorId: hardwareId,
        name: sensorName,
        hardwareId: hardwareId,
        type: analysis.sensorSubtype,
        location: 'Auto-detected',
        description: `Auto-created from MQTT topic: ${topic}`,
        mqttTopic: topic  // Incluir mqtt_topic desde el inicio
      };
      
      const sensor = await this.createSensorInternal(sensorData);
      
      // Asegurar que mqtt_topic se actualice inmediatamente (fallback para compatibilidad)
      if (!sensor.mqtt_topic) {
        await query(
          'UPDATE sensors SET mqtt_topic = $1 WHERE id = $2',
          [topic, sensor.id]
        );
        sensor.mqtt_topic = topic;
      }
      
      // Configurar MQTT
      const mqttConfig = {
        sensorId: sensor.id,
        mqttTopic: topic,
        payloadFormat: this.generatePayloadFormat(analysis.payloadAnalysis),
        samplePayload: analysis.payloadAnalysis.samplePayload,
        cacheKey: `sensor_latest:${hardwareId.toLowerCase()}`,
        metricsFields: analysis.payloadAnalysis.fields.filter(field => 
          analysis.payloadAnalysis.fieldTypes[field].includes('number')
        )
      };
      
      await this.configureSensorMQTTInternal(mqttConfig);
      
      console.log(`✅ Auto-created sensor: ${sensor.name} (ID: ${sensor.id})`);
      
      // Log para auditoría
      await this.logAutoCreation('sensor', sensor.id, topic, analysis);
      
      return sensor;
      
    } catch (error) {
      console.error(`❌ Error creating auto-sensor for ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Crea dispositivo automáticamente
   */
  async createAutoDevice(topic, topicData, analysis) {
    try {
      const topicParts = topic.split('/');
      const samplePayload = analysis.payloadAnalysis.samplePayload;
      
      // Extraer IDs del payload si están disponibles
      const deviceIdFromPayload = samplePayload.device_id || null;
      const deviceTypeFromPayload = samplePayload.device_type || null;
      
      // Generar IDs usando la nueva estructura
      const deviceId = deviceIdFromPayload || this.generateDeviceId(topicParts);
      const deviceType = deviceTypeFromPayload || analysis.deviceSubtype;
      const deviceName = this.generateDeviceNameWithIds(deviceId, deviceType, topicParts);
      
      console.log(`🤖 Creating auto-device: ${deviceName}`);
      console.log(`   📋 Device ID: ${deviceId}`);
      console.log(`   🏷️  Device Type: ${deviceType}`);
      
      // Detectar campo de payload principal y crear mapeo de variables
      const payloadKey = this.detectMainPayloadKey(analysis.payloadAnalysis);
      const variableMapping = this.createDeviceVariableMapping(analysis.payloadAnalysis);
      
      // Crear dispositivo vía base de datos directa
      const deviceData = {
        device_id: deviceId,
        name: deviceName,
        type: deviceType,
        description: `Auto-created from MQTT topic: ${topic}`,
        configuration: {
          mqtt_topic: topic,
          mqtt_payload_key: payloadKey,
          variable_mapping: variableMapping,
          auto_created: true,
          created_from_analysis: analysis,
          supports_dual_id: true,
          original_device_id: deviceIdFromPayload,
          original_device_type: deviceTypeFromPayload
        }
      };
      
      const device = await this.createDeviceInternal(deviceData);
      
      console.log(`✅ Auto-created device: ${device.name} (ID: ${device.id})`);
      
      // Log para auditoría
      await this.logAutoCreation('device', device.id, topic, analysis);
      
      return device;
      
    } catch (error) {
      console.error(`❌ Error creating auto-device for ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Crea mapeo de variables para compatibilidad legacy
   */
  createDeviceVariableMapping(payloadAnalysis) {
    const mapping = {};
    
    // Mapeo de variables legacy a estándar
    const legacyMappings = {
      'bombaSw': 'estado',
      'ventiladorSw': 'estado', 
      'calefactorSw': 'estado',
      'calefactorAguaSw': 'estado',
      'ledSw': 'estado',
      'lightSw': 'estado',
      'pumpSw': 'estado',
      'fanSw': 'estado',
      'heaterSw': 'estado'
    };
    
    // Crear mapeo basado en campos encontrados
    for (const field of payloadAnalysis.fields) {
      if (legacyMappings[field]) {
        mapping[field] = legacyMappings[field];
        console.log(`📝 Variable mapping: ${field} → ${legacyMappings[field]}`);
      } else {
        mapping[field] = field; // Mantener nombre original si no hay mapeo
      }
    }
    
    return mapping;
  }

  // Métodos auxiliares para generación de nombres e IDs...

  generateSensorName(topicParts, sensorType) {
    const location = topicParts[0] || 'System';
    const identifier = topicParts[1] || 'Unknown';
    const typeMap = {
      'TEMHUM': 'Temperatura y Humedad',
      'WATER_QUALITY': 'Calidad del Agua',
      'LIGHT': 'Sensor de Luz',
      'TEMP_PRESSURE': 'Temperatura y Presión',
      'POWER': 'Monitor de Energía'
    };
    const typeName = typeMap[sensorType] || 'Sensor';
    return `${identifier} - ${typeName} (Auto)`;
  }

  generateHardwareId(topicParts) {
    return topicParts
      .filter(part => part !== 'data' && part !== 'sw' && part !== 'control')
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
  }

  generateDeviceName(topicParts, deviceType) {
    const location = topicParts[0] || 'System';
    const identifier = topicParts[1] || 'Unknown';
    const typeMap = {
      'PUMP': 'Bomba',
      'FAN': 'Ventilador',
      'HEATER': 'Calefactor',
      'LIGHT': 'Luz',
      'VALVE': 'Válvula'
    };
    const typeName = typeMap[deviceType] || 'Dispositivo';
    return `${identifier} - ${typeName} (Auto)`;
  }

  generateDeviceNameWithIds(deviceId, deviceType, topicParts) {
    // Mapeo de tipos a nombres en español
    const typeMap = {
      'water_pump': 'Bomba de Agua',
      'fan': 'Ventilador',
      'heater': 'Calefactor',
      'water_heater': 'Calentador de Agua',
      'led_light': 'Luz LED',
      'valve': 'Válvula',
      'actuator': 'Actuador',
      'PUMP': 'Bomba',
      'FAN': 'Ventilador',
      'HEATER': 'Calefactor',
      'LIGHT': 'Luz',
      'VALVE': 'Válvula'
    };
    
    const typeName = typeMap[deviceType] || deviceType;
    
    // Si tenemos un device_id específico, usarlo; si no, usar el tópico
    if (deviceId && deviceId !== 'unknown') {
      return `${typeName} - ${deviceId}`;
    } else {
      const identifier = topicParts[1] || 'Unknown';
      return `${typeName} - ${identifier} (Auto)`;
    }
  }

  generateDeviceId(topicParts) {
    return this.generateHardwareId(topicParts);
  }

  generatePayloadFormat(payloadAnalysis) {
    const format = {};
    Object.entries(payloadAnalysis.fieldTypes).forEach(([field, types]) => {
      if (types.includes('number')) {
        format[field] = 'float';
      } else if (types.includes('boolean')) {
        format[field] = 'boolean';
      } else {
        format[field] = 'string';
      }
    });
    return format;
  }

  detectMainPayloadKey(payloadAnalysis) {
    // Buscar campos que parecen ser el control principal
    const controlKeywords = ['sw', 'switch', 'estado', 'state', 'control'];
    
    for (const field of payloadAnalysis.fields) {
      for (const keyword of controlKeywords) {
        if (field.toLowerCase().includes(keyword)) {
          return field;
        }
      }
    }
    
    // Si no encuentra un campo específico, usar el primer campo booleano
    for (const [field, types] of Object.entries(payloadAnalysis.fieldTypes)) {
      if (types.includes('boolean')) {
        return field;
      }
    }
    
    // Fallback al primer campo
    return payloadAnalysis.fields[0] || 'value';
  }

  // Métodos de creación interna...
  
  async createSensorInternal(sensorData) {
    // Intentar con mqtt_topic incluido primero (versión nueva)
    try {
      const insertQuery = `
        INSERT INTO sensors (hardware_id, name, sensor_type, mqtt_topic, location, description, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      
      const result = await query(insertQuery, [
        sensorData.hardwareId,
        sensorData.name,
        sensorData.type,
        sensorData.mqttTopic || null,
        sensorData.location,
        sensorData.description
      ]);
      
      return result.rows[0];
    } catch (error) {
      // Si falla, intentar sin mqtt_topic (versión anterior para compatibilidad)
      console.log('🔄 Fallback: Creating sensor without mqtt_topic first');
      
      const insertQuery = `
        INSERT INTO sensors (hardware_id, name, sensor_type, location, description, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      
      const result = await query(insertQuery, [
        sensorData.hardwareId,
        sensorData.name,
        sensorData.type,
        sensorData.location,
        sensorData.description
      ]);
      
      // Inmediatamente actualizar con mqtt_topic
      if (sensorData.mqttTopic) {
        await query(
          'UPDATE sensors SET mqtt_topic = $1 WHERE id = $2',
          [sensorData.mqttTopic, result.rows[0].id]
        );
        result.rows[0].mqtt_topic = sensorData.mqttTopic;
      }
      
      return result.rows[0];
    }
  }

  async configureSensorMQTTInternal(mqttConfig) {
    const updateQuery = `
      UPDATE sensors 
      SET 
        mqtt_topic = $1,
        configuration = COALESCE(configuration, '{}') || $2::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `;
    
    const config = {
      mqtt_topic: mqttConfig.mqttTopic,
      payload_format: mqttConfig.payloadFormat,
      sample_payload: mqttConfig.samplePayload,
      cache_key: mqttConfig.cacheKey,
      metrics_fields: mqttConfig.metricsFields,
      auto_configured: true
    };
    
    await query(updateQuery, [
      mqttConfig.mqttTopic,
      JSON.stringify(config),
      mqttConfig.sensorId
    ]);
  }

  async createDeviceInternal(deviceData) {
    // Use the correct table structure without location column
    const insertQuery = `
      INSERT INTO devices (device_id, name, type, room, description, status, configuration, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'offline', $6::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    
    const params = [
      deviceData.device_id,
      deviceData.name,
      deviceData.type,
      deviceData.location || 'Auto-detected', // Use room instead of location
      deviceData.description,
      JSON.stringify(deviceData.configuration)
    ];
    
    const result = await query(insertQuery, params);
    return result.rows[0];
  }

  async logAutoCreation(entityType, entityId, topic, analysis) {
    try {
      const logEntry = {
        entity_type: entityType,
        entity_id: entityId,
        mqtt_topic: topic,
        analysis_result: analysis,
        created_at: new Date().toISOString()
      };
      
      await cache.lpush('auto_discovery_log', JSON.stringify(logEntry));
      await cache.ltrim('auto_discovery_log', 0, 999); // Mantener últimas 1000 entradas
      
    } catch (error) {
      console.error('❌ Error logging auto creation:', error);
    }
  }

  async markForApproval(topic, topicData, analysis) {
    // TODO: Implementar sistema de aprobación manual
    console.log(`⏳ Marking ${topic} for manual approval`);
  }

  async markAsIgnored(topic, topicData, analysis) {
    // Marcar como ignorado
    this.unknownTopics.delete(topic);
    console.log(`❌ Ignoring ${topic} (low confidence)`);
  }

  /**
   * Obtiene estadísticas del auto-discovery
   */
  getAutoDiscoveryStats() {
    return {
      unknownTopicsCount: this.unknownTopics.size,
      enabled: this.detectionConfig.enabled,
      config: this.detectionConfig,
      recentUnknown: Array.from(this.unknownTopics.values()).slice(0, 10)
    };
  }
}

module.exports = new MQTTAutoDiscoveryService();