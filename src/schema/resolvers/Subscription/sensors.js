const { pubsub, SENSOR_EVENTS } = require('../../../utils/pubsub');
const { AuthenticationError } = require('apollo-server-express');
const { withFilter } = require('graphql-subscriptions');

/**
 * Sensor Subscription Resolvers
 * Handles real-time sensor data subscriptions
 */
const sensorSubscriptions = {
  /**
   * Subscribe to sensor data updates
   * Filters by sensor types if specified
   */
  sensorDataUpdated: {
    subscribe: withFilter(
      (parent, args, context) => {
        console.log('[SensorSubscription] Client subscribing to sensor data updates', {
          sensorTypes: args.sensorTypes,
          user: context.user?.username
        });

        // Authentication required
        if (!context.user) {
          throw new AuthenticationError('You must be logged in to subscribe to sensor data');
        }

        // Subscribe to all sensor events
        return pubsub.asyncIterator([
          SENSOR_EVENTS.TEMHUM_DATA,
          SENSOR_EVENTS.WATER_QUALITY_DATA,
          SENSOR_EVENTS.WATER_TEMPERATURE_DATA,
          SENSOR_EVENTS.LIGHT_DATA,
          SENSOR_EVENTS.POWER_DATA
        ]);
      },
      (payload, variables, context) => {
        try {
          console.log('[SensorSubscription] Filtering sensor data update', {
            eventType: Object.keys(payload)[0],
            sensorTypes: variables.sensorTypes,
            user: context.user?.username
          });

          // If no sensor types specified, allow all
          if (!variables.sensorTypes || variables.sensorTypes.length === 0) {
            return true;
          }

          // Determine the sensor type from the payload
          let sensorType = null;
          if (payload.temhumData) {
            sensorType = payload.temhumData.sensor === 'temhum1' ? 'TEMHUM1' : 'TEMHUM2';
          } else if (payload.waterQualityData) {
            sensorType = 'CALIDAD_AGUA';
          } else if (payload.waterTemperatureData) {
            sensorType = 'CALIDAD_AGUA';
          } else if (payload.lightData) {
            sensorType = 'LUXOMETRO';
          } else if (payload.powerData) {
            sensorType = 'POWER_MONITOR';
          }

          // Check if this sensor type is in the filter
          return sensorType && variables.sensorTypes.includes(sensorType);
        } catch (error) {
          console.error('[SensorSubscription] Error in subscription filter:', error);
          return false;
        }
      }
    ),
    resolve: (payload, args, context) => {
      try {
        console.log('[SensorSubscription] Resolving sensor data update', {
          eventType: Object.keys(payload)[0],
          user: context.user?.username
        });

        // Transform the payload to match SensorReading type
        if (payload.temhumData) {
          const data = payload.temhumData;
          return {
            id: `${data.sensor}_${Date.now()}`,
            sensorId: data.sensor,
            timestamp: data.received_at,
            temperatura: data.temperatura,
            humedad: data.humedad,
            heatIndex: data.heatindex,
            dewPoint: data.dewpoint,
            rssi: data.rssi,
            rawData: { sensor: data.sensor }
          };
        } else if (payload.waterQualityData) {
          const data = payload.waterQualityData;
          return {
            id: `calidad_agua_${Date.now()}`,
            sensorId: 'calidad_agua',
            timestamp: data.received_at,
            ph: data.ph,
            ec: data.ec,
            ppm: data.ppm,
            temperaturaAgua: data.temperatura_agua,
            rawData: { type: 'water_quality' }
          };
        } else if (payload.waterTemperatureData) {
          const data = payload.waterTemperatureData;
          return {
            id: `calidad_agua_temp_${Date.now()}`,
            sensorId: 'calidad_agua',
            timestamp: data.received_at,
            temperaturaAgua: data.temperatura_agua,
            rawData: { type: 'water_temperature' }
          };
        } else if (payload.lightData) {
          const data = payload.lightData;
          return {
            id: `luxometro_${Date.now()}`,
            sensorId: 'luxometro',
            timestamp: data.received_at,
            light: data.light,
            whiteLight: data.white_light,
            rawLight: data.raw_light,
            rssi: data.rssi,
            rawData: { type: 'light_sensor' }
          };
        } else if (payload.powerData) {
          const data = payload.powerData;
          return {
            id: `power_${data.device_hardware_id}_${Date.now()}`,
            sensorId: `power_${data.device_hardware_id}`,
            timestamp: data.received_at,
            watts: data.watts,
            voltage: data.voltage,
            current: data.current,
            rawData: {
              deviceId: data.device_id,
              hardwareId: data.device_hardware_id
            }
          };
        }

        return null;
      } catch (error) {
        console.error('[SensorSubscription] Error resolving sensor data update:', error);
        return null;
      }
    }
  },

  /**
   * Subscribe to sensor status changes
   * This would be triggered when sensors go online/offline
   */
  sensorStatusChanged: {
    subscribe: (parent, args, context) => {
      console.log('[SensorSubscription] Client subscribing to sensor status changes', {
        user: context.user?.username
      });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to subscribe to sensor status changes');
      }

      // For now, we'll use a placeholder event
      // In a real implementation, this could be triggered by:
      // - MQTT connection/disconnection events
      // - Sensor heartbeat timeouts
      // - Device status changes
      return pubsub.asyncIterator(['SENSOR_STATUS_CHANGED']);
    },
    resolve: (payload, args, context) => {
      console.log('[SensorSubscription] Resolving sensor status change', {
        user: context.user?.username
      });
      
      return payload.sensorStatusChanged;
    }
  }
};

module.exports = sensorSubscriptions;