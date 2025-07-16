const mqtt = require('mqtt');
const { query } = require('../config/database');
const { cache } = require('../config/redis');
const { pubsub, SENSOR_EVENTS } = require('../utils/pubsub');
const EventEmitter = require('events');
const dynamicSensorService = require('./dynamicSensorService');
const mqttAutoDiscoveryService = require('./mqttAutoDiscoveryService');

/**
 * MQTT Service for GraphQL Backend
 * Handles MQTT broker connection, data ingestion, and real-time sensor updates
 * Adapted from REST backend with GraphQL-specific enhancements
 */
class MqttService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.sensorHistoryMaxLength = parseInt(process.env.SENSOR_HISTORY_MAX_LENGTH, 10) || 100;

    // MQTT Configuration
    this.brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io';
    this.clientId = `mqtt_client_graphql_${Math.random().toString(16).slice(3)}`;
    this.topicToSubscribe = 'Invernadero/#';
  }

  /**
   * Connect to MQTT broker
   */
  async connect() {
    try {
      const options = {
        clientId: this.clientId,
        clean: true,
        connectTimeout: 4000,
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        reconnectPeriod: this.reconnectDelay
      };

      console.log('🔌 Connecting to MQTT broker...', {
        url: this.brokerUrl,
        clientId: this.clientId,
        username: process.env.MQTT_USERNAME || 'N/A',
        passwordSet: Boolean(process.env.MQTT_PASSWORD)
      });

      if (!this.brokerUrl || typeof this.brokerUrl !== 'string' || this.brokerUrl.trim() === '') {
        throw new Error('MQTT_BROKER_URL is invalid or not set');
      }

      this.client = mqtt.connect(this.brokerUrl, options);

      this.client.on('connect', () => {
        console.log('✅ MQTT connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.subscribeToTopics();
        this.emit('connected');
      });

      this.client.on('message', (topic, message) => {
        this.handleIncomingMessage(topic, message);
      });

      this.client.on('error', (error) => {
        console.error('❌ MQTT connection error:', error);
        this.emit('error', error);
      });

      this.client.on('close', () => {
        console.log('🔌 MQTT connection closed');
        this.isConnected = false;
        this.emit('disconnected');
      });

      this.client.on('reconnect', () => {
        this.reconnectAttempts++;
        console.log(`🔄 MQTT reconnecting... (attempt ${this.reconnectAttempts})`);

        if (this.reconnectAttempts > this.maxReconnectAttempts) {
          console.error('❌ Max reconnection attempts reached');
          this.client.end();
        }
      });

      this.client.on('offline', () => {
        console.warn('📴 MQTT client is offline');
      });

    } catch (error) {
      console.error('❌ Failed to connect to MQTT broker:', error);
      throw error;
    }
  }

  /**
   * Subscribe to MQTT topics
   */
  subscribeToTopics() {
    if (!this.client) {
      console.error('❌ MQTT Client: Cannot subscribe, client not initialized');
      return;
    }

    this.client.subscribe(this.topicToSubscribe, (err, granted) => {
      if (!err) {
        if (granted && granted.length > 0 && granted[0].topic === this.topicToSubscribe) {
          console.log(`📡 Successfully subscribed to topic: ${granted[0].topic} with QoS ${granted[0].qos}`);
        } else if (granted && granted.length > 0) {
          console.warn(`Subscribed to ${this.topicToSubscribe}, but grant info is unexpected:`, granted);
        } else {
          console.warn(`Subscribed to ${this.topicToSubscribe}, but no grant information returned`);
        }
      } else {
        console.error(`❌ Subscription error for topic ${this.topicToSubscribe}:`, err);
      }
    });
  }

  /**
   * Handle incoming MQTT messages (adapted from REST backend)
   * @param {string} topic - MQTT topic
   * @param {Buffer} message - Message payload
   */
  async handleIncomingMessage(topic, message) {
    const processingStartTime = Date.now();
    const rawPayload = message.toString();
    const receivedAt = new Date(); // Use standard Date for GraphQL

    console.log('🚀 MQTT MESSAGE PROCESSING STARTED');
    console.log(`   🕰️ Timestamp: ${receivedAt.toISOString()}`);
    console.log(`   📡 Topic: ${topic}`);
    console.log(`   📄 Payload: ${rawPayload.substring(0, 200)}${rawPayload.length > 200 ? '...' : ''}`);

    // Try to process with dynamic sensor service first
    try {
      const parsedPayload = JSON.parse(rawPayload);
      const processed = await dynamicSensorService.processSensorData(topic, parsedPayload);
      
      // If no sensor found, try auto-discovery
      if (!processed) {
        console.log(`🔍 No sensor found for topic ${topic}, attempting auto-discovery...`);
        const autoCreated = await mqttAutoDiscoveryService.processUnknownMessage(topic, parsedPayload);
        
        if (autoCreated) {
          console.log(`🤖 Auto-discovery initiated for topic: ${topic}`);
        } else {
          console.log(`⚠️ Auto-discovery skipped for topic: ${topic}`);
        }
      }
      
    } catch (error) {
      console.log(`⚠️ Dynamic sensor processing failed, trying auto-discovery and legacy: ${error.message}`);

      // Try auto-discovery for unknown topics
      try {
        const parsedPayload = JSON.parse(rawPayload);
        const autoCreated = await mqttAutoDiscoveryService.processUnknownMessage(topic, parsedPayload);
        
        if (!autoCreated) {
          // Fall back to legacy processing
          await this.processLegacyMessage(topic, rawPayload, receivedAt);
        }
      } catch (parseError) {
        console.error(`❌ JSON parsing failed: ${parseError.message}`);
        await this.processLegacyMessage(topic, rawPayload, receivedAt);
      }
    }
  }

  /**
   * Process legacy MQTT messages (original implementation)
   * @param {string} topic - MQTT topic
   * @param {string} rawPayload - Raw message payload
   * @param {Date} receivedAt - Timestamp when message was received
   */
  async processLegacyMessage(topic, rawPayload, receivedAt) {
    const topicParts = topic.split('/');
    let queryStr;
    let values;
    let tableName;
    let idOrGroup;
    let data;

    if (topicParts.length === 3 && topicParts[0] === 'Invernadero') {
      idOrGroup = topicParts[1];
      const dataType = topicParts[2];
      console.log(`🎯 TOPIC STRUCTURE VALID: ${idOrGroup}/${dataType}`);

      if ((idOrGroup === 'TemHum1' || idOrGroup === 'TemHum2') && dataType === 'data') {
        tableName = idOrGroup.toLowerCase();
        console.log(`🌡️ Processing TemHum data for table: ${tableName}`);

        try {
          data = JSON.parse(rawPayload);
          console.log('✅ JSON parsing successful:', data);
        } catch (error) {
          console.error(`❌ JSON parsing failed: ${error.message}`);
          return;
        }

        if (data.temperatura === undefined || data.humedad === undefined) {
          console.error('❌ Missing required fields: temperatura, humedad');
          return;
        }

        // Store in PostgreSQL - Try both column formats (with and without stats_ prefix)
        // First try with stats_ prefix (new schema)
        queryStr = `
          INSERT INTO ${tableName} (temperatura, humedad, heatindex, dewpoint, rssi, boot, mem, 
                     tmin, tmax, tavg, hmin, hmax, havg, total, errors, received_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `;
        values = [
          data.temperatura,
          data.humedad,
          data.heatindex || null,
          data.dewpoint || null,
          data.rssi || null,
          data.boot || 0,
          data.mem || null,
          data.stats?.tmin || null,
          data.stats?.tmax || null,
          data.stats?.tavg || null,
          data.stats?.hmin || null,
          data.stats?.hmax || null,
          data.stats?.havg || null,
          data.stats?.total || 0,
          data.stats?.errors || 0,
          receivedAt
        ];

        // Cache latest data in Redis
        const sensorKey = `sensor_latest:${tableName}`;
        const latestData = {
          temperatura: data.temperatura,
          humedad: data.humedad,
          heatindex: data.heatindex,
          dewpoint: data.dewpoint,
          rssi: data.rssi,
          last_updated: receivedAt.toISOString()
        };

        try {
          await cache.hset(sensorKey, latestData);
          console.log(`✅ Redis cache updated for ${sensorKey}`);

          // Store historical data
          const metricsToCache = ['temperatura', 'humedad', 'heatindex', 'dewpoint', 'rssi'];
          for (const metric of metricsToCache) {
            if (data[metric] !== undefined) {
              const listKey = `sensor_history:${tableName}:${metric}`;
              const dataPoint = JSON.stringify({ ts: receivedAt.toISOString(), val: data[metric] });
              await cache.lpush(listKey, dataPoint);
              await cache.ltrim(listKey, 0, this.sensorHistoryMaxLength - 1);
            }
          }

          // Publish GraphQL subscription
          await pubsub.publish(SENSOR_EVENTS.TEMHUM_DATA, {
            temhumData: {
              sensor: tableName,
              temperatura: data.temperatura,
              humedad: data.humedad,
              heatindex: data.heatindex,
              dewpoint: data.dewpoint,
              rssi: data.rssi,
              received_at: receivedAt.toISOString()
            }
          });

        } catch (redisError) {
          console.error(`❌ Redis operation failed for ${sensorKey}:`, redisError);
        }

      } else if (idOrGroup === 'Agua') {
        tableName = 'calidad_agua';
        console.log(`💧 Processing water data for table: ${tableName}`);

        if (dataType === 'data') {
          try {
            data = JSON.parse(rawPayload);
            console.log('✅ Water data JSON parsed:', data);
          } catch (error) {
            console.error(`❌ Water data JSON parsing failed: ${error.message}`);
            return;
          }

          if (data.ph === undefined || data.ec === undefined || data.ppm === undefined) {
            console.error('❌ Missing required water quality fields: ph, ec, ppm');
            return;
          }

          // Store in PostgreSQL
          queryStr = `INSERT INTO ${tableName} (ph, ec, ppm, temperatura_agua, rssi, boot, mem, received_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
          values = [data.ph, data.ec, data.ppm, data.temp || null, data.rssi, data.boot, data.mem, receivedAt];

          // Cache in Redis
          const sensorKeyAgua = 'sensor_latest:calidad_agua';
          const aguaData = {
            ph: data.ph,
            ec: data.ec,
            ppm: data.ppm,
            last_updated_multiparam: receivedAt.toISOString()
          };
          if (data.temp !== undefined) {
            aguaData.temperatura_agua = data.temp;
          }

          try {
            await cache.hset(sensorKeyAgua, aguaData);
            console.log('✅ Water quality data cached');

            // Store historical data
            const waterParams = ['ph', 'ec', 'ppm'];
            if (data.temp !== undefined) waterParams.push('temperatura_agua');

            for (const param of waterParams) {
              const valueToLog = param === 'temperatura_agua' ? data.temp : data[param];
              if (valueToLog !== undefined) {
                const listKey = `sensor_history:calidad_agua:${param}`;
                const dataPoint = JSON.stringify({ ts: receivedAt.toISOString(), val: valueToLog });
                await cache.lpush(listKey, dataPoint);
                await cache.ltrim(listKey, 0, this.sensorHistoryMaxLength - 1);
              }
            }

            // Publish GraphQL subscription
            await pubsub.publish(SENSOR_EVENTS.WATER_QUALITY_DATA, {
              waterQualityData: {
                ph: data.ph,
                ec: data.ec,
                ppm: data.ppm,
                temperatura_agua: data.temp,
                received_at: receivedAt.toISOString()
              }
            });

          } catch (redisError) {
            console.error('❌ Water quality Redis operation failed:', redisError);
          }

        } else if (dataType === 'Temperatura') {
          const waterTemp = parseFloat(rawPayload);
          console.log(`🌡️ Water temperature parsed: ${waterTemp}`);

          if (isNaN(waterTemp)) {
            console.error(`❌ Failed to parse water temperature: ${rawPayload}`);
            return;
          }

          queryStr = `INSERT INTO ${tableName} (temperatura_agua, received_at) VALUES ($1, $2)`;
          values = [waterTemp, receivedAt];

          // Cache temperature update
          try {
            const sensorKeyTemp = 'sensor_latest:calidad_agua';
            const tempUpdate = {
              temperatura_agua: waterTemp,
              last_updated_temp_agua: receivedAt.toISOString()
            };
            await cache.hset(sensorKeyTemp, tempUpdate);

            // Store historical data
            const tempListKey = 'sensor_history:calidad_agua:temperatura_agua';
            const tempDataPoint = JSON.stringify({ ts: receivedAt.toISOString(), val: waterTemp });
            await cache.lpush(tempListKey, tempDataPoint);
            await cache.ltrim(tempListKey, 0, this.sensorHistoryMaxLength - 1);

            // Publish GraphQL subscription
            await pubsub.publish(SENSOR_EVENTS.WATER_TEMPERATURE_DATA, {
              waterTemperatureData: {
                temperatura_agua: waterTemp,
                received_at: receivedAt.toISOString()
              }
            });

          } catch (redisError) {
            console.error('❌ Water temperature Redis operation failed:', redisError);
          }
        }

      } else if (idOrGroup === 'Luxometro' && dataType === 'data') {
        tableName = 'luxometro';
        console.log(`💡 Processing light sensor data for table: ${tableName}`);

        try {
          data = JSON.parse(rawPayload);
          console.log('✅ Light sensor JSON parsed:', data);
        } catch (error) {
          console.error(`❌ Light sensor JSON parsing failed: ${error.message}`);
          return;
        }

        if (data.light === undefined) {
          console.error('❌ Missing required light field');
          return;
        }

        // Store in PostgreSQL
        queryStr = `INSERT INTO ${tableName} (light, white_light, raw_light, rssi, boot, mem, lmin, lmax, lavg, wmin, wmax, wavg, total, errors, received_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`;
        values = [
          data.light, data.white_light, data.raw_light, data.rssi, data.boot, data.mem,
          data.stats?.lmin, data.stats?.lmax, data.stats?.lavg,
          data.stats?.wmin, data.stats?.wmax, data.stats?.wavg,
          data.stats?.total, data.stats?.errors, receivedAt
        ];

        // Cache in Redis
        const sensorKeyLux = 'sensor_latest:luxometro';
        const luxData = {
          light: data.light,
          white_light: data.white_light,
          raw_light: data.raw_light,
          rssi: data.rssi,
          last_updated: receivedAt.toISOString()
        };

        try {
          await cache.hset(sensorKeyLux, luxData);
          console.log('✅ Light sensor data cached');

          // Store historical data
          const lightMetrics = ['light', 'white_light', 'raw_light'];
          for (const metric of lightMetrics) {
            if (data[metric] !== undefined) {
              const listKey = `sensor_history:luxometro:${metric}`;
              const dataPoint = JSON.stringify({ ts: receivedAt.toISOString(), val: data[metric] });
              await cache.lpush(listKey, dataPoint);
              await cache.ltrim(listKey, 0, this.sensorHistoryMaxLength - 1);
            }
          }

          // Publish GraphQL subscription
          await pubsub.publish(SENSOR_EVENTS.LIGHT_DATA, {
            lightData: {
              light: data.light,
              white_light: data.white_light,
              raw_light: data.raw_light,
              rssi: data.rssi,
              received_at: receivedAt.toISOString()
            }
          });

        } catch (redisError) {
          console.error('❌ Light sensor Redis operation failed:', redisError);
        }

      } else if (dataType === 'data') {
        // Handle power sensor data
        const powerSensorHardwareId = idOrGroup;
        tableName = 'power_monitor_logs';
        console.log(`⚡ Processing power sensor data for hardware ID: ${powerSensorHardwareId}`);

        try {
          data = JSON.parse(rawPayload);
          console.log('✅ Power sensor JSON parsed:', data);
        } catch (error) {
          console.error(`❌ Power sensor JSON parsing failed: ${error.message}`);
          return;
        }

        if (data.voltage === undefined || data.current === undefined || data.watts === undefined) {
          console.error('❌ Missing required power fields: voltage, current, watts');
          return;
        }

        try {
          // Find device in database
          const deviceResult = await query(
            'SELECT id, configuration FROM devices WHERE device_id = $1 AND type = \'power_sensor\'',
            [powerSensorHardwareId]
          );

          if (deviceResult.rows.length === 0) {
            console.warn(`⚠️ Power sensor with device_id '${powerSensorHardwareId}' not found`);
            return;
          }

          const deviceInfo = deviceResult.rows[0];
          const monitoredDeviceId = deviceInfo.configuration?.monitors_device_id;

          if (!monitoredDeviceId) {
            console.warn(`⚠️ Power sensor ${powerSensorHardwareId} not configured with 'monitors_device_id'`);
            return;
          }

          // Store in PostgreSQL
          queryStr = `INSERT INTO ${tableName} (device_hardware_id, watts, voltage, current, frequency, power_factor, rssi, mem, boot, received_at, device_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`;
          values = [
            powerSensorHardwareId, data.watts, data.voltage, data.current,
            data.frequency, data.power_factor, data.rssi, data.mem, data.boot,
            receivedAt, monitoredDeviceId
          ];

          // Cache power data
          const sensorKeyPower = `sensor_latest:power:${powerSensorHardwareId}`;
          const powerData = {
            voltage: data.voltage,
            current: data.current,
            watts: data.watts,
            frequency: data.frequency,
            power_factor: data.power_factor,
            last_updated: receivedAt.toISOString()
          };

          await cache.hset(sensorKeyPower, powerData);

          // Store historical data
          const powerMetrics = ['voltage', 'current', 'watts'];
          for (const metric of powerMetrics) {
            if (data[metric] !== undefined) {
              const listKey = `sensor_history:power:${powerSensorHardwareId}:${metric}`;
              const dataPoint = JSON.stringify({ ts: receivedAt.toISOString(), val: data[metric] });
              await cache.lpush(listKey, dataPoint);
              await cache.ltrim(listKey, 0, this.sensorHistoryMaxLength - 1);
            }
          }

          // Publish GraphQL subscription
          await pubsub.publish(SENSOR_EVENTS.POWER_DATA, {
            powerData: {
              device_hardware_id: powerSensorHardwareId,
              device_id: monitoredDeviceId,
              voltage: data.voltage,
              current: data.current,
              watts: data.watts,
              received_at: receivedAt.toISOString()
            }
          });

        } catch (dbError) {
          console.error('❌ Power sensor database error:', dbError);
          return;
        }
      }
    } else {
      console.warn(`⚠️ Unexpected topic structure: ${topic}`);
      return;
    }

    // Execute database insert
    if (queryStr && values && tableName) {
      try {
        await query(queryStr, values);
        console.log(`✅ Database insert successful - Table: ${tableName}`);
      } catch (dbError) {
        console.error(`❌ Database insert failed - Table: ${tableName}:`, dbError.message);
      }
    }

    this.emit('message', { topic, data: rawPayload });
  }

  /**
   * Get latest sensor data from Redis cache
   */
  async getLatestData(sensorType, deviceId = null) {
    let key;

    if (sensorType === 'power' && deviceId) {
      key = `sensor_latest:power:${deviceId}`;
    } else {
      key = `sensor_latest:${sensorType}`;
    }

    try {
      const data = await cache.hgetall(key);
      return data && Object.keys(data).length > 0 ? data : null;
    } catch (error) {
      console.error(`❌ Error getting latest data for ${key}:`, error);
      return null;
    }
  }

  /**
   * Get historical sensor data from Redis
   */
  async getHistoricalData(sensorType, metric, limit = 100, deviceId = null) {
    let key;

    if (sensorType === 'power' && deviceId) {
      key = `sensor_history:power:${deviceId}:${metric}`;
    } else {
      key = `sensor_history:${sensorType}:${metric}`;
    }

    try {
      const data = await cache.lrange(key, 0, limit - 1);
      return data.map(item => JSON.parse(item));
    } catch (error) {
      console.error(`❌ Error getting historical data for ${key}:`, error);
      return [];
    }
  }

  /**
   * Publish MQTT message
   */
  async publish(topic, data) {
    if (!this.isConnected) {
      throw new Error('MQTT client not connected');
    }

    const message = JSON.stringify(data);

    return new Promise((resolve, reject) => {
      this.client.publish(topic, message, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      subscribedTopic: this.topicToSubscribe,
      brokerUrl: this.brokerUrl,
      clientId: this.clientId
    };
  }

  /**
   * Disconnect from MQTT broker
   */
  async disconnect() {
    if (this.client) {
      console.log('🔌 Disconnecting from MQTT broker...');
      this.client.end();
      this.isConnected = false;
    }
  }

  /**
   * Simulate sensor data for testing
   */
  async simulateData(sensorType) {
    let topic, data;

    switch (sensorType) {
    case 'temhum1':
      topic = 'Invernadero/TemHum1/data';
      data = {
        temperatura: +(20 + Math.random() * 15).toFixed(2),
        humedad: Math.floor(40 + Math.random() * 40),
        heatindex: +(22 + Math.random() * 10).toFixed(2),
        dewpoint: +(15 + Math.random() * 8).toFixed(2),
        rssi: -Math.floor(30 + Math.random() * 40),
        boot: 1,
        mem: Math.floor(40000 + Math.random() * 10000),
        stats: {
          tmin: +(18 + Math.random() * 5).toFixed(2),
          tmax: +(25 + Math.random() * 10).toFixed(2),
          tavg: +(22 + Math.random() * 8).toFixed(2),
          hmin: Math.floor(35 + Math.random() * 15),
          hmax: Math.floor(60 + Math.random() * 30),
          havg: Math.floor(50 + Math.random() * 20),
          total: Math.floor(90 + Math.random() * 20),
          errors: Math.floor(Math.random() * 3)
        }
      };
      break;
    case 'temhum2':
      topic = 'Invernadero/TemHum2/data';
      data = {
        temperatura: +(18 + Math.random() * 12).toFixed(2),
        humedad: Math.floor(35 + Math.random() * 45),
        heatindex: +(20 + Math.random() * 8).toFixed(2),
        dewpoint: +(13 + Math.random() * 7).toFixed(2),
        rssi: -Math.floor(25 + Math.random() * 35),
        boot: 1,
        mem: Math.floor(35000 + Math.random() * 15000),
        stats: {
          tmin: +(16 + Math.random() * 4).toFixed(2),
          tmax: +(23 + Math.random() * 8).toFixed(2),
          tavg: +(20 + Math.random() * 6).toFixed(2),
          hmin: Math.floor(30 + Math.random() * 20),
          hmax: Math.floor(55 + Math.random() * 35),
          havg: Math.floor(45 + Math.random() * 25),
          total: Math.floor(85 + Math.random() * 25),
          errors: Math.floor(Math.random() * 2)
        }
      };
      break;
    case 'agua':
      topic = 'Invernadero/Agua/data';
      data = {
        ph: +(6.5 + Math.random() * 2).toFixed(2),
        ec: +(1000 + Math.random() * 500).toFixed(2),
        ppm: +(500 + Math.random() * 300).toFixed(2),
        temp: +(20 + Math.random() * 10).toFixed(2),
        rssi: -Math.floor(20 + Math.random() * 30),
        boot: 1,
        mem: Math.floor(30000 + Math.random() * 20000)
      };
      break;
    case 'luxometro':
      topic = 'Invernadero/Luxometro/data';
      data = {
        light: +(100 + Math.random() * 900).toFixed(2),
        white_light: +(80 + Math.random() * 700).toFixed(2),
        raw_light: +(50 + Math.random() * 400).toFixed(2),
        rssi: -Math.floor(25 + Math.random() * 35),
        boot: 1,
        mem: Math.floor(32000 + Math.random() * 18000),
        stats: {
          lmin: +(50 + Math.random() * 100).toFixed(2),
          lmax: +(800 + Math.random() * 200).toFixed(2),
          lavg: +(400 + Math.random() * 200).toFixed(2),
          wmin: +(40 + Math.random() * 80).toFixed(2),
          wmax: +(600 + Math.random() * 180).toFixed(2),
          wavg: +(300 + Math.random() * 150).toFixed(2),
          total: Math.floor(95 + Math.random() * 15),
          errors: Math.floor(Math.random() * 2)
        }
      };
      break;
    }

    if (topic && data) {
      try {
        await this.publish(topic, data);
        console.log(`📡 Simulated ${sensorType} data published to ${topic}`);
      } catch (error) {
        console.error(`❌ Failed to simulate ${sensorType} data:`, error);
      }
    }
  }
}

module.exports = new MqttService();
