const dynamicSensorService = require('../../../services/dynamicSensorService');
const sensorTypeService = require('../../../services/sensorTypeService');
const { AuthenticationError, UserInputError } = require('apollo-server-express');

/**
 * Resolvers de consultas para gestión dinámica de sensores
 */
const sensorQueries = {
  /**
   * Obtiene todos los sensores con filtros opcionales
   */
  sensors: async(_, { types, online }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver sensores');
    }

    try {
      const filters = {};

      if (types && types.length > 0) {
        filters.types = types;
      }

      if (online !== undefined) {
        filters.online = online;
      }

      const sensors = await dynamicSensorService.getAllSensors(filters);
      return sensors.map(sensor => dynamicSensorService.formatSensorForGraphQL(sensor));

    } catch (error) {
      console.error('❌ Error in sensors query:', error);
      throw error;
    }
  },

  /**
   * Obtiene un sensor por ID
   */
  sensor: async(_, { id }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver sensores');
    }

    try {
      const sensor = await dynamicSensorService.getSensorById(id);
      if (!sensor) {
        return null;
      }

      return dynamicSensorService.formatSensorForGraphQL(sensor);

    } catch (error) {
      console.error('❌ Error in sensor query:', error);
      throw error;
    }
  },

  /**
   * Obtiene todos los tipos de sensores disponibles
   */
  sensorTypes: async(_, {}, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver tipos de sensores');
    }

    try {
      const sensorTypes = sensorTypeService.getAllSensorTypes();

      return sensorTypes.map(type => ({
        id: type.id,
        typeId: type.id,
        name: type.name,
        description: type.description || '',
        mqttTopicTemplate: type.mqttTopicTemplate,
        payloadTemplate: type.payloadTemplate,
        defaultTableName: type.tableName,
        cacheKeyTemplate: type.cacheKeyTemplate,
        availableFields: type.metricsFields || [],
        metricsFields: type.metricsFields || [],
        specialHandling: type.specialHandling || {},
        isActive: true,
        isCustomizable: type.customizable || false,
        createdAt: type.createdAt || new Date().toISOString(),
        updatedAt: type.createdAt || new Date().toISOString(),
        sensors: [] // TODO: Implementar relación con sensores
      }));

    } catch (error) {
      console.error('❌ Error in sensorTypes query:', error);
      throw error;
    }
  },

  /**
   * Obtiene un tipo de sensor específico
   */
  sensorType: async(_, { typeId }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver tipos de sensores');
    }

    try {
      const type = sensorTypeService.getSensorType(typeId);
      if (!type) {
        return null;
      }

      return {
        id: type.id,
        typeId: type.id,
        name: type.name,
        description: type.description || '',
        mqttTopicTemplate: type.mqttTopicTemplate,
        payloadTemplate: type.payloadTemplate,
        defaultTableName: type.tableName,
        cacheKeyTemplate: type.cacheKeyTemplate,
        availableFields: type.metricsFields || [],
        metricsFields: type.metricsFields || [],
        specialHandling: type.specialHandling || {},
        isActive: true,
        isCustomizable: type.customizable || false,
        createdAt: type.createdAt || new Date().toISOString(),
        updatedAt: type.createdAt || new Date().toISOString(),
        sensors: [] // TODO: Implementar relación con sensores
      };

    } catch (error) {
      console.error('❌ Error in sensorType query:', error);
      throw error;
    }
  },

  /**
   * Obtiene la plantilla de payload para un tipo de sensor
   */
  sensorPayloadTemplate: async(_, { typeId }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver plantillas de payload');
    }

    try {
      const type = sensorTypeService.getSensorType(typeId);
      if (!type) {
        throw new UserInputError(`Tipo de sensor no encontrado: ${typeId}`);
      }

      return type.payloadTemplate;

    } catch (error) {
      console.error('❌ Error in sensorPayloadTemplate query:', error);
      throw error;
    }
  },

  /**
   * Genera un payload de ejemplo para un tipo de sensor
   */
  sensorSamplePayload: async(_, { typeId }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para generar payloads de ejemplo');
    }

    try {
      const samplePayload = sensorTypeService.generateSamplePayload(typeId);
      return samplePayload;

    } catch (error) {
      console.error('❌ Error in sensorSamplePayload query:', error);
      throw error;
    }
  },

  /**
   * Obtiene las alertas configuradas para un sensor
   */
  sensorAlerts: async(_, { sensorId }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver alertas de sensores');
    }

    try {
      // TODO: Implementar consulta de alertas desde la base de datos
      // Por ahora retornamos un array vacío
      return [];

    } catch (error) {
      console.error('❌ Error in sensorAlerts query:', error);
      throw error;
    }
  },

  /**
   * Obtiene datos históricos de un sensor
   */
  sensorReadings: async(_, { sensorId, limit = 100, offset = 0, from, to }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver lecturas de sensores');
    }

    try {
      const sensor = await dynamicSensorService.getSensorById(sensorId);
      if (!sensor) {
        throw new UserInputError(`Sensor no encontrado: ${sensorId}`);
      }

      // TODO: Implementar consulta de datos históricos
      // Por ahora retornamos estructura vacía
      return {
        edges: [],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: null,
          endCursor: null
        },
        totalCount: 0
      };

    } catch (error) {
      console.error('❌ Error in sensorReadings query:', error);
      throw error;
    }
  },

  /**
   * Obtiene los últimos datos de sensores
   */
  latestSensorData: async(_, { types }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver datos de sensores');
    }

    try {
      const filters = {};
      if (types && types.length > 0) {
        filters.types = types;
      }

      const sensors = await dynamicSensorService.getAllSensors(filters);

      // TODO: Implementar obtención de datos más recientes
      // Por ahora retornamos array vacío
      return [];

    } catch (error) {
      console.error('❌ Error in latestSensorData query:', error);
      throw error;
    }
  },

  /**
   * Obtiene estadísticas de un sensor
   */
  sensorStats: async(_, { sensorId, timeRange }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver estadísticas de sensores');
    }

    try {
      const sensor = await dynamicSensorService.getSensorById(sensorId);
      if (!sensor) {
        throw new UserInputError(`Sensor no encontrado: ${sensorId}`);
      }

      // TODO: Implementar estadísticas reales
      // Por ahora retornamos estructura básica
      return {
        sensor: dynamicSensorService.formatSensorForGraphQL(sensor),
        timeRange: {
          from: timeRange.from,
          to: timeRange.to
        },
        totalReadings: 0,
        validReadings: 0,
        errorReadings: 0,
        dataQualityPercent: 0,
        uptimePercent: 0,
        lastOnlineTime: sensor.last_seen,
        averageInterval: 30
      };

    } catch (error) {
      console.error('❌ Error in sensorStats query:', error);
      throw error;
    }
  }
};

module.exports = sensorQueries;
