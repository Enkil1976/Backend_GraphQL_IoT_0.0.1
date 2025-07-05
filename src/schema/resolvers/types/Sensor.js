const sensorService = require('../../../services/sensorService');
const mqttService = require('../../../services/mqttService');

/**
 * Sensor Type Resolvers
 * Handles nested field resolution for Sensor type
 */
const Sensor = {
  /**
   * Get latest reading for this sensor
   */
  latestReading: async (sensor, args, context) => {
    try {
      console.log(`[SensorTypeResolver] Getting latest reading for sensor ${sensor.id}`);
      
      let data;
      
      // Get latest data based on sensor type
      switch (sensor.type) {
        case 'TEMHUM1':
          data = await mqttService.getLatestData('temhum1');
          if (data) {
            return {
              id: `${sensor.id}_latest`,
              sensorId: sensor.id,
              timestamp: data.last_updated,
              temperatura: parseFloat(data.temperatura),
              humedad: parseFloat(data.humedad),
              heatIndex: data.heatindex ? parseFloat(data.heatindex) : null,
              dewPoint: data.dewpoint ? parseFloat(data.dewpoint) : null,
              rssi: data.rssi ? parseInt(data.rssi) : null
            };
          }
          break;

        case 'TEMHUM2':
          data = await mqttService.getLatestData('temhum2');
          if (data) {
            return {
              id: `${sensor.id}_latest`,
              sensorId: sensor.id,
              timestamp: data.last_updated,
              temperatura: parseFloat(data.temperatura),
              humedad: parseFloat(data.humedad),
              heatIndex: data.heatindex ? parseFloat(data.heatindex) : null,
              dewPoint: data.dewpoint ? parseFloat(data.dewpoint) : null,
              rssi: data.rssi ? parseInt(data.rssi) : null
            };
          }
          break;

        case 'CALIDAD_AGUA':
          data = await mqttService.getLatestData('calidad_agua');
          if (data) {
            return {
              id: `${sensor.id}_latest`,
              sensorId: sensor.id,
              timestamp: data.last_updated_multiparam || data.last_updated_temp_agua,
              ph: data.ph ? parseFloat(data.ph) : null,
              ec: data.ec ? parseFloat(data.ec) : null,
              ppm: data.ppm ? parseFloat(data.ppm) : null,
              temperaturaAgua: data.temperatura_agua ? parseFloat(data.temperatura_agua) : null
            };
          }
          break;

        case 'LUXOMETRO':
          data = await mqttService.getLatestData('luxometro');
          if (data) {
            return {
              id: `${sensor.id}_latest`,
              sensorId: sensor.id,
              timestamp: data.last_updated,
              light: parseFloat(data.light),
              whiteLight: data.white_light ? parseFloat(data.white_light) : null,
              rawLight: data.raw_light ? parseFloat(data.raw_light) : null,
              rssi: data.rssi ? parseInt(data.rssi) : null
            };
          }
          break;

        case 'POWER_MONITOR':
          if (sensor.deviceId) {
            data = await mqttService.getLatestData('power', sensor.deviceId);
            if (data) {
              return {
                id: `${sensor.id}_latest`,
                sensorId: sensor.id,
                timestamp: data.last_updated,
                watts: data.watts ? parseFloat(data.watts) : null,
                voltage: data.voltage ? parseFloat(data.voltage) : null,
                current: data.current ? parseFloat(data.current) : null,
                frequency: data.frequency ? parseFloat(data.frequency) : null,
                powerFactor: data.power_factor ? parseFloat(data.power_factor) : null
              };
            }
          }
          break;
      }
      
      return null;
    } catch (error) {
      console.error(`[SensorTypeResolver] Error getting latest reading for sensor ${sensor.id}:`, error);
      return null;
    }
  },

  /**
   * Get historical readings for this sensor
   */
  readings: async (sensor, { limit, from, to }, context) => {
    try {
      console.log(`[SensorTypeResolver] Getting readings for sensor ${sensor.id}`, { limit, from, to });
      
      const options = { limit: limit || 100 };
      if (from) options.from = from;
      if (to) options.to = to;

      const readingsResponse = await sensorService.getSensorReadings(sensor.id, options);
      
      // Return just the array of readings (not the full paginated response)
      return readingsResponse.edges.map(edge => edge.node);
    } catch (error) {
      console.error(`[SensorTypeResolver] Error getting readings for sensor ${sensor.id}:`, error);
      return [];
    }
  },

  /**
   * Get statistics for this sensor
   */
  stats: async (sensor, { timeRange }, context) => {
    try {
      console.log(`[SensorTypeResolver] Getting stats for sensor ${sensor.id}`, { timeRange });
      
      // Default time range if not provided (last 24 hours)
      const defaultTimeRange = timeRange || {
        from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString()
      };

      return await sensorService.getSensorStats(sensor.id, defaultTimeRange);
    } catch (error) {
      console.error(`[SensorTypeResolver] Error getting stats for sensor ${sensor.id}:`, error);
      return null;
    }
  }
};

/**
 * SensorReading Type Resolvers
 */
const SensorReading = {
  /**
   * Resolve sensor for a reading
   */
  sensor: async (reading, args, context) => {
    try {
      return await sensorService.getSensorById(reading.sensorId);
    } catch (error) {
      console.error(`[SensorReadingResolver] Error getting sensor for reading:`, error);
      return null;
    }
  }
};

/**
 * SensorStatistics Type Resolvers
 */
const SensorStatistics = {
  /**
   * Resolve sensor for statistics
   */
  sensor: async (stats, args, context) => {
    try {
      return await sensorService.getSensorById(stats.sensorId);
    } catch (error) {
      console.error(`[SensorStatsResolver] Error getting sensor for stats:`, error);
      return null;
    }
  }
};

module.exports = {
  Sensor,
  SensorReading,
  SensorStatistics
};