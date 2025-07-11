const { query } = require('../config/database');
const { cache } = require('../config/redis');
const { pubsub, SENSOR_EVENTS } = require('../utils/pubsub');
const sensorTypeService = require('./sensorTypeService');

/**
 * Servicio para manejo dinámico de sensores
 * Permite crear, configurar y gestionar sensores dinámicamente
 */
class DynamicSensorService {
  constructor() {
    this.activeSensors = new Map();
    this.sensorAlerts = new Map();
    this.initializeService();
  }

  /**
   * Inicializa el servicio cargando sensores existentes
   */
  async initializeService() {
    try {
      await this.loadActiveSensors();
      await this.loadSensorAlerts();
      console.log('✅ Dynamic Sensor Service initialized');
    } catch (error) {
      console.error('❌ Error initializing Dynamic Sensor Service:', error);
    }
  }

  /**
   * Carga sensores activos desde la base de datos
   */
  async loadActiveSensors() {
    try {
      const result = await query(
        'SELECT * FROM sensors WHERE is_active = true ORDER BY created_at DESC'
      );

      for (const sensor of result.rows) {
        this.activeSensors.set(sensor.hardware_id, sensor);
        console.log(`🔧 Loaded sensor: ${sensor.hardware_id} - ${sensor.name} - Topic: ${sensor.mqtt_topic}`);
      }

      console.log(`📡 Loaded ${this.activeSensors.size} active sensors`);
    } catch (error) {
      console.error('❌ Error loading active sensors:', error);
    }
  }

  /**
   * Carga alertas de sensores activas
   */
  async loadSensorAlerts() {
    try {
      const result = await query(
        'SELECT * FROM sensor_alerts WHERE is_active = true ORDER BY created_at DESC'
      );

      for (const alert of result.rows) {
        if (!this.sensorAlerts.has(alert.hardware_id)) {
          this.sensorAlerts.set(alert.hardware_id, []);
        }
        this.sensorAlerts.get(alert.hardware_id).push(alert);
      }

      console.log(`🚨 Loaded ${result.rows.length} sensor alerts`);
    } catch (error) {
      console.error('❌ Error loading sensor alerts:', error);
    }
  }

  /**
   * Crea un nuevo sensor dinámicamente
   */
  async createSensor(sensorData, userId) {
    try {
      const {
        sensorId,
        name,
        type,
        description,
        location,
        mqttTopic,
        hardwareId,
        tableName,
        payloadTemplate,
        validationRules,
        samplingInterval,
        retentionDays,
        alertThresholds,
        customFields
      } = sensorData;

      // Validar que el tipo de sensor existe
      const sensorType = sensorTypeService.getSensorType(type);
      if (!sensorType) {
        throw new Error(`Tipo de sensor no encontrado: ${type}`);
      }

      // Generar configuración automática si no se proporciona
      const finalMqttTopic = mqttTopic || sensorTypeService.generateMqttTopic(type, sensorId);
      const finalTableName = tableName || sensorType.tableName;
      const finalPayloadTemplate = payloadTemplate || sensorType.payloadTemplate;
      const finalValidationRules = validationRules || sensorType.payloadTemplate;
      const cacheKey = sensorTypeService.generateCacheKey(type, sensorId);

      // Preparar campos de datos y métricas
      const dataFields = customFields ?
        Object.keys(customFields) :
        sensorType.metricsFields || [];

      const metricsFields = sensorType.metricsFields || [];

      // Insertar en base de datos
      const insertQuery = `
        INSERT INTO sensors (
          hardware_id, name, sensor_type, description, location,
          mqtt_topic, configuration
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const sensorConfig = {
        table_name: finalTableName,
        cache_key: cacheKey,
        data_fields: dataFields,
        metrics_fields: metricsFields,
        payload_template: finalPayloadTemplate,
        validation_rules: finalValidationRules,
        special_handling: sensorType.specialHandling || {},
        sampling_interval: samplingInterval || 30,
        retention_days: retentionDays || 90,
        alert_thresholds: alertThresholds || {},
        created_by: userId
      };

      const values = [
        hardwareId || sensorId, name, type, description, location,
        finalMqttTopic, JSON.stringify(sensorConfig)
      ];

      const result = await query(insertQuery, values);
      const newSensor = result.rows[0];

      // Agregar al mapa de sensores activos
      this.activeSensors.set(hardwareId, newSensor);

      // Publicar evento de sensor creado
      await pubsub.publish(SENSOR_EVENTS.DEVICE_CREATED, {
        sensorCreated: this.formatSensorForGraphQL(newSensor)
      });

      console.log(`✅ Sensor creado: ${hardwareId} (${type})`);
      return newSensor;

    } catch (error) {
      console.error('❌ Error creating sensor:', error);
      throw error;
    }
  }

  /**
   * Actualiza un sensor existente
   */
  async updateSensor(hardwareId, updates, userId) {
    try {
      const existingSensor = this.activeSensors.get(hardwareId);
      if (!existingSensor) {
        throw new Error(`Sensor no encontrado: ${hardwareId}`);
      }

      const updateFields = [];
      const updateValues = [];
      let valueIndex = 1;

      // Campos actualizables
      const updatableFields = {
        name: updates.name,
        description: updates.description,
        location: updates.location,
        is_active: updates.isActive,
        sampling_interval: updates.samplingInterval,
        retention_days: updates.retentionDays,
        alert_thresholds: updates.alertThresholds ? JSON.stringify(updates.alertThresholds) : undefined
      };

      for (const [field, value] of Object.entries(updatableFields)) {
        if (value !== undefined) {
          updateFields.push(`${field} = ${valueIndex}`);
          updateValues.push(value);
          valueIndex++;
        }
      }

      if (updateFields.length === 0) {
        throw new Error('No hay campos para actualizar');
      }

      // Agregar WHERE clause
      updateFields.push('updated_at = NOW()');
      updateValues.push(hardwareId);

      const updateQuery = `
        UPDATE sensors 
        SET ${updateFields.join(', ')}
        WHERE hardware_id = ${valueIndex}
        RETURNING *
      `;

      const result = await query(updateQuery, updateValues);
      const updatedSensor = result.rows[0];

      // Actualizar en el mapa
      this.activeSensors.set(updatedSensor.hardware_id, updatedSensor);

      // Publicar evento de actualización
      await pubsub.publish(SENSOR_EVENTS.DEVICE_UPDATED, {
        sensorUpdated: this.formatSensorForGraphQL(updatedSensor)
      });

      console.log(`✅ Sensor actualizado: ${hardwareId}`);
      return updatedSensor;

    } catch (error) {
      console.error('❌ Error updating sensor:', error);
      throw error;
    }
  }

  /**
   * Elimina un sensor
   */
  async deleteSensor(hardwareId, userId) {
    try {
      const existingSensor = this.activeSensors.get(hardwareId);
      if (!existingSensor) {
        throw new Error(`Sensor no encontrado: ${hardwareId}`);
      }

      // Eliminar de base de datos
      const deleteQuery = 'DELETE FROM sensors WHERE hardware_id = $1 RETURNING *';
      const result = await query(deleteQuery, [hardwareId]);
      const deletedSensor = result.rows[0];

      // Remover del mapa
      this.activeSensors.delete(hardwareId);

      // Limpiar alertas asociadas
      this.sensorAlerts.delete(hardwareId);

      // Limpiar caché
      const cacheKey = sensorTypeService.generateCacheKey(deletedSensor.type, hardwareId);
      await cache.del(cacheKey);

      // Publicar evento de eliminación
      await pubsub.publish(SENSOR_EVENTS.DEVICE_DELETED, {
        sensorDeleted: {
          id: deletedSensor.id,
          sensorId: deletedSensor.hardware_id,
          name: deletedSensor.name,
          deletedAt: new Date().toISOString(),
          deletedBy: userId
        }
      });

      console.log(`✅ Sensor eliminado: ${hardwareId}`);
      return deletedSensor;

    } catch (error) {
      console.error('❌ Error deleting sensor:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los sensores
   */
  async getAllSensors(filters = {}) {
    try {
      let whereClause = 'WHERE 1=1';
      const values = [];
      let valueIndex = 1;

      if (filters.types && filters.types.length > 0) {
        whereClause += ` AND sensor_type = ANY(${valueIndex})`;
        values.push(filters.types);
        valueIndex++;
      }

      if (filters.online !== undefined) {
        whereClause += ` AND is_online = $${valueIndex}`;
        values.push(filters.online);
        valueIndex++;
      }

      if (filters.active !== undefined) {
        whereClause += ` AND is_active = $${valueIndex}`;
        values.push(filters.active);
        valueIndex++;
      }

      const selectQuery = `
        SELECT * FROM sensors 
        ${whereClause}
        ORDER BY created_at DESC
      `;

      const result = await query(selectQuery, values);
      return result.rows;

    } catch (error) {
      console.error('❌ Error getting sensors:', error);
      throw error;
    }
  }

  /**
   * Obtiene un sensor por ID
   */
  async getSensorById(hardwareId) {
    try {
      const result = await query(
        'SELECT * FROM sensors WHERE hardware_id = $1',
        [hardwareId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error getting sensor by ID:', error);
      throw error;
    }
  }

  /**
   * Obtiene un sensor por ID numérico (para GraphQL queries)
   */
  async getSensorByNumericId(id) {
    try {
      const result = await query(
        'SELECT * FROM sensors WHERE id = $1',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error getting sensor by numeric ID:', error);
      throw error;
    }
  }

  /**
   * Procesa datos de sensor recibidos por MQTT
   */
  async processSensorData(mqttTopic, payload) {
    try {
      // Buscar sensor por tópico MQTT (case-insensitive y con variaciones específicas)
      const sensor = Array.from(this.activeSensors.values()).find(s => {
        const sensorTopic = s.mqtt_topic.toLowerCase();
        const incomingTopic = mqttTopic.toLowerCase();
        
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

      if (!sensor) {
        console.warn(`⚠️ No se encontró sensor para el tópico: ${mqttTopic}`);
        return false; // Indica que no se procesó
      }
      
      // Log cuando se encuentra un match (especialmente útil para variaciones)
      console.log(`✅ Sensor encontrado: ${sensor.hardware_id} (${sensor.mqtt_topic}) para tópico: ${mqttTopic}`);

      // Validar payload
      console.log(`🔍 Validando payload para sensor ${sensor.hardware_id} (${sensor.sensor_type}):`, JSON.stringify(payload));
      const validation = sensorTypeService.validatePayload(sensor.sensor_type, payload);
      console.log(`🔍 Resultado de validación:`, JSON.stringify(validation));
      if (!validation.valid) {
        console.error(`❌ Payload inválido para sensor ${sensor.hardware_id}:`, validation.errors || 'Sin errores específicos');
        return false; // Indica que no se procesó
      }

      // Almacenar en tabla específica
      await this.storeSensorData(sensor, payload);

      // Actualizar caché
      await this.updateSensorCache(sensor, payload);

      // Verificar alertas
      await this.checkSensorAlerts(sensor, payload);

      // Publicar suscripción GraphQL
      await this.publishSensorUpdate(sensor, payload);

      // Actualizar estado online
      await this.updateSensorOnlineStatus(sensor.hardware_id, true);

      console.log(`✅ Datos procesados para sensor: ${sensor.hardware_id}`);
      return true; // Indica que se procesó exitosamente

    } catch (error) {
      console.error('❌ Error processing sensor data:', error);
      return false; // Indica que hubo error
    }
  }

  /**
   * Normaliza payload según el tipo de sensor
   */
  normalizePayload(sensorType, rawPayload) {
    const normalized = {
      // Campos base para todos los sensores
      timestamp: new Date().toISOString(),
      rssi: rawPayload.rssi || null,
      boot: rawPayload.boot || null,
      mem: rawPayload.mem || null,
      // Datos específicos del sensor
      data: {}
    };

    switch (sensorType) {
      case 'TEMHUM':
        normalized.data = {
          temperature: rawPayload.temperatura || rawPayload.temperature,
          humidity: rawPayload.humedad || rawPayload.humidity,
          heat_index: rawPayload.heatindex || rawPayload.heat_index,
          dew_point: rawPayload.dewpoint || rawPayload.dew_point
        };
        break;

      case 'TEMP_PRESSURE':
        normalized.data = {
          temperature: rawPayload.temperatura || rawPayload.temperature,
          pressure: rawPayload.presion || rawPayload.pressure,
          altitude: rawPayload.altitude
        };
        break;

      case 'LIGHT':
        normalized.data = {
          light: rawPayload.light,
          white_light: rawPayload.white_light,
          raw_light: rawPayload.raw_light
        };
        break;

      case 'WATER_QUALITY':
        normalized.data = {
          ph: rawPayload.ph,
          ec: rawPayload.ec,
          ppm: rawPayload.ppm,
          temperature: rawPayload.temperatura || rawPayload.temperature
        };
        break;

      case 'POWER_MONITOR':
        normalized.data = {
          voltage: rawPayload.voltage,
          current: rawPayload.current,
          power: rawPayload.watts || rawPayload.power,
          frequency: rawPayload.frequency,
          power_factor: rawPayload.power_factor
        };
        break;

      default:
        // Para sensores personalizados, mantener estructura original
        normalized.data = { ...rawPayload };
        // Pero quitar campos de sistema para evitar duplicación
        delete normalized.data.rssi;
        delete normalized.data.boot;
        delete normalized.data.mem;
        break;
    }

    // Agregar estadísticas si existen
    if (rawPayload.stats) {
      normalized.stats = rawPayload.stats;
    }

    return normalized;
  }

  /**
   * Almacena datos del sensor en la tabla genérica
   */
  async storeSensorData(sensor, payload) {
    try {
      console.log(`🔍 Procesando datos para sensor ${sensor.hardware_id}:`, JSON.stringify({
        sensor_type: sensor.sensor_type,
        payload_keys: Object.keys(payload)
      }));
      
      const receivedAt = new Date();

      // Normalizar payload según tipo de sensor
      const normalizedPayload = this.normalizePayload(sensor.sensor_type, payload);
      
      console.log(`🔍 Usando tabla genérica: sensor_data_generic`);
      console.log(`📊 Payload normalizado:`, JSON.stringify(normalizedPayload, null, 2));

      // Almacenar payload normalizado con metadatos
      const enrichedPayload = {
        ...normalizedPayload,
        _metadata: {
          sensor_id: sensor.id,
          hardware_id: sensor.hardware_id,
          sensor_type: sensor.sensor_type,
          mqtt_topic: sensor.mqtt_topic,
          original_payload: payload // Mantener original para debugging
        }
      };

      const insertQuery = `
        INSERT INTO sensor_data_generic (sensor_id, payload, received_at, processed_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `;

      const result = await query(insertQuery, [
        sensor.id,
        JSON.stringify(enrichedPayload),
        receivedAt,
        new Date()
      ]);

      console.log(`✅ Datos almacenados en sensor_data_generic con ID: ${result.rows[0].id}`);

    } catch (error) {
      console.error('❌ Error storing sensor data:', error);
      throw error;
    }
  }

  /**
   * Actualiza caché del sensor
   */
  async updateSensorCache(sensor, payload) {
    try {
      // Normalizar payload para cache
      const normalizedPayload = this.normalizePayload(sensor.sensor_type, payload);
      
      // Cache key compatible con rulesEngine
      const cacheKey = `sensor_latest:${sensor.hardware_id.toLowerCase()}`;
      
      // Datos para cache en formato esperado por rulesEngine
      const cacheData = {
        // Campos básicos
        timestamp: new Date().toISOString(),
        sensor_id: sensor.id,
        hardware_id: sensor.hardware_id,
        sensor_type: sensor.sensor_type,
        
        // Datos del sensor en formato legacy para compatibilidad
        temperatura: normalizedPayload.data.temperature || null,
        humedad: normalizedPayload.data.humidity || null,
        presion: normalizedPayload.data.pressure || null,
        light: normalizedPayload.data.light || null,
        white_light: normalizedPayload.data.white_light || null,
        raw_light: normalizedPayload.data.raw_light || null,
        heatindex: normalizedPayload.data.heat_index || null,
        dewpoint: normalizedPayload.data.dew_point || null,
        
        // Campos adicionales
        rssi: normalizedPayload.rssi,
        boot: normalizedPayload.boot,
        mem: normalizedPayload.mem,
        
        // Original payload para referencia
        _original: payload,
        _normalized: normalizedPayload
      };

      console.log(`📋 Updating cache key: ${cacheKey}`);
      console.log(`📊 Cache data:`, JSON.stringify(cacheData, null, 2));

      await cache.hset(cacheKey, cacheData);

      // Almacenar datos históricos
      const metricsFields = this.getMetricsFields(sensor.sensor_type);
      for (const field of metricsFields) {
        if (cacheData[field] !== undefined && cacheData[field] !== null) {
          const historyKey = `sensor_history:${sensor.hardware_id.toLowerCase()}:${field}`;
          const dataPoint = JSON.stringify({
            ts: new Date().toISOString(),
            val: cacheData[field]
          });
          await cache.lpush(historyKey, dataPoint);
          await cache.ltrim(historyKey, 0, 99); // Mantener últimos 100 puntos
        }
      }

      console.log(`✅ Cache updated for sensor: ${sensor.hardware_id}`);

    } catch (error) {
      console.error('❌ Error updating sensor cache:', error);
    }
  }

  /**
   * Obtiene campos de métricas según tipo de sensor
   */
  getMetricsFields(sensorType) {
    switch (sensorType) {
      case 'TEMHUM':
        return ['temperatura', 'humedad', 'heatindex', 'dewpoint'];
      case 'TEMP_PRESSURE':
        return ['temperatura', 'presion'];
      case 'LIGHT':
        return ['light', 'white_light', 'raw_light'];
      case 'WATER_QUALITY':
        return ['ph', 'ec', 'ppm', 'temperatura'];
      default:
        return ['temperatura', 'humedad']; // Fallback
    }
  }

  /**
   * Verifica alertas del sensor
   */
  async checkSensorAlerts(sensor, payload) {
    try {
      const alerts = this.sensorAlerts.get(sensor.hardware_id) || [];

      for (const alert of alerts) {
        if (!alert.is_active) continue;

        const fieldValue = payload[alert.field_name];
        if (fieldValue === undefined) continue;

        let shouldTrigger = false;

        switch (alert.condition_type) {
        case 'above':
          shouldTrigger = fieldValue > alert.threshold_value;
          break;
        case 'below':
          shouldTrigger = fieldValue < alert.threshold_value;
          break;
        case 'equals':
          shouldTrigger = fieldValue === alert.threshold_value;
          break;
        case 'range':
          shouldTrigger = fieldValue < alert.threshold_min || fieldValue > alert.threshold_max;
          break;
        }

        if (shouldTrigger) {
          await this.triggerSensorAlert(alert, sensor, fieldValue);
        }
      }

    } catch (error) {
      console.error('❌ Error checking sensor alerts:', error);
    }
  }

  /**
   * Dispara una alerta de sensor
   */
  async triggerSensorAlert(alert, sensor, currentValue) {
    try {
      const now = new Date();
      const lastTriggered = alert.last_triggered ? new Date(alert.last_triggered) : null;
      const cooldownMs = alert.cooldown_minutes * 60 * 1000;

      // Verificar cooldown
      if (lastTriggered && (now - lastTriggered) < cooldownMs) {
        return;
      }

      // Actualizar estado de alerta
      await query(
        'UPDATE sensor_alerts SET is_triggered = true, last_triggered = $1, trigger_count = trigger_count + 1 WHERE id = $2',
        [now, alert.id]
      );

      // Publicar evento de alerta
      await pubsub.publish(SENSOR_EVENTS.DEVICE_UPDATED, {
        sensorAlertTriggered: {
          ...alert,
          sensor: this.formatSensorForGraphQL(sensor),
          currentValue,
          triggeredAt: now.toISOString()
        }
      });

      console.log(`🚨 Alerta disparada: ${alert.alert_name} para sensor ${sensor.hardware_id}`);

    } catch (error) {
      console.error('❌ Error triggering sensor alert:', error);
    }
  }

  /**
   * Publica actualización de sensor vía GraphQL
   */
  async publishSensorUpdate(sensor, payload) {
    try {
      const sensorReading = {
        id: `${sensor.hardware_id}_${Date.now()}`,
        sensor: this.formatSensorForGraphQL(sensor),
        timestamp: new Date().toISOString(),
        ...payload
      };

      await pubsub.publish(SENSOR_EVENTS.TEMHUM_DATA, {
        sensorDataUpdated: sensorReading
      });

    } catch (error) {
      console.error('❌ Error publishing sensor update:', error);
    }
  }

  /**
   * Actualiza estado online del sensor
   */
  async updateSensorOnlineStatus(hardwareId, isOnline) {
    try {
      await query(
        'UPDATE sensors SET is_online = $1, last_seen = NOW() WHERE hardware_id = $2',
        [isOnline, hardwareId]
      );

      // Actualizar en mapa local
      const sensor = this.activeSensors.get(hardwareId);
      if (sensor) {
        sensor.is_online = isOnline;
        sensor.last_seen = new Date();
      }

    } catch (error) {
      console.error('❌ Error updating sensor online status:', error);
    }
  }

  /**
   * Valida payload de sensor
   */
  validateSensorPayload(hardwareId, payload) {
    const sensor = this.activeSensors.get(hardwareId);
    if (!sensor) {
      return { valid: false, errors: [`Sensor no encontrado: ${hardwareId}`] };
    }

    return sensorTypeService.validatePayload(sensor.type, payload);
  }

  /**
   * Formatea sensor para GraphQL
   */
  formatSensorForGraphQL(sensor) {
    return {
      id: sensor.id,
      sensorId: sensor.hardware_id,
      name: sensor.name,
      type: sensor.sensor_type,
      description: sensor.description,
      location: sensor.location,
      isOnline: sensor.is_online,
      isActive: sensor.is_active,
      lastSeen: sensor.last_seen,
      mqttTopic: sensor.mqtt_topic,
      hardwareId: sensor.hardware_id,
      createdAt: sensor.created_at,
      updatedAt: sensor.updated_at
    };
  }

  /**
   * Actualiza configuración MQTT de un sensor
   * @param {string} sensorId - ID del sensor
   * @param {Object} mqttConfig - Configuración MQTT
   * @returns {Object} Sensor actualizado
   */
  async updateSensorMQTTConfig(sensorId, mqttConfig) {
    try {
      // Actualizar en base de datos
      const updateQuery = `
        UPDATE sensors 
        SET 
          configuration = COALESCE(configuration, '{}') || $1::jsonb,
          mqtt_topic = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 OR hardware_id = $3
        RETURNING *
      `;

      const result = await query(updateQuery, [
        JSON.stringify(mqttConfig),
        mqttConfig.mqtt_topic,
        sensorId
      ]);

      if (result.rows.length === 0) {
        throw new Error(`Sensor no encontrado: ${sensorId}`);
      }

      const updatedSensor = result.rows[0];

      // Actualizar en memoria
      this.activeSensors.set(updatedSensor.hardware_id, updatedSensor);

      // Publicar evento de actualización
      pubsub.publish(SENSOR_EVENTS.SENSOR_UPDATED, {
        sensorUpdated: this.formatSensorForGraphQL(updatedSensor)
      });

      console.log(`✅ Sensor MQTT config updated: ${updatedSensor.hardware_id} -> ${mqttConfig.mqtt_topic}`);

      return updatedSensor;

    } catch (error) {
      console.error('❌ Error updating sensor MQTT config:', error);
      throw error;
    }
  }

  /**
   * Obtiene estado del servicio
   */
  getServiceStatus() {
    return {
      activeSensors: this.activeSensors.size,
      alertsConfigured: Array.from(this.sensorAlerts.values()).reduce((sum, alerts) => sum + alerts.length, 0),
      onlineSensors: Array.from(this.activeSensors.values()).filter(s => s.is_online).length,
      sensorTypes: sensorTypeService.getAllSensorTypes().length
    };
  }
}

module.exports = new DynamicSensorService();
