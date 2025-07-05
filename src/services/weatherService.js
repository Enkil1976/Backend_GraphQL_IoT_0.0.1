const axios = require('axios');
const pool = require('../config/database');
const { cache } = require('../config/redis');
const { pubsub, EVENTS } = require('../utils/pubsub');

class WeatherService {
  constructor() {
    this.apiKey = process.env.WEATHER_API_KEY;
    this.baseUrl = 'http://api.weatherapi.com/v1';
    this.location = process.env.WEATHER_LOCATION || 'las chilcas,Villarrica,Chile';
    
    if (!this.apiKey) {
      console.warn('[WeatherService] WEATHER_API_KEY not configured. Service disabled.');
    }
  }

  /**
   * Get current weather data from API
   * @param {string} location - Location (optional, uses default if not specified)
   * @returns {Promise<Object>} Current weather data
   */
  async getCurrentWeather(location = null) {
    if (!this.apiKey) {
      throw new Error('Weather API key not configured');
    }

    try {
      const searchLocation = location || this.location;
      const url = `${this.baseUrl}/current.json`;
      
      console.log(`[WeatherService] Fetching current weather for: ${searchLocation}`);
      
      const response = await axios.get(url, {
        params: {
          key: this.apiKey,
          q: searchLocation,
          aqi: 'yes',
          lang: 'es'
        },
        timeout: 10000
      });

      const data = response.data;
      
      // Format data according to GraphQL schema
      const weatherData = {
        id: `weather_${Date.now()}`,
        location: {
          name: data.location.name,
          region: data.location.region,
          country: data.location.country,
          latitude: data.location.lat,
          longitude: data.location.lon,
          timezone: data.location.tz_id,
          localTime: new Date(data.location.localtime)
        },
        temperatura: data.current.temp_c,
        humedad: data.current.humidity,
        sensacionTermica: data.current.feelslike_c,
        puntoRocio: this.calculateDewPoint(data.current.temp_c, data.current.humidity),
        presion: data.current.pressure_mb,
        velocidadViento: data.current.wind_kph,
        direccionViento: data.current.wind_dir,
        rafagasViento: data.current.gust_kph || 0,
        visibilidad: data.current.vis_km,
        uvIndex: data.current.uv,
        condicion: data.current.condition.text,
        iconCode: data.current.condition.icon,
        pm25: data.current.air_quality?.pm2_5 || null,
        pm10: data.current.air_quality?.pm10 || null,
        receivedAt: new Date(),
        localTime: new Date(data.location.localtime),
        source: 'WeatherAPI.com',
        rawData: data
      };

      // Cache in Redis
      await this.cacheWeatherData(weatherData);

      return weatherData;
    } catch (error) {
      console.error('[WeatherService] Error fetching current weather:', error.message);
      if (error.response) {
        console.error('[WeatherService] API Response:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Collect and save weather data to database
   * @param {string} location - Location (optional)
   * @returns {Promise<Object>} Collection result
   */
  async collectWeatherData(location = null) {
    try {
      const weatherData = await this.getCurrentWeather(location);
      const savedData = await this.saveWeatherToDB(weatherData);
      
      // Publish to subscribers
      await pubsub.publish(EVENTS.WEATHER_DATA_UPDATED, {
        weatherDataUpdated: { ...weatherData, id: savedData.id }
      });

      return {
        success: true,
        message: 'Weather data collected and saved successfully',
        data: { ...weatherData, id: savedData.id },
        errors: []
      };
    } catch (error) {
      console.error('[WeatherService] Error collecting weather data:', error.message);
      return {
        success: false,
        message: 'Failed to collect weather data',
        data: null,
        errors: [error.message]
      };
    }
  }

  /**
   * Save weather data to database
   * @param {Object} weatherData - Weather data to save
   * @returns {Promise<Object>} Saved record
   */
  async saveWeatherToDB(weatherData) {
    try {
      const query = `
        INSERT INTO weather_current (
          temperatura, humedad, sensacion_termica, punto_rocio,
          presion, velocidad_viento, direccion_viento, visibilidad,
          uv_index, condicion, icono, calidad_aire_pm2_5, calidad_aire_pm10,
          location_name, location_lat, location_lon, received_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id, received_at
      `;

      const values = [
        weatherData.temperatura,
        weatherData.humedad,
        weatherData.sensacionTermica,
        weatherData.puntoRocio,
        weatherData.presion,
        weatherData.velocidadViento,
        weatherData.direccionViento,
        weatherData.visibilidad,
        weatherData.uvIndex,
        weatherData.condicion,
        weatherData.iconCode,
        weatherData.pm25,
        weatherData.pm10,
        weatherData.location.name,
        weatherData.location.latitude,
        weatherData.location.longitude,
        weatherData.receivedAt
      ];

      const result = await pool.query(query, values);
      console.log(`[WeatherService] Weather data saved to DB with ID: ${result.rows[0].id}`);
      return result.rows[0];
    } catch (error) {
      console.error('[WeatherService] Error saving weather data to DB:', error.message);
      throw error;
    }
  }

  /**
   * Get latest weather data from database
   * @param {number} limit - Number of records
   * @returns {Promise<Array>} Latest weather records
   */
  async getLatestWeather(limit = 1) {
    try {
      const query = `
        SELECT 
          id, temperatura, humedad, sensacion_termica, punto_rocio,
          presion, velocidad_viento, direccion_viento, visibilidad,
          uv_index, condicion, icono, calidad_aire_pm2_5, calidad_aire_pm10,
          location_name, location_lat, location_lon, received_at
        FROM weather_current 
        ORDER BY received_at DESC
        LIMIT $1
      `;

      const result = await pool.query(query, [limit]);
      return result.rows.map(row => this.formatDatabaseRecord(row));
    } catch (error) {
      console.error('[WeatherService] Error getting latest weather from DB:', error.message);
      throw error;
    }
  }

  /**
   * Get weather history with pagination
   * @param {number} hours - Hours to look back
   * @param {number} limit - Records per page
   * @param {number} page - Page number
   * @returns {Promise<Object>} Weather history connection
   */
  async getWeatherHistory(hours = 24, limit = 100, page = 1) {
    try {
      const offset = (page - 1) * limit;
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM weather_current 
        WHERE received_at >= NOW() - INTERVAL '${hours} hours'
      `;
      const countResult = await pool.query(countQuery);
      const totalCount = parseInt(countResult.rows[0].total);

      // Get data
      const query = `
        SELECT 
          id, temperatura, humedad, sensacion_termica, punto_rocio,
          presion, velocidad_viento, direccion_viento, visibilidad,
          uv_index, condicion, icono, calidad_aire_pm2_5, calidad_aire_pm10,
          location_name, location_lat, location_lon, received_at
        FROM weather_current 
        WHERE received_at >= NOW() - INTERVAL '${hours} hours'
        ORDER BY received_at DESC
        LIMIT $1 OFFSET $2
      `;

      const result = await pool.query(query, [limit, offset]);
      const records = result.rows.map(row => this.formatDatabaseRecord(row));

      return {
        edges: records.map((record, index) => ({
          cursor: Buffer.from(`${offset + index}`).toString('base64'),
          node: record
        })),
        pageInfo: {
          hasNextPage: (offset + limit) < totalCount,
          hasPreviousPage: page > 1,
          startCursor: records.length > 0 ? Buffer.from(`${offset}`).toString('base64') : null,
          endCursor: records.length > 0 ? Buffer.from(`${offset + records.length - 1}`).toString('base64') : null
        },
        totalCount,
        pagination: {
          page,
          limit,
          hours
        }
      };
    } catch (error) {
      console.error('[WeatherService] Error getting weather history:', error.message);
      throw error;
    }
  }

  /**
   * Get weather data formatted for charts
   * @param {number} hours - Hours to look back
   * @returns {Promise<Array>} Chart data
   */
  async getWeatherChartData(hours = 24) {
    try {
      const query = `
        SELECT 
          id, temperatura, humedad, sensacion_termica, punto_rocio,
          presion, velocidad_viento, uv_index, condicion, received_at
        FROM weather_current 
        WHERE received_at >= NOW() - INTERVAL '${hours} hours'
        ORDER BY received_at ASC
      `;

      const result = await pool.query(query);
      return result.rows.map(record => ({
        id: record.id,
        temperatura: record.temperatura,
        humedad: record.humedad,
        sensacionTermica: record.sensacion_termica,
        puntoRocio: record.punto_rocio,
        presion: record.presion,
        velocidadViento: record.velocidad_viento,
        uvIndex: record.uv_index,
        condicion: record.condicion,
        receivedAt: record.received_at,
        time: record.received_at,
        chileTime: record.received_at
      }));
    } catch (error) {
      console.error('[WeatherService] Error getting weather chart data:', error.message);
      throw error;
    }
  }

  /**
   * Get weather statistics
   * @param {number} days - Days to analyze
   * @returns {Promise<Object>} Weather statistics
   */
  async getWeatherStats(days = 7) {
    try {
      const query = `
        SELECT 
          DATE(received_at) as fecha,
          COUNT(*) as total,
          AVG(temperatura) as avg_temp,
          MIN(temperatura) as min_temp,
          MAX(temperatura) as max_temp,
          AVG(humedad) as avg_humidity,
          MIN(humedad) as min_humidity,
          MAX(humedad) as max_humidity,
          AVG(sensacion_termica) as avg_feels_like,
          MIN(sensacion_termica) as min_feels_like,
          MAX(sensacion_termica) as max_feels_like,
          AVG(presion) as avg_pressure,
          MIN(presion) as min_pressure,
          MAX(presion) as max_pressure,
          AVG(velocidad_viento) as avg_wind_speed,
          MAX(velocidad_viento) as max_wind_speed,
          AVG(uv_index) as avg_uv_index,
          MAX(uv_index) as max_uv_index,
          MODE() WITHIN GROUP (ORDER BY condicion) as most_common_condition
        FROM weather_current
        WHERE received_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(received_at)
        ORDER BY fecha DESC
      `;

      const result = await pool.query(query);
      const dailyStats = result.rows.map(day => ({
        fecha: day.fecha,
        total: day.total,
        temperatura: {
          promedio: parseFloat(day.avg_temp || 0),
          minimo: parseFloat(day.min_temp || 0),
          maximo: parseFloat(day.max_temp || 0)
        },
        humedad: {
          promedio: parseFloat(day.avg_humidity || 0),
          minimo: parseFloat(day.min_humidity || 0),
          maximo: parseFloat(day.max_humidity || 0)
        },
        sensacionTermica: {
          promedio: parseFloat(day.avg_feels_like || 0),
          minimo: parseFloat(day.min_feels_like || 0),
          maximo: parseFloat(day.max_feels_like || 0)
        },
        presion: {
          promedio: parseFloat(day.avg_pressure || 0),
          minimo: parseFloat(day.min_pressure || 0),
          maximo: parseFloat(day.max_pressure || 0)
        },
        viento: {
          velocidadPromedio: parseFloat(day.avg_wind_speed || 0),
          velocidadMaxima: parseFloat(day.max_wind_speed || 0),
          direccionPredominante: null
        },
        uvIndex: {
          promedio: parseFloat(day.avg_uv_index || 0),
          minimo: parseFloat(day.avg_uv_index || 0),
          maximo: parseFloat(day.max_uv_index || 0)
        }
      }));

      // Calculate overall statistics
      const overallQuery = `
        SELECT 
          COUNT(*) as total_readings,
          AVG(temperatura) as avg_temp,
          MIN(temperatura) as min_temp,
          MAX(temperatura) as max_temp,
          AVG(humedad) as avg_humidity,
          MIN(humedad) as min_humidity,
          MAX(humedad) as max_humidity,
          AVG(presion) as avg_pressure,
          MIN(presion) as min_pressure,
          MAX(presion) as max_pressure,
          AVG(velocidad_viento) as avg_wind_speed,
          MAX(velocidad_viento) as max_wind_speed,
          AVG(uv_index) as avg_uv_index,
          MAX(uv_index) as max_uv_index,
          MODE() WITHIN GROUP (ORDER BY condicion) as most_common_condition,
          COUNT(DISTINCT DATE(received_at)) as days_with_data
        FROM weather_current
        WHERE received_at >= NOW() - INTERVAL '${days} days'
      `;

      const overallResult = await pool.query(overallQuery);
      const overall = overallResult.rows[0];

      const overallStats = {
        temperatura: {
          promedio: parseFloat(overall.avg_temp || 0),
          minimo: parseFloat(overall.min_temp || 0),
          maximo: parseFloat(overall.max_temp || 0)
        },
        humedad: {
          promedio: parseFloat(overall.avg_humidity || 0),
          minimo: parseFloat(overall.min_humidity || 0),
          maximo: parseFloat(overall.max_humidity || 0)
        },
        presion: {
          promedio: parseFloat(overall.avg_pressure || 0),
          minimo: parseFloat(overall.min_pressure || 0),
          maximo: parseFloat(overall.max_pressure || 0)
        },
        viento: {
          velocidadPromedio: parseFloat(overall.avg_wind_speed || 0),
          velocidadMaxima: parseFloat(overall.max_wind_speed || 0),
          direccionPredominante: null
        },
        uvIndex: {
          promedio: parseFloat(overall.avg_uv_index || 0),
          minimo: parseFloat(overall.avg_uv_index || 0),
          maximo: parseFloat(overall.max_uv_index || 0)
        },
        condicionMasFrequente: overall.most_common_condition || 'N/A',
        diasConDatos: parseInt(overall.days_with_data || 0)
      };

      return {
        period: `${days} days`,
        totalReadings: parseInt(overall.total_readings || 0),
        dailyStats,
        overallStats
      };
    } catch (error) {
      console.error('[WeatherService] Error getting weather statistics:', error.message);
      throw error;
    }
  }

  /**
   * Get weather service configuration
   * @returns {Object} Configuration info
   */
  getWeatherConfig() {
    return {
      isConfigured: this.isConfigured(),
      hasApiKey: !!this.apiKey,
      currentLocation: this.location,
      defaultLocation: process.env.WEATHER_LOCATION || 'las chilcas,Villarrica,Chile',
      apiProvider: 'WeatherAPI.com',
      collectionInterval: 60, // minutes
      lastUpdated: new Date(),
      status: {
        isActive: this.isConfigured(),
        lastCheck: new Date(),
        lastError: null,
        apiCallsToday: 0,
        apiLimitReached: false
      }
    };
  }

  /**
   * Update weather service configuration
   * @param {Object} input - Configuration input
   * @returns {Promise<Object>} Update result
   */
  async updateWeatherConfig(input) {
    try {
      const { location } = input;
      
      // Test the location first
      await this.getCurrentWeather(location);
      
      // Update if test successful
      this.updateLocation(location);
      
      const updatedConfig = this.getWeatherConfig();
      
      // Publish config change
      await pubsub.publish(EVENTS.WEATHER_CONFIG_CHANGED, {
        weatherConfigChanged: updatedConfig
      });

      return {
        success: true,
        message: 'Weather service location updated successfully',
        config: updatedConfig,
        errors: []
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update weather configuration',
        config: this.getWeatherConfig(),
        errors: [error.message]
      };
    }
  }

  /**
   * Test weather location
   * @param {string} location - Location to test
   * @returns {Promise<Object>} Test result
   */
  async testWeatherLocation(location) {
    try {
      const testWeather = await this.getCurrentWeather(location);
      
      return {
        success: true,
        message: `Location "${location}" is valid`,
        locationInfo: testWeather.location,
        currentWeather: {
          temperatura: testWeather.temperatura,
          condicion: testWeather.condicion,
          humedad: testWeather.humedad,
          presion: testWeather.presion
        },
        errors: []
      };
    } catch (error) {
      return {
        success: false,
        message: 'Invalid location or weather service error',
        locationInfo: null,
        currentWeather: null,
        errors: [error.message]
      };
    }
  }

  /**
   * Cache weather data in Redis
   * @param {Object} weatherData - Weather data to cache
   */
  async cacheWeatherData(weatherData) {
    try {
      const key = 'weather:latest';
      const cacheData = {
        ...weatherData,
        cachedAt: new Date()
      };
      
      await cache.set(key, cacheData, 300); // 5 minutes cache
      console.log('[WeatherService] Weather data cached in Redis');
    } catch (error) {
      console.error('[WeatherService] Error caching weather data:', error.message);
    }
  }

  /**
   * Get cached weather data from Redis
   * @returns {Promise<Object|null>} Cached weather data
   */
  async getCachedWeatherData() {
    try {
      const key = 'weather:latest';
      const cachedData = await cache.get(key);
      
      if (cachedData) {
        console.log('[WeatherService] Retrieved cached weather data from Redis');
        return cachedData;
      }
      
      return null;
    } catch (error) {
      console.error('[WeatherService] Error getting cached weather data:', error.message);
      return null;
    }
  }

  /**
   * Format database record to GraphQL format
   * @param {Object} record - Database record
   * @returns {Object} Formatted record
   */
  formatDatabaseRecord(record) {
    return {
      id: record.id.toString(),
      location: {
        name: record.location_name,
        region: '',
        country: '',
        latitude: record.location_lat,
        longitude: record.location_lon,
        timezone: 'America/Santiago',
        localTime: record.received_at
      },
      temperatura: record.temperatura,
      humedad: record.humedad,
      sensacionTermica: record.sensacion_termica,
      puntoRocio: record.punto_rocio,
      presion: record.presion,
      velocidadViento: record.velocidad_viento,
      direccionViento: record.direccion_viento,
      rafagasViento: 0,
      visibilidad: record.visibilidad,
      uvIndex: record.uv_index,
      condicion: record.condicion,
      iconCode: record.icono,
      pm25: record.calidad_aire_pm2_5,
      pm10: record.calidad_aire_pm10,
      receivedAt: record.received_at,
      localTime: record.received_at,
      source: 'Database',
      rawData: null
    };
  }

  /**
   * Calculate dew point using Magnus formula
   * @param {number} temp - Temperature in Celsius
   * @param {number} humidity - Relative humidity in %
   * @returns {number} Dew point in Celsius
   */
  calculateDewPoint(temp, humidity) {
    const a = 17.27;
    const b = 237.7;
    
    const alpha = ((a * temp) / (b + temp)) + Math.log(humidity / 100);
    const dewPoint = (b * alpha) / (a - alpha);
    
    return Math.round(dewPoint * 10) / 10;
  }

  /**
   * Check if service is configured
   * @returns {boolean} True if configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Update location
   * @param {string} newLocation - New location
   */
  updateLocation(newLocation) {
    if (!newLocation || typeof newLocation !== 'string') {
      throw new Error('Invalid location parameter. Must be a non-empty string.');
    }
    
    const cleanLocation = newLocation.trim();
    console.log(`[WeatherService] Updating location from '${this.location}' to '${cleanLocation}'`);
    this.location = cleanLocation;
    console.log(`[WeatherService] Location updated successfully to: ${this.location}`);
  }

  /**
   * Get PubSub instance for subscriptions
   * @returns {PubSub} PubSub instance
   */
  getPubSub() {
    return pubsub;
  }
}

module.exports = new WeatherService();