const { query } = require('../config/database');
const { cache } = require('../config/redis');
const { pubsub, SENSOR_EVENTS } = require('../utils/pubsub');
const mqttService = require('./mqttService');

/**
 * Sensor Service for GraphQL Backend
 * Handles sensor data queries, statistics, and real-time updates
 * Integrates with MQTT service and database for complete sensor management
 */
class SensorService {
  constructor() {
    this.sensorTypes = {
      TEMHUM1: 'temhum1',
      TEMHUM2: 'temhum2',
      CALIDAD_AGUA: 'calidad_agua',
      LUXOMETRO: 'luxometro',
      POWER_MONITOR: 'power_monitor_logs'
    };
  }

  /**
   * Get all sensors with optional filtering
   * @param {Object} filters - Filter options
   * @returns {Array} List of sensors
   */
  async getSensors(filters = {}) {
    console.log('[SensorService] Getting sensors with filters:', filters);
    
    try {
      // For this IoT system, sensors are not stored as separate entities
      // but are represented by the actual data tables and latest data
      const sensors = [];
      
      const sensorConfigs = [
        {
          id: 'temhum1',
          name: 'Sensor Temperatura/Humedad 1',
          type: 'TEMHUM1',
          location: 'Invernadero Principal - Zona A',
          description: 'Sensor de temperatura y humedad ambiente principal'
        },
        {
          id: 'temhum2', 
          name: 'Sensor Temperatura/Humedad 2',
          type: 'TEMHUM2',
          location: 'Invernadero Principal - Zona B',
          description: 'Sensor de temperatura y humedad ambiente secundario'
        },
        {
          id: 'calidad_agua',
          name: 'Sensor Calidad del Agua',
          type: 'CALIDAD_AGUA',
          location: 'Sistema de Riego',
          description: 'Sensor de pH, conductividad eléctrica y temperatura del agua'
        },
        {
          id: 'luxometro',
          name: 'Luxómetro - Sensor de Luz',
          type: 'LUXOMETRO',
          location: 'Invernadero Principal',
          description: 'Sensor de intensidad lumínica ambiente, luz blanca y valores raw'
        }
      ];

      // Get power monitor sensors from database
      const powerSensors = await query(
        "SELECT id, name, device_id, configuration FROM devices WHERE type = 'power_sensor'"
      );

      // Add power sensors to the list
      for (const powerSensor of powerSensors.rows) {
        sensorConfigs.push({
          id: `power_${powerSensor.device_id}`,
          name: powerSensor.name || `Power Monitor ${powerSensor.device_id}`,
          type: 'POWER_MONITOR',
          location: 'Dispositivos Monitoreados',
          description: `Monitor de consumo eléctrico para ${powerSensor.configuration?.monitors_device_id || 'dispositivo'}`,
          deviceId: powerSensor.device_id,
          dbId: powerSensor.id
        });
      }

      // Apply filters and get latest data for each sensor
      for (const config of sensorConfigs) {
        if (filters.types && !filters.types.includes(config.type)) {
          continue;
        }

        // Get latest data to determine if sensor is online
        const latestData = await this.getLatestSensorData(config.type, config.deviceId);
        const isOnline = latestData ? this.isSensorOnline(latestData.last_updated) : false;

        if (filters.online !== undefined && filters.online !== isOnline) {
          continue;
        }

        const sensor = {
          ...config,
          isOnline,
          lastSeen: latestData?.last_updated || null,
          createdAt: new Date().toISOString(), // Placeholder
          updatedAt: latestData?.last_updated || new Date().toISOString()
        };

        sensors.push(sensor);
      }

      console.log(`[SensorService] Found ${sensors.length} sensors`);
      return sensors;
    } catch (error) {
      console.error('[SensorService] Error getting sensors:', error);
      throw error;
    }
  }

  /**
   * Get sensor by ID
   * @param {string} id - Sensor ID
   * @returns {Object} Sensor data
   */
  async getSensorById(id) {
    console.log(`[SensorService] Getting sensor by ID: ${id}`);
    
    try {
      const sensors = await this.getSensors();
      const sensor = sensors.find(s => s.id === id);
      
      if (!sensor) {
        throw new Error(`Sensor with ID ${id} not found`);
      }

      return sensor;
    } catch (error) {
      console.error(`[SensorService] Error getting sensor ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get sensor readings with pagination
   * @param {string} sensorId - Sensor ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated sensor readings
   */
  async getSensorReadings(sensorId, options = {}) {
    const { limit = 100, offset = 0, from, to } = options;
    console.log(`[SensorService] Getting readings for sensor ${sensorId}`, options);

    try {
      let tableName, conditions = [], values = [], paramCount = 1;

      // Determine table and build query based on sensor type
      if (sensorId === 'temhum1' || sensorId === 'temhum2') {
        tableName = sensorId;
        
        if (from) {
          conditions.push(`received_at >= $${paramCount++}`);
          values.push(from);
        }
        if (to) {
          conditions.push(`received_at <= $${paramCount++}`);
          values.push(to);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const countQuery = `SELECT COUNT(*) FROM ${tableName} ${whereClause}`;
        const dataQuery = `
          SELECT id, temperatura, humedad, heatindex, dewpoint, rssi, boot, mem, 
                 tmin, tmax, tavg, hmin, hmax, havg, total, errors, received_at
          FROM ${tableName} ${whereClause}
          ORDER BY received_at DESC
          LIMIT $${paramCount++} OFFSET $${paramCount++}
        `;

        values.push(limit, offset);

        const [countResult, dataResult] = await Promise.all([
          query(countQuery, values.slice(0, -2)), // Remove limit/offset for count
          query(dataQuery, values)
        ]);

        const totalCount = parseInt(countResult.rows[0].count);
        const readings = dataResult.rows.map(row => ({
          id: `${sensorId}_${row.id}`,
          sensorId,
          timestamp: row.received_at,
          temperatura: row.temperatura,
          humedad: row.humedad,
          heatIndex: row.heatindex,
          dewPoint: row.dewpoint,
          rssi: row.rssi,
          memoryUsage: row.mem,
          bootCount: row.boot,
          errorCount: row.errors,
          rawData: {
            stats: {
              tmin: row.tmin,
              tmax: row.tmax,
              tavg: row.tavg,
              hmin: row.hmin,
              hmax: row.hmax,
              havg: row.havg,
              total: row.total,
              errors: row.errors
            }
          }
        }));

        return this.buildPaginatedResponse(readings, totalCount, limit, offset);

      } else if (sensorId === 'calidad_agua') {
        tableName = 'calidad_agua';
        
        if (from) {
          conditions.push(`received_at >= $${paramCount++}`);
          values.push(from);
        }
        if (to) {
          conditions.push(`received_at <= $${paramCount++}`);
          values.push(to);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const countQuery = `SELECT COUNT(*) FROM ${tableName} ${whereClause}`;
        const dataQuery = `
          SELECT id, ph, ec, ppm, temperatura_agua, rssi, boot, mem, received_at
          FROM ${tableName} ${whereClause}
          ORDER BY received_at DESC
          LIMIT $${paramCount++} OFFSET $${paramCount++}
        `;

        values.push(limit, offset);

        const [countResult, dataResult] = await Promise.all([
          query(countQuery, values.slice(0, -2)),
          query(dataQuery, values)
        ]);

        const totalCount = parseInt(countResult.rows[0].count);
        const readings = dataResult.rows.map(row => ({
          id: `calidad_agua_${row.id}`,
          sensorId,
          timestamp: row.received_at,
          ph: row.ph,
          ec: row.ec,
          ppm: row.ppm,
          temperaturaAgua: row.temperatura_agua,
          rssi: row.rssi,
          memoryUsage: row.mem,
          bootCount: row.boot,
          rawData: {}
        }));

        return this.buildPaginatedResponse(readings, totalCount, limit, offset);

      } else if (sensorId === 'luxometro') {
        tableName = 'luxometro';
        
        if (from) {
          conditions.push(`received_at >= $${paramCount++}`);
          values.push(from);
        }
        if (to) {
          conditions.push(`received_at <= $${paramCount++}`);
          values.push(to);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const countQuery = `SELECT COUNT(*) FROM ${tableName} ${whereClause}`;
        const dataQuery = `
          SELECT id, light, white_light, raw_light, rssi, boot, mem, 
                 lmin, lmax, lavg, wmin, wmax, wavg, total, errors, received_at
          FROM ${tableName} ${whereClause}
          ORDER BY received_at DESC
          LIMIT $${paramCount++} OFFSET $${paramCount++}
        `;

        values.push(limit, offset);

        const [countResult, dataResult] = await Promise.all([
          query(countQuery, values.slice(0, -2)),
          query(dataQuery, values)
        ]);

        const totalCount = parseInt(countResult.rows[0].count);
        const readings = dataResult.rows.map(row => ({
          id: `luxometro_${row.id}`,
          sensorId,
          timestamp: row.received_at,
          light: row.light,
          whiteLight: row.white_light,
          rawLight: row.raw_light,
          rssi: row.rssi,
          memoryUsage: row.mem,
          bootCount: row.boot,
          errorCount: row.errors,
          rawData: {
            stats: {
              lmin: row.lmin,
              lmax: row.lmax,
              lavg: row.lavg,
              wmin: row.wmin,
              wmax: row.wmax,
              wavg: row.wavg,
              total: row.total,
              errors: row.errors
            }
          }
        }));

        return this.buildPaginatedResponse(readings, totalCount, limit, offset);

      } else if (sensorId.startsWith('power_')) {
        const deviceId = sensorId.replace('power_', '');
        tableName = 'power_monitor_logs';
        
        conditions.push(`device_hardware_id = $${paramCount++}`);
        values.push(deviceId);

        if (from) {
          conditions.push(`received_at >= $${paramCount++}`);
          values.push(from);
        }
        if (to) {
          conditions.push(`received_at <= $${paramCount++}`);
          values.push(to);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        const countQuery = `SELECT COUNT(*) FROM ${tableName} ${whereClause}`;
        const dataQuery = `
          SELECT id, device_hardware_id, watts, voltage, current, frequency, power_factor, 
                 rssi, mem, boot, received_at, device_id
          FROM ${tableName} ${whereClause}
          ORDER BY received_at DESC
          LIMIT $${paramCount++} OFFSET $${paramCount++}
        `;

        values.push(limit, offset);

        const [countResult, dataResult] = await Promise.all([
          query(countQuery, values.slice(0, -2)),
          query(dataQuery, values)
        ]);

        const totalCount = parseInt(countResult.rows[0].count);
        const readings = dataResult.rows.map(row => ({
          id: `power_${row.id}`,
          sensorId,
          timestamp: row.received_at,
          watts: row.watts,
          voltage: row.voltage,
          current: row.current,
          frequency: row.frequency,
          powerFactor: row.power_factor,
          rssi: row.rssi,
          memoryUsage: row.mem,
          bootCount: row.boot,
          rawData: {
            deviceId: row.device_id,
            hardwareId: row.device_hardware_id
          }
        }));

        return this.buildPaginatedResponse(readings, totalCount, limit, offset);
      }

      throw new Error(`Unsupported sensor type for ID: ${sensorId}`);

    } catch (error) {
      console.error(`[SensorService] Error getting readings for sensor ${sensorId}:`, error);
      throw error;
    }
  }

  /**
   * Get latest sensor data for all specified types or single type
   * @param {Array|string} types - Sensor types to get data for, or single sensor type
   * @param {string} deviceId - Device ID for power sensors
   * @returns {Array|Object} Latest sensor readings or single reading
   */
  async getLatestSensorData(types = [], deviceId = null) {
    // Handle single sensor type queries (for backward compatibility)
    if (typeof types === 'string') {
      const singleType = types;
      types = [singleType.toUpperCase()];
      
      // For single type queries, return the data object directly
      if (singleType === 'temhum1') {
        return await cache.hgetall('sensor_latest:temhum1');
      } else if (singleType === 'temhum2') {
        return await cache.hgetall('sensor_latest:temhum2');
      } else if (singleType === 'calidad_agua') {
        return await cache.hgetall('sensor_latest:calidad_agua');
      } else if (singleType === 'luxometro') {
        return await cache.hgetall('sensor_latest:luxometro');
      } else if (singleType === 'power' && deviceId) {
        return await cache.hgetall(`sensor_latest:power:${deviceId}`);
      }
      return null;
    }
    console.log('[SensorService] Getting latest sensor data for types:', types);
    
    try {
      const latestReadings = [];

      for (const type of types) {
        let data;
        
        switch (type) {
          case 'TEMHUM1':
            data = await mqttService.getLatestData('temhum1');
            if (data) {
              latestReadings.push({
                id: `temhum1_latest`,
                sensorId: 'temhum1',
                timestamp: data.last_updated,
                temperatura: parseFloat(data.temperatura),
                humedad: parseFloat(data.humedad),
                heatIndex: data.heatindex ? parseFloat(data.heatindex) : null,
                dewPoint: data.dewpoint ? parseFloat(data.dewpoint) : null,
                rssi: data.rssi ? parseInt(data.rssi) : null
              });
            }
            break;

          case 'TEMHUM2':
            data = await mqttService.getLatestData('temhum2');
            if (data) {
              latestReadings.push({
                id: `temhum2_latest`,
                sensorId: 'temhum2',
                timestamp: data.last_updated,
                temperatura: parseFloat(data.temperatura),
                humedad: parseFloat(data.humedad),
                heatIndex: data.heatindex ? parseFloat(data.heatindex) : null,
                dewPoint: data.dewpoint ? parseFloat(data.dewpoint) : null,
                rssi: data.rssi ? parseInt(data.rssi) : null
              });
            }
            break;

          case 'CALIDAD_AGUA':
            data = await mqttService.getLatestData('calidad_agua');
            if (data) {
              latestReadings.push({
                id: `calidad_agua_latest`,
                sensorId: 'calidad_agua',
                timestamp: data.last_updated_multiparam || data.last_updated_temp_agua,
                ph: data.ph ? parseFloat(data.ph) : null,
                ec: data.ec ? parseFloat(data.ec) : null,
                ppm: data.ppm ? parseFloat(data.ppm) : null,
                temperaturaAgua: data.temperatura_agua ? parseFloat(data.temperatura_agua) : null
              });
            }
            break;

          case 'LUXOMETRO':
            data = await mqttService.getLatestData('luxometro');
            if (data) {
              latestReadings.push({
                id: `luxometro_latest`,
                sensorId: 'luxometro',
                timestamp: data.last_updated,
                light: data.light ? parseFloat(data.light) : null,
                whiteLight: data.white_light ? parseFloat(data.white_light) : null,
                rawLight: data.raw_light ? parseFloat(data.raw_light) : null,
                rssi: data.rssi ? parseInt(data.rssi) : null
              });
            }
            break;

          case 'POWER_MONITOR':
            // Get all power sensors
            const powerSensors = await query(
              "SELECT device_id FROM devices WHERE type = 'power_sensor'"
            );
            
            for (const sensor of powerSensors.rows) {
              data = await mqttService.getLatestData('power', sensor.device_id);
              if (data) {
                latestReadings.push({
                  id: `power_${sensor.device_id}_latest`,
                  sensorId: `power_${sensor.device_id}`,
                  timestamp: data.last_updated,
                  watts: data.watts ? parseFloat(data.watts) : null,
                  voltage: data.voltage ? parseFloat(data.voltage) : null,
                  current: data.current ? parseFloat(data.current) : null,
                  frequency: data.frequency ? parseFloat(data.frequency) : null,
                  powerFactor: data.power_factor ? parseFloat(data.power_factor) : null
                });
              }
            }
            break;
        }
      }

      console.log(`[SensorService] Found ${latestReadings.length} latest readings`);
      return latestReadings;
    } catch (error) {
      console.error('[SensorService] Error getting latest sensor data:', error);
      throw error;
    }
  }

  /**
   * Get sensor statistics for a time range
   * @param {string} sensorId - Sensor ID
   * @param {Object} timeRange - Time range
   * @returns {Object} Sensor statistics
   */
  async getSensorStats(sensorId, timeRange) {
    console.log(`[SensorService] Getting stats for sensor ${sensorId}`, timeRange);
    
    try {
      const { from, to } = timeRange;
      let tableName, statsQuery, conditions = [], values = [], paramCount = 1;

      if (sensorId === 'temhum1' || sensorId === 'temhum2') {
        tableName = sensorId;
        
        if (from) {
          conditions.push(`received_at >= $${paramCount++}`);
          values.push(from);
        }
        if (to) {
          conditions.push(`received_at <= $${paramCount++}`);
          values.push(to);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        statsQuery = `
          SELECT 
            COUNT(*) as total_readings,
            COUNT(CASE WHEN temperatura IS NOT NULL AND humedad IS NOT NULL THEN 1 END) as valid_readings,
            SUM(errors) as error_readings,
            MIN(temperatura) as temp_min,
            MAX(temperatura) as temp_max,
            AVG(temperatura) as temp_avg,
            STDDEV(temperatura) as temp_stddev,
            MIN(humedad) as hum_min,
            MAX(humedad) as hum_max,
            AVG(humedad) as hum_avg,
            STDDEV(humedad) as hum_stddev,
            MIN(received_at) as first_reading,
            MAX(received_at) as last_reading
          FROM ${tableName} ${whereClause}
        `;

        const result = await query(statsQuery, values);
        const stats = result.rows[0];

        const totalReadings = parseInt(stats.total_readings);
        const validReadings = parseInt(stats.valid_readings);
        const errorReadings = parseInt(stats.error_readings) || 0;

        return {
          sensorId,
          timeRange: { from, to },
          totalReadings,
          validReadings,
          errorReadings,
          dataQualityPercent: totalReadings > 0 ? (validReadings / totalReadings) * 100 : 0,
          uptimePercent: this.calculateUptimePercent(stats.first_reading, stats.last_reading, from, to),
          lastOnlineTime: stats.last_reading,
          averageInterval: this.calculateAverageInterval(stats.first_reading, stats.last_reading, totalReadings),
          temperaturaStats: {
            min: parseFloat(stats.temp_min) || 0,
            max: parseFloat(stats.temp_max) || 0,
            avg: parseFloat(stats.temp_avg) || 0,
            stdDev: parseFloat(stats.temp_stddev) || 0,
            count: validReadings,
            trend: 'STABLE'
          },
          humedadStats: {
            min: parseFloat(stats.hum_min) || 0,
            max: parseFloat(stats.hum_max) || 0,
            avg: parseFloat(stats.hum_avg) || 0,
            stdDev: parseFloat(stats.hum_stddev) || 0,
            count: validReadings,
            trend: 'STABLE'
          }
        };

      } else if (sensorId === 'calidad_agua') {
        tableName = 'calidad_agua';
        
        if (from) {
          conditions.push(`received_at >= $${paramCount++}`);
          values.push(from);
        }
        if (to) {
          conditions.push(`received_at <= $${paramCount++}`);
          values.push(to);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        statsQuery = `
          SELECT 
            COUNT(*) as total_readings,
            COUNT(CASE WHEN ph IS NOT NULL AND ec IS NOT NULL AND ppm IS NOT NULL THEN 1 END) as valid_readings,
            MIN(ph) as ph_min,
            MAX(ph) as ph_max,
            AVG(ph) as ph_avg,
            STDDEV(ph) as ph_stddev,
            MIN(ec) as ec_min,
            MAX(ec) as ec_max,
            AVG(ec) as ec_avg,
            STDDEV(ec) as ec_stddev,
            MIN(ppm) as ppm_min,
            MAX(ppm) as ppm_max,
            AVG(ppm) as ppm_avg,
            STDDEV(ppm) as ppm_stddev,
            MIN(received_at) as first_reading,
            MAX(received_at) as last_reading
          FROM ${tableName} ${whereClause}
        `;

        const result = await query(statsQuery, values);
        const stats = result.rows[0];

        const totalReadings = parseInt(stats.total_readings);
        const validReadings = parseInt(stats.valid_readings);

        return {
          sensorId,
          timeRange: { from, to },
          totalReadings,
          validReadings,
          errorReadings: 0,
          dataQualityPercent: totalReadings > 0 ? (validReadings / totalReadings) * 100 : 0,
          uptimePercent: this.calculateUptimePercent(stats.first_reading, stats.last_reading, from, to),
          lastOnlineTime: stats.last_reading,
          averageInterval: this.calculateAverageInterval(stats.first_reading, stats.last_reading, totalReadings),
          phStats: {
            min: parseFloat(stats.ph_min) || 0,
            max: parseFloat(stats.ph_max) || 0,
            avg: parseFloat(stats.ph_avg) || 0,
            stdDev: parseFloat(stats.ph_stddev) || 0,
            count: validReadings,
            trend: 'STABLE'
          },
          ecStats: {
            min: parseFloat(stats.ec_min) || 0,
            max: parseFloat(stats.ec_max) || 0,
            avg: parseFloat(stats.ec_avg) || 0,
            stdDev: parseFloat(stats.ec_stddev) || 0,
            count: validReadings,
            trend: 'STABLE'
          },
          ppmStats: {
            min: parseFloat(stats.ppm_min) || 0,
            max: parseFloat(stats.ppm_max) || 0,
            avg: parseFloat(stats.ppm_avg) || 0,
            stdDev: parseFloat(stats.ppm_stddev) || 0,
            count: validReadings,
            trend: 'STABLE'
          }
        };

      } else if (sensorId === 'luxometro') {
        tableName = 'luxometro';
        
        if (from) {
          conditions.push(`received_at >= $${paramCount++}`);
          values.push(from);
        }
        if (to) {
          conditions.push(`received_at <= $${paramCount++}`);
          values.push(to);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        statsQuery = `
          SELECT 
            COUNT(*) as total_readings,
            COUNT(CASE WHEN light IS NOT NULL AND white_light IS NOT NULL THEN 1 END) as valid_readings,
            SUM(errors) as error_readings,
            MIN(light) as light_min,
            MAX(light) as light_max,
            AVG(light) as light_avg,
            STDDEV(light) as light_stddev,
            MIN(white_light) as white_min,
            MAX(white_light) as white_max,
            AVG(white_light) as white_avg,
            STDDEV(white_light) as white_stddev,
            MIN(raw_light) as raw_min,
            MAX(raw_light) as raw_max,
            AVG(raw_light) as raw_avg,
            STDDEV(raw_light) as raw_stddev,
            MIN(received_at) as first_reading,
            MAX(received_at) as last_reading
          FROM ${tableName} ${whereClause}
        `;

        const result = await query(statsQuery, values);
        const stats = result.rows[0];

        const totalReadings = parseInt(stats.total_readings);
        const validReadings = parseInt(stats.valid_readings);
        const errorReadings = parseInt(stats.error_readings) || 0;

        return {
          sensorId,
          timeRange: { from, to },
          totalReadings,
          validReadings,
          errorReadings,
          dataQualityPercent: totalReadings > 0 ? (validReadings / totalReadings) * 100 : 0,
          uptimePercent: this.calculateUptimePercent(stats.first_reading, stats.last_reading, from, to),
          lastOnlineTime: stats.last_reading,
          averageInterval: this.calculateAverageInterval(stats.first_reading, stats.last_reading, totalReadings),
          lightStats: {
            min: parseFloat(stats.light_min) || 0,
            max: parseFloat(stats.light_max) || 0,
            avg: parseFloat(stats.light_avg) || 0,
            stdDev: parseFloat(stats.light_stddev) || 0,
            count: validReadings,
            trend: 'STABLE'
          },
          whiteLightStats: {
            min: parseFloat(stats.white_min) || 0,
            max: parseFloat(stats.white_max) || 0,
            avg: parseFloat(stats.white_avg) || 0,
            stdDev: parseFloat(stats.white_stddev) || 0,
            count: validReadings,
            trend: 'STABLE'
          },
          rawLightStats: {
            min: parseFloat(stats.raw_min) || 0,
            max: parseFloat(stats.raw_max) || 0,
            avg: parseFloat(stats.raw_avg) || 0,
            stdDev: parseFloat(stats.raw_stddev) || 0,
            count: validReadings,
            trend: 'STABLE'
          }
        };
      }

      throw new Error(`Statistics not supported for sensor: ${sensorId}`);

    } catch (error) {
      console.error(`[SensorService] Error getting stats for sensor ${sensorId}:`, error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  
  isSensorOnline(lastUpdated) {
    if (!lastUpdated) return false;
    
    const lastUpdate = new Date(lastUpdated);
    const now = new Date();
    const diffMinutes = (now - lastUpdate) / (1000 * 60);
    
    // Consider sensor online if last update was within 30 minutes
    return diffMinutes <= 30;
  }

  calculateUptimePercent(firstReading, lastReading, from, to) {
    // Simplified uptime calculation
    if (!firstReading || !lastReading) return 0;
    
    const start = from ? new Date(from) : new Date(firstReading);
    const end = to ? new Date(to) : new Date(lastReading);
    const totalTime = end - start;
    const activeTime = new Date(lastReading) - new Date(firstReading);
    
    return totalTime > 0 ? Math.min((activeTime / totalTime) * 100, 100) : 0;
  }

  calculateAverageInterval(firstReading, lastReading, totalReadings) {
    if (!firstReading || !lastReading || totalReadings <= 1) return 0;
    
    const totalTime = new Date(lastReading) - new Date(firstReading);
    const totalSeconds = totalTime / 1000;
    
    return totalSeconds / (totalReadings - 1);
  }

  buildPaginatedResponse(data, totalCount, limit, offset) {
    const hasNextPage = offset + limit < totalCount;
    const hasPreviousPage = offset > 0;
    
    const edges = data.map((item, index) => ({
      cursor: Buffer.from(`${offset + index}`).toString('base64'),
      node: item
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage,
        startCursor: edges.length > 0 ? edges[0].cursor : null,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
      },
      totalCount
    };
  }
}

module.exports = new SensorService();