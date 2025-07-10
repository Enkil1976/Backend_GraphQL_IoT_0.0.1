const dynamicSensorService = require('../../../services/dynamicSensorService');
const sensorTypeService = require('../../../services/sensorTypeService');
const { AuthenticationError, ForbiddenError, UserInputError } = require('apollo-server-express');

/**
 * Resolvers de mutaciones para gestión dinámica de sensores
 */
const sensorMutations = {
  /**
   * Crea un nuevo sensor dinámico
   */
  createSensor: async(_, { input }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para crear sensores');
    }

    if (user.role !== 'admin') {
      throw new ForbiddenError('Solo los administradores pueden crear sensores');
    }

    try {
      // Validar input
      if (!input.sensorId || !input.name || !input.type) {
        throw new UserInputError('sensorId, name y type son campos requeridos');
      }

      // Verificar que el tipo de sensor existe
      const sensorType = sensorTypeService.getSensorType(input.type);
      if (!sensorType) {
        throw new UserInputError(`Tipo de sensor no válido: ${input.type}`);
      }

      // Verificar que el sensorId no existe
      const existingSensor = await dynamicSensorService.getSensorById(input.sensorId);
      if (existingSensor) {
        throw new UserInputError(`Ya existe un sensor con ID: ${input.sensorId}`);
      }

      // Crear sensor
      const sensor = await dynamicSensorService.createSensor(input, user.id);

      return dynamicSensorService.formatSensorForGraphQL(sensor);

    } catch (error) {
      console.error('❌ Error in createSensor mutation:', error);
      throw error;
    }
  },

  /**
   * Actualiza un sensor existente
   */
  updateSensor: async(_, { id, input }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para actualizar sensores');
    }

    if (user.role !== 'admin') {
      throw new ForbiddenError('Solo los administradores pueden actualizar sensores');
    }

    try {
      const sensor = await dynamicSensorService.updateSensor(id, input, user.id);
      return dynamicSensorService.formatSensorForGraphQL(sensor);

    } catch (error) {
      console.error('❌ Error in updateSensor mutation:', error);
      throw error;
    }
  },

  /**
   * Elimina un sensor
   */
  deleteSensor: async(_, { id }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para eliminar sensores');
    }

    if (user.role !== 'admin') {
      throw new ForbiddenError('Solo los administradores pueden eliminar sensores');
    }

    try {
      const deletedSensor = await dynamicSensorService.deleteSensor(id, user.id);

      return {
        id: deletedSensor.id,
        sensorId: deletedSensor.sensor_id,
        name: deletedSensor.name,
        deletedAt: new Date().toISOString(),
        deletedBy: user
      };

    } catch (error) {
      console.error('❌ Error in deleteSensor mutation:', error);
      throw error;
    }
  },

  /**
   * Configura MQTT para un sensor
   */
  configureSensorMQTT: async(_, { input }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para configurar MQTT');
    }

    if (user.role !== 'admin') {
      throw new ForbiddenError('Solo los administradores pueden configurar MQTT');
    }

    try {
      const { sensorId, mqttTopic, payloadFormat, samplePayload, cacheKey, metricsFields, dataAgeMinutes, updateFrequency } = input;

      // Verificar que el sensor existe
      const sensor = await dynamicSensorService.getSensorById(sensorId);
      if (!sensor) {
        throw new UserInputError(`Sensor no encontrado: ${sensorId}`);
      }

      // Construir configuración MQTT
      const mqttConfig = {
        mqtt_topic: mqttTopic,
        payload_format: payloadFormat,
        sample_payload: samplePayload || {},
        cache_key: cacheKey || `sensor_latest:${sensor.hardware_id?.toLowerCase() || sensorId}`,
        metrics_fields: metricsFields || Object.keys(payloadFormat || {}),
        data_age_minutes: dataAgeMinutes || 60,
        update_frequency: updateFrequency || 30
      };

      // Actualizar configuración del sensor
      const updatedSensor = await dynamicSensorService.updateSensorMQTTConfig(sensorId, mqttConfig);

      console.log(`✅ MQTT configured for sensor ${sensorId}:`, {
        topic: mqttTopic,
        fields: metricsFields || Object.keys(payloadFormat || {})
      });

      return dynamicSensorService.formatSensorForGraphQL(updatedSensor);

    } catch (error) {
      console.error('❌ Error in configureSensorMQTT mutation:', error);
      throw error;
    }
  },

  /**
   * Configura alertas para un sensor
   */
  configureSensorAlerts: async(_, { sensorId, alerts }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para configurar alertas');
    }

    if (user.role !== 'admin' && user.role !== 'user') {
      throw new ForbiddenError('No tiene permisos para configurar alertas');
    }

    try {
      // Verificar que el sensor existe
      const sensor = await dynamicSensorService.getSensorById(sensorId);
      if (!sensor) {
        throw new UserInputError(`Sensor no encontrado: ${sensorId}`);
      }

      // TODO: Implementar lógica de configuración de alertas
      // Por ahora retornamos un array vacío
      return [];

    } catch (error) {
      console.error('❌ Error in configureSensorAlerts mutation:', error);
      throw error;
    }
  },

  /**
   * Prueba un payload de sensor
   */
  testSensorPayload: async(_, { sensorId, payload }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para probar payloads');
    }

    try {
      const validation = dynamicSensorService.validateSensorPayload(sensorId, payload);

      const isValid = validation.valid;
      const errorMessages = validation.errors || [];
      
      return {
        valid: isValid,
        isValid: isValid,
        errors: errorMessages.map(error => ({ field: '', message: error, code: 'VALIDATION_ERROR' })),
        errorMessages: errorMessages,
        warnings: [],
        validatedPayload: isValid ? payload : null
      };

    } catch (error) {
      console.error('❌ Error in testSensorPayload mutation:', error);
      throw error;
    }
  },

  /**
   * Crea un nuevo tipo de sensor
   */
  createSensorType: async(_, { input }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para crear tipos de sensores');
    }

    if (user.role !== 'admin') {
      throw new ForbiddenError('Solo los administradores pueden crear tipos de sensores');
    }

    try {
      // Validar input
      if (!input.typeId || !input.name || !input.mqttTopicTemplate || !input.payloadTemplate) {
        throw new UserInputError('typeId, name, mqttTopicTemplate y payloadTemplate son campos requeridos');
      }

      // Verificar que el tipo no existe
      const existingType = sensorTypeService.getSensorType(input.typeId);
      if (existingType) {
        throw new UserInputError(`Ya existe un tipo de sensor con ID: ${input.typeId}`);
      }

      // Registrar nuevo tipo
      const sensorTypeConfig = {
        name: input.name,
        description: input.description || '',
        mqttTopicTemplate: input.mqttTopicTemplate,
        payloadTemplate: input.payloadTemplate,
        tableName: input.defaultTableName,
        cacheKeyTemplate: input.cacheKeyTemplate || 'sensor_latest:{sensorId}',
        metricsFields: input.metricsFields || [],
        specialHandling: input.specialHandling || {},
        customizable: input.isCustomizable || false
      };

      sensorTypeService.registerSensorType(input.typeId, sensorTypeConfig);

      // TODO: Persistir en base de datos
      // Por ahora solo se registra en memoria

      return {
        id: input.typeId,
        typeId: input.typeId,
        name: input.name,
        description: input.description || '',
        mqttTopicTemplate: input.mqttTopicTemplate,
        payloadTemplate: input.payloadTemplate,
        defaultTableName: input.defaultTableName,
        cacheKeyTemplate: input.cacheKeyTemplate || 'sensor_latest:{sensorId}',
        availableFields: input.availableFields || [],
        metricsFields: input.metricsFields || [],
        specialHandling: input.specialHandling || {},
        isActive: true,
        isCustomizable: input.isCustomizable || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sensors: []
      };

    } catch (error) {
      console.error('❌ Error in createSensorType mutation:', error);
      throw error;
    }
  },

  /**
   * Actualiza un tipo de sensor existente
   */
  updateSensorType: async(_, { typeId, input }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para actualizar tipos de sensores');
    }

    if (user.role !== 'admin') {
      throw new ForbiddenError('Solo los administradores pueden actualizar tipos de sensores');
    }

    try {
      const existingType = sensorTypeService.getSensorType(typeId);
      if (!existingType) {
        throw new UserInputError(`Tipo de sensor no encontrado: ${typeId}`);
      }

      // TODO: Implementar actualización de tipos de sensores
      throw new Error('updateSensorType no implementado aún');

    } catch (error) {
      console.error('❌ Error in updateSensorType mutation:', error);
      throw error;
    }
  },

  /**
   * Elimina un tipo de sensor
   */
  deleteSensorType: async(_, { typeId }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para eliminar tipos de sensores');
    }

    if (user.role !== 'admin') {
      throw new ForbiddenError('Solo los administradores pueden eliminar tipos de sensores');
    }

    try {
      const existingType = sensorTypeService.getSensorType(typeId);
      if (!existingType) {
        throw new UserInputError(`Tipo de sensor no encontrado: ${typeId}`);
      }

      // TODO: Implementar eliminación de tipos de sensores
      throw new Error('deleteSensorType no implementado aún');

    } catch (error) {
      console.error('❌ Error in deleteSensorType mutation:', error);
      throw error;
    }
  }
};

module.exports = sensorMutations;
