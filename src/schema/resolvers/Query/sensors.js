const sensorService = require('../../../services/sensorService');
const { AuthenticationError, ForbiddenError } = require('apollo-server-express');

/**
 * Sensor Query Resolvers
 * Handles all sensor-related GraphQL queries
 */
const sensorQueries = {
  /**
   * Get all sensors with optional filtering
   */
  sensors: async (parent, { types, online }, context) => {
    try {
      console.log('[SensorResolver] Getting sensors', { types, online, user: context.user?.username });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view sensor data');
      }

      const filters = {};
      if (types && types.length > 0) {
        filters.types = types;
      }
      if (typeof online === 'boolean') {
        filters.online = online;
      }

      const sensors = await sensorService.getSensors(filters);
      
      console.log(`[SensorResolver] Found ${sensors.length} sensors`);
      return sensors;
    } catch (error) {
      console.error('[SensorResolver] Error in sensors query:', error);
      throw error;
    }
  },

  /**
   * Get sensor by ID
   */
  sensor: async (parent, { id }, context) => {
    try {
      console.log(`[SensorResolver] Getting sensor ${id}`, { user: context.user?.username });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view sensor details');
      }

      const sensor = await sensorService.getSensorById(id);
      
      if (!sensor) {
        return null;
      }

      console.log(`[SensorResolver] Found sensor: ${sensor.name}`);
      return sensor;
    } catch (error) {
      console.error(`[SensorResolver] Error getting sensor ${id}:`, error);
      if (error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get sensor readings with pagination
   */
  sensorReadings: async (parent, { sensorId, limit, offset, from, to }, context) => {
    try {
      console.log(`[SensorResolver] Getting readings for sensor ${sensorId}`, { 
        limit, offset, from, to, user: context.user?.username 
      });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view sensor readings');
      }

      const options = { limit, offset };
      if (from) options.from = from;
      if (to) options.to = to;

      const readings = await sensorService.getSensorReadings(sensorId, options);
      
      console.log(`[SensorResolver] Found ${readings.edges.length} readings (total: ${readings.totalCount})`);
      return readings;
    } catch (error) {
      console.error(`[SensorResolver] Error getting readings for sensor ${sensorId}:`, error);
      throw error;
    }
  },

  /**
   * Get latest sensor data for specified types
   */
  latestSensorData: async (parent, { types }, context) => {
    try {
      console.log('[SensorResolver] Getting latest sensor data', { types, user: context.user?.username });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view sensor data');
      }

      // Default to all sensor types if none specified
      const sensorTypes = types && types.length > 0 ? types : ['TEMHUM1', 'TEMHUM2', 'CALIDAD_AGUA', 'LUXOMETRO', 'POWER_MONITOR'];
      
      const latestData = await sensorService.getLatestSensorData(sensorTypes);
      
      console.log(`[SensorResolver] Found ${latestData.length} latest readings`);
      return latestData;
    } catch (error) {
      console.error('[SensorResolver] Error getting latest sensor data:', error);
      throw error;
    }
  },

  /**
   * Get sensor statistics for a time range
   */
  sensorStats: async (parent, { sensorId, timeRange }, context) => {
    try {
      console.log(`[SensorResolver] Getting stats for sensor ${sensorId}`, { 
        timeRange, user: context.user?.username 
      });
      
      // Authentication required  
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view sensor statistics');
      }

      // Editors and above can view detailed statistics
      if (!context.user.role || !['admin', 'editor', 'operator'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to view sensor statistics');
      }

      const stats = await sensorService.getSensorStats(sensorId, timeRange);
      
      if (!stats) {
        return null;
      }

      console.log(`[SensorResolver] Generated stats for sensor ${sensorId}`);
      return stats;
    } catch (error) {
      console.error(`[SensorResolver] Error getting stats for sensor ${sensorId}:`, error);
      throw error;
    }
  }
};

module.exports = sensorQueries;