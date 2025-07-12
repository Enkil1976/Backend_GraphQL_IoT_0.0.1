const dynamicSensorService = require('../../../services/dynamicSensorService');
const sensorTypeService = require('../../../services/sensorTypeService');
const mqttAutoDiscoveryService = require('../../../services/mqttAutoDiscoveryService');
const { query } = require('../../../config/database');
const { AuthenticationError, UserInputError, ForbiddenError } = require('apollo-server-express');

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
      // Intentar primero con ID numérico, luego con hardware_id
      let sensor = await dynamicSensorService.getSensorByNumericId(id);
      
      if (!sensor) {
        sensor = await dynamicSensorService.getSensorById(id);
      }
      
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
      // Intentar primero con ID numérico, luego con hardware_id
      let sensor = await dynamicSensorService.getSensorByNumericId(sensorId);
      
      if (!sensor) {
        sensor = await dynamicSensorService.getSensorById(sensorId);
      }
      
      if (!sensor) {
        throw new UserInputError(`Sensor no encontrado: ${sensorId}`);
      }

      console.log(`🔍 Consultando lecturas del sensor ${sensorId} (${sensor.sensor_type})`);
      console.log(`📊 Hardware ID: ${sensor.hardware_id}, Sensor Type: ${sensor.sensor_type}`);

      let readings = [];

      // Todos los sensores usan sensor_data_generic (no temp_pressure_data separada)
      console.log(`🔍 Consultando sensor_data_generic para sensor tipo: ${sensor.sensor_type}`);
      
      // Datos genéricos desde sensor_data_generic
      // Usar ID numérico, no hardware_id string
      let whereConditions = [`sensor_id = $1`];
      let queryParams = [parseInt(sensorId)]; // Convertir a entero
      let paramIndex = 2;

      if (from) {
        whereConditions.push(`received_at >= $${paramIndex}`);
        queryParams.push(from);
        paramIndex++;
      }

      if (to) {
        whereConditions.push(`received_at <= $${paramIndex}`);
        queryParams.push(to);
        paramIndex++;
      }

      const genericQuery = `
        SELECT id, sensor_id, payload, received_at as timestamp
        FROM sensor_data_generic
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY received_at DESC
        LIMIT $${paramIndex}
        OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, offset);
      
      console.log(`🔍 Ejecutando consulta genérica:`, genericQuery);
      console.log(`📝 Parámetros:`, queryParams);
      
      const result = await query(genericQuery, queryParams);
      
      console.log(`📊 Resultados genéricos: ${result.rows.length} filas`);
      if (result.rows.length > 0) {
        console.log(`📄 Primera fila:`, JSON.stringify(result.rows[0], null, 2));
      }

      readings = result.rows.map(row => {
        console.log(`🔍 Raw row data:`, JSON.stringify(row, null, 2));
        
        // Extraer datos del payload según la estructura real
        let temperature, humidity, pressure, light, white_light, raw_light, rssi;
        let rawData = row.payload;
        
        try {
          const payload = row.payload;
          const sensorData = payload.data || {}; // Los datos están en payload.data
          
          // Extraer valores según la estructura real que mostraste
          temperature = sensorData.temperature;
          humidity = sensorData.humidity;
          pressure = sensorData.pressure;
          light = sensorData.light;
          white_light = sensorData.white_light;
          raw_light = sensorData.raw_light;
          rssi = payload.rssi;
          
          console.log(`📊 Datos extraídos: temp=${temperature}, hum=${humidity}, pres=${pressure}, light=${light}`);
          
        } catch (parseError) {
          console.warn('Error parsing payload:', parseError.message);
        }
        
        return {
          id: `generic:${row.id}`,
          sensor: sensor,
          timestamp: row.timestamp,
          temperatura: temperature,
          humedad: humidity,
          presion: pressure,
          altitude: null, // No vi este campo en los datos
          light: light,
          whiteLight: white_light,
          rawLight: raw_light,
          rssi: rssi,
          rawData: rawData
        };
      });

      // Formatear para GraphQL Connection
      const edges = readings.map((reading, index) => ({
        cursor: Buffer.from(`${sensorId}:${reading.timestamp}:${index}`).toString('base64'),
        node: reading
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: readings.length === limit,
          hasPreviousPage: offset > 0,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
        },
        totalCount: readings.length
      };

    } catch (error) {
      console.error('❌ Error in sensorReadings query:', error);
      throw error;
    }
  },

  /**
   * Obtiene los últimos datos de sensores desde Redis cache
   */
  latestSensorData: async(_, { types }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver datos de sensores');
    }

    try {
      const { cache } = require('../../../config/redis');
      const sensors = await query('SELECT id, hardware_id, type FROM sensors WHERE is_active = true');
      
      const latestData = [];
      
      for (const sensor of sensors.rows) {
        const cacheKey = `sensor_latest:${sensor.hardware_id.toLowerCase()}`;
        
        try {
          const cachedData = await cache.hgetall(cacheKey);
          
          if (cachedData && Object.keys(cachedData).length > 0) {
            // Filter by types if specified
            if (types && types.length > 0 && !types.includes(sensor.type)) {
              continue;
            }
            
            latestData.push({
              id: `${sensor.id}_${Date.now()}`,
              sensorId: sensor.id,
              hardwareId: sensor.hardware_id,
              sensorType: sensor.type,
              timestamp: cachedData.timestamp || new Date().toISOString(),
              temperatura: parseFloat(cachedData.temperatura) || null,
              humedad: parseFloat(cachedData.humedad) || null,
              ph: parseFloat(cachedData.ph) || null,
              ec: parseFloat(cachedData.ec) || null,
              ppm: parseFloat(cachedData.ppm) || null,
              light: parseFloat(cachedData.light) || null,
              watts: parseFloat(cachedData.watts) || null,
              rssi: parseInt(cachedData.rssi) || null,
              rawData: cachedData
            });
          }
        } catch (cacheError) {
          console.warn(`Error reading cache for sensor ${sensor.hardware_id}:`, cacheError.message);
        }
      }
      
      console.log(`✅ Retrieved ${latestData.length} latest sensor readings from cache`);
      return latestData;

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
      // Intentar primero con ID numérico, luego con hardware_id
      let sensor = await dynamicSensorService.getSensorByNumericId(sensorId);
      
      if (!sensor) {
        sensor = await dynamicSensorService.getSensorById(sensorId);
      }
      
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
  },

  /**
   * Obtiene el estado del auto-discovery
   */
  autoDiscoveryStatus: async(_, {}, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver el estado del auto-discovery');
    }

    if (user.role !== 'admin') {
      throw new ForbiddenError('Solo los administradores pueden ver el estado del auto-discovery');
    }

    try {
      const stats = mqttAutoDiscoveryService.getAutoDiscoveryStats();
      
      return {
        enabled: stats.enabled,
        unknownTopicsCount: stats.unknownTopicsCount,
        totalAnalyzed: 0, // TODO: Implementar contador
        autoCreatedCount: 0, // TODO: Implementar contador
        recentActivity: [], // TODO: Implementar actividad reciente
        config: {
          analysisWindow: stats.config.analysisWindow,
          minSamples: stats.config.minSamples,
          autoCreateThreshold: stats.config.autoCreateThreshold,
          approvalThreshold: stats.config.approvalThreshold
        }
      };

    } catch (error) {
      console.error('❌ Error in autoDiscoveryStatus query:', error);
      throw error;
    }
  },

  /**
   * Obtiene la lista de tópicos desconocidos
   */
  unknownTopics: async(_, {}, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver tópicos desconocidos');
    }

    if (user.role !== 'admin') {
      throw new ForbiddenError('Solo los administradores pueden ver tópicos desconocidos');
    }

    try {
      const stats = mqttAutoDiscoveryService.getAutoDiscoveryStats();
      
      return stats.recentUnknown.map(topicData => ({
        topic: topicData.topic,
        firstSeen: topicData.firstSeen,
        lastSeen: topicData.lastSeen,
        messageCount: topicData.messageCount,
        payloadSamples: topicData.payloads.map(p => p.payload),
        sensorScore: 0, // TODO: Calcular en real-time
        deviceScore: 0, // TODO: Calcular en real-time
        suggestedType: 'unknown',
        confidence: 0,
        status: 'ANALYZING'
      }));

    } catch (error) {
      console.error('❌ Error in unknownTopics query:', error);
      throw error;
    }
  },

  /**
   * Obtiene datos históricos de todos los sensores
   */
  allSensorHistory: async(_, { limit = 100, offset = 0, from, to, types }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver datos históricos');
    }

    try {
      console.log('🔍 Consultando datos históricos de todos los sensores...');
      console.log(`📊 Parámetros: limit=${limit}, offset=${offset}, from=${from}, to=${to}`);
      
      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      // Filtros de tiempo
      if (from) {
        whereConditions.push(`received_at >= $${paramIndex}`);
        queryParams.push(from);
        paramIndex++;
      }
      
      if (to) {
        whereConditions.push(`received_at <= $${paramIndex}`);
        queryParams.push(to);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Consultar datos de todas las tablas de sensores (incluyendo legacy)
      const sensorTables = [
        { table: 'sensor_data_generic', type: 'GENERIC', fields: 'id, sensor_id, payload, received_at' },
        // Tablas legacy donde están los datos reales
        { table: 'sensor_data_temhum1', type: 'TEMHUM1', fields: "'temhum1' as sensor_id, temperature, humidity, timestamp as received_at" },
        { table: 'sensor_data_temhum2', type: 'TEMHUM2', fields: "'temhum2' as sensor_id, temperature, humidity, timestamp as received_at" },
        { table: 'sensor_data_calidad_agua', type: 'WATER_QUALITY_LEGACY', fields: "'calidad_agua' as sensor_id, ph, ec, tds, temperature, timestamp as received_at" },
        { table: 'sensor_data_luxometro', type: 'LIGHT_LEGACY', fields: "'luxometro' as sensor_id, lux, timestamp as received_at" }
      ];

      let allResults = [];

      for (const tableInfo of sensorTables) {
        try {
          let tableQuery;
          if (tableInfo.table === 'sensor_data_generic') {
            tableQuery = `
              SELECT ${tableInfo.fields}, '${tableInfo.type}' as sensor_type
              FROM ${tableInfo.table}
              ${whereClause}
              ORDER BY received_at DESC
              LIMIT ${limit}
              OFFSET ${offset}
            `;
          } else {
            tableQuery = `
              SELECT id, ${tableInfo.fields}, '${tableInfo.type}' as sensor_type
              FROM ${tableInfo.table}
              ${whereClause}
              ORDER BY received_at DESC
              LIMIT ${limit}
              OFFSET ${offset}
            `;
          }

          console.log(`🔍 Ejecutando consulta en ${tableInfo.table}:`, tableQuery);
          console.log(`📝 Parámetros:`, queryParams);

          const tableResults = await query(tableQuery, queryParams);
          
          console.log(`📊 Resultados de ${tableInfo.table}: ${tableResults.rows.length} filas`);
          if (tableResults.rows.length > 0) {
            console.log(`📄 Primera fila:`, JSON.stringify(tableResults.rows[0], null, 2));
          }
          
          allResults = allResults.concat(
            tableResults.rows.map(row => ({
              ...row,
              table_source: tableInfo.table,
              sensor_type: tableInfo.type
            }))
          );

        } catch (tableError) {
          console.warn(`⚠️ Error consultando tabla ${tableInfo.table}:`, tableError.message);
        }
      }

      // Ordenar todos los resultados por fecha
      allResults.sort((a, b) => new Date(b.received_at) - new Date(a.received_at));

      // Limitar resultados finales
      const limitedResults = allResults.slice(0, limit);

      // Formatear para GraphQL
      const edges = limitedResults.map((row, index) => ({
        cursor: Buffer.from(`${row.table_source}:${row.id}`).toString('base64'),
        node: {
          id: `${row.table_source}:${row.id}`,
          sensorId: row.sensor_id || 'unknown',
          sensorName: `Sensor ${row.sensor_id}`,
          sensorType: row.sensor_type,
          timestamp: row.received_at,
          data: (() => {
            // Manejar la estructura real con payload
            if (row.sensor_type === 'GENERIC' && row.payload) {
              try {
                const payload = row.payload;
                const sensorData = payload.data || {};
                
                return {
                  temperatura: sensorData.temperature,
                  humedad: sensorData.humidity,
                  presion: sensorData.pressure,
                  light: sensorData.light,
                  white_light: sensorData.white_light,
                  raw_light: sensorData.raw_light,
                  dew_point: sensorData.dew_point,
                  heat_index: sensorData.heat_index,
                  rssi: payload.rssi,
                  _metadata: payload._metadata,
                  _original: payload
                };
              } catch (parseError) {
                console.warn('Error parsing payload field:', parseError.message);
                return { _raw: row.payload };
              }
            } else {
              // Datos de tablas legacy o estructura directa
              return {
                temperatura: row.temperatura,
                temperature: row.temperature,
                humedad: row.humidity,
                humidity: row.humidity,
                presion: row.presion,
                altitude: row.altitude,
                ph: row.ph,
                ec: row.ec,
                tds: row.tds,
                lux: row.lux,
                light: row.light
              };
            }
          })()
        }
      }));

      // Estadísticas por tipo
      const byType = {};
      limitedResults.forEach(row => {
        if (!byType[row.sensor_type]) {
          byType[row.sensor_type] = {
            sensorType: row.sensor_type,
            count: 0,
            latestReading: null,
            sensors: new Set()
          };
        }
        byType[row.sensor_type].count++;
        byType[row.sensor_type].sensors.add(row.sensor_id);
        if (!byType[row.sensor_type].latestReading || new Date(row.received_at) > new Date(byType[row.sensor_type].latestReading)) {
          byType[row.sensor_type].latestReading = row.received_at;
        }
      });

      const byTypeArray = Object.values(byType).map(type => ({
        ...type,
        sensors: Array.from(type.sensors)
      }));

      console.log(`📊 Encontrados ${edges.length} registros históricos de ${byTypeArray.length} tipos de sensores`);

      return {
        edges,
        pageInfo: {
          hasNextPage: allResults.length > limit,
          hasPreviousPage: offset > 0,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
        },
        totalCount: allResults.length,
        byType: byTypeArray
      };

    } catch (error) {
      console.error('❌ Error in allSensorHistory query:', error);
      throw error;
    }
  },

  /**
   * Obtiene datos específicos de sensores de temperatura y presión
   */
  tempPressureData: async(_, { sensorId, limit = 100, from, to }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver datos de temperatura y presión');
    }

    try {
      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramIndex = 1;

      if (sensorId) {
        whereConditions.push(`sensor_id = $${paramIndex}`);
        queryParams.push(sensorId);
        paramIndex++;
      }

      if (from) {
        whereConditions.push(`received_at >= $${paramIndex}`);
        queryParams.push(from);
        paramIndex++;
      }

      if (to) {
        whereConditions.push(`received_at <= $${paramIndex}`);
        queryParams.push(to);
        paramIndex++;
      }

      const tempPressureQuery = `
        SELECT id, sensor_id, temperatura, presion, altitude, received_at
        FROM temp_pressure_data
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY received_at DESC
        LIMIT $${paramIndex}
      `;

      queryParams.push(limit);

      const result = await query(tempPressureQuery, queryParams);

      return result.rows.map(row => ({
        id: row.id.toString(),
        sensorId: row.sensor_id,
        temperatura: row.temperatura,
        presion: row.presion,
        altitude: row.altitude,
        receivedAt: row.received_at
      }));

    } catch (error) {
      console.error('❌ Error in tempPressureData query:', error);
      // Si la tabla no existe, retornar array vacío
      if (error.code === '42P01') {
        console.warn('⚠️ Tabla temp_pressure_data no existe');
        return [];
      }
      throw error;
    }
  },

  /**
   * Obtiene datos específicos de calidad del agua
   */
  waterQualityData: async(_, { sensorId, limit = 100, from, to }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver datos de calidad del agua');
    }

    try {
      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramIndex = 1;

      if (sensorId) {
        whereConditions.push(`sensor_id = $${paramIndex}`);
        queryParams.push(sensorId);
        paramIndex++;
      }

      if (from) {
        whereConditions.push(`timestamp >= $${paramIndex}`);
        queryParams.push(from);
        paramIndex++;
      }

      if (to) {
        whereConditions.push(`timestamp <= $${paramIndex}`);
        queryParams.push(to);
        paramIndex++;
      }

      // Intentar primero con tabla sensor_data_generic filtrando por tipo WATER_QUALITY
      const waterQualityQuery = `
        SELECT s.id, s.hardware_id as sensor_id, 
               (data->>'ph')::float as ph,
               (data->>'ec')::float as ec,
               (data->>'ppm')::float as ppm,
               (data->>'temperatura')::float as temperatura,
               timestamp
        FROM sensor_data_generic s
        JOIN sensors sen ON s.sensor_id = sen.id
        WHERE sen.sensor_type = 'WATER_QUALITY'
        ${sensorId ? `AND sen.id = $${paramIndex}` : ''}
        ORDER BY timestamp DESC
        LIMIT $${sensorId ? paramIndex + 1 : paramIndex}
      `;

      if (sensorId) {
        queryParams.push(sensorId);
        paramIndex++;
      }
      queryParams.push(limit);

      const result = await query(waterQualityQuery, queryParams);

      return result.rows.map(row => ({
        id: row.id.toString(),
        sensorId: row.sensor_id,
        ph: row.ph,
        ec: row.ec,
        ppm: row.ppm,
        temperatura: row.temperatura,
        timestamp: row.timestamp
      }));

    } catch (error) {
      console.error('❌ Error in waterQualityData query:', error);
      return [];
    }
  },

  /**
   * Obtiene datos específicos de luz
   */
  lightData: async(_, { sensorId, limit = 100, from, to }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver datos de luz');
    }

    try {
      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramIndex = 1;

      if (sensorId) {
        whereConditions.push(`sensor_id = $${paramIndex}`);
        queryParams.push(sensorId);
        paramIndex++;
      }

      if (from) {
        whereConditions.push(`timestamp >= $${paramIndex}`);
        queryParams.push(from);
        paramIndex++;
      }

      if (to) {
        whereConditions.push(`timestamp <= $${paramIndex}`);
        queryParams.push(to);
        paramIndex++;
      }

      // Consultar datos de luz desde sensor_data_generic
      const lightQuery = `
        SELECT s.id, s.hardware_id as sensor_id,
               (data->>'light')::float as light,
               (data->>'white_light')::float as white_light,
               (data->>'raw_light')::float as raw_light,
               (data->>'uv_index')::float as uv_index,
               timestamp
        FROM sensor_data_generic s
        JOIN sensors sen ON s.sensor_id = sen.id
        WHERE sen.sensor_type = 'LIGHT'
        ${sensorId ? `AND sen.id = $${paramIndex}` : ''}
        ORDER BY timestamp DESC
        LIMIT $${sensorId ? paramIndex + 1 : paramIndex}
      `;

      if (sensorId) {
        queryParams.push(sensorId);
        paramIndex++;
      }
      queryParams.push(limit);

      const result = await query(lightQuery, queryParams);

      return result.rows.map(row => ({
        id: row.id.toString(),
        sensorId: row.sensor_id,
        light: row.light,
        whiteLight: row.white_light,
        rawLight: row.raw_light,
        uvIndex: row.uv_index,
        timestamp: row.timestamp
      }));

    } catch (error) {
      console.error('❌ Error in lightData query:', error);
      return [];
    }
  },

  /**
   * Obtiene datos históricos reales de la tabla legacy sensor_data_temhum1
   */
  legacyTemHum1Data: async(_, { limit = 100, from, to }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver datos históricos');
    }

    try {
      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramIndex = 1;

      if (from) {
        whereConditions.push(`timestamp >= $${paramIndex}`);
        queryParams.push(from);
        paramIndex++;
      }

      if (to) {
        whereConditions.push(`timestamp <= $${paramIndex}`);
        queryParams.push(to);
        paramIndex++;
      }

      const legacyQuery = `
        SELECT id, temperature, humidity, timestamp
        FROM sensor_data_temhum1
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY timestamp DESC
        LIMIT $${paramIndex}
      `;

      queryParams.push(limit);

      const result = await query(legacyQuery, queryParams);

      console.log(`📊 Datos legacy TemHum1: ${result.rows.length} registros`);

      return result.rows.map(row => ({
        id: row.id.toString(),
        temperature: row.temperature,
        humidity: row.humidity,
        timestamp: row.timestamp
      }));

    } catch (error) {
      console.error('❌ Error in legacyTemHum1Data query:', error);
      if (error.code === '42P01') {
        console.warn('⚠️ Tabla sensor_data_temhum1 no existe');
        return [];
      }
      throw error;
    }
  },

  /**
   * Obtiene datos históricos reales de la tabla legacy sensor_data_temhum2
   */
  legacyTemHum2Data: async(_, { limit = 100, from, to }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver datos históricos');
    }

    try {
      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramIndex = 1;

      if (from) {
        whereConditions.push(`timestamp >= $${paramIndex}`);
        queryParams.push(from);
        paramIndex++;
      }

      if (to) {
        whereConditions.push(`timestamp <= $${paramIndex}`);
        queryParams.push(to);
        paramIndex++;
      }

      const legacyQuery = `
        SELECT id, temperature, humidity, timestamp
        FROM sensor_data_temhum2
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY timestamp DESC
        LIMIT $${paramIndex}
      `;

      queryParams.push(limit);

      const result = await query(legacyQuery, queryParams);

      console.log(`📊 Datos legacy TemHum2: ${result.rows.length} registros`);

      return result.rows.map(row => ({
        id: row.id.toString(),
        temperature: row.temperature,
        humidity: row.humidity,
        timestamp: row.timestamp
      }));

    } catch (error) {
      console.error('❌ Error in legacyTemHum2Data query:', error);
      if (error.code === '42P01') {
        console.warn('⚠️ Tabla sensor_data_temhum2 no existe');
        return [];
      }
      throw error;
    }
  },

  /**
   * Obtiene datos históricos reales de la tabla legacy sensor_data_calidad_agua
   */
  legacyWaterQualityData: async(_, { limit = 100, from, to }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver datos históricos');
    }

    try {
      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramIndex = 1;

      if (from) {
        whereConditions.push(`timestamp >= $${paramIndex}`);
        queryParams.push(from);
        paramIndex++;
      }

      if (to) {
        whereConditions.push(`timestamp <= $${paramIndex}`);
        queryParams.push(to);
        paramIndex++;
      }

      const legacyQuery = `
        SELECT id, ph, ec, tds, temperature, timestamp
        FROM sensor_data_calidad_agua
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY timestamp DESC
        LIMIT $${paramIndex}
      `;

      queryParams.push(limit);

      const result = await query(legacyQuery, queryParams);

      console.log(`📊 Datos legacy Calidad Agua: ${result.rows.length} registros`);

      return result.rows.map(row => ({
        id: row.id.toString(),
        ph: row.ph,
        ec: row.ec,
        tds: row.tds,
        temperature: row.temperature,
        timestamp: row.timestamp
      }));

    } catch (error) {
      console.error('❌ Error in legacyWaterQualityData query:', error);
      if (error.code === '42P01') {
        console.warn('⚠️ Tabla sensor_data_calidad_agua no existe');
        return [];
      }
      throw error;
    }
  },

  /**
   * Obtiene datos históricos reales de la tabla legacy sensor_data_luxometro
   */
  legacyLightData: async(_, { limit = 100, from, to }, { user }) => {
    if (!user) {
      throw new AuthenticationError('Debe estar autenticado para ver datos históricos');
    }

    try {
      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramIndex = 1;

      if (from) {
        whereConditions.push(`timestamp >= $${paramIndex}`);
        queryParams.push(from);
        paramIndex++;
      }

      if (to) {
        whereConditions.push(`timestamp <= $${paramIndex}`);
        queryParams.push(to);
        paramIndex++;
      }

      const legacyQuery = `
        SELECT id, lux, timestamp
        FROM sensor_data_luxometro
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY timestamp DESC
        LIMIT $${paramIndex}
      `;

      queryParams.push(limit);

      const result = await query(legacyQuery, queryParams);

      console.log(`📊 Datos legacy Luxómetro: ${result.rows.length} registros`);

      return result.rows.map(row => ({
        id: row.id.toString(),
        lux: row.lux,
        timestamp: row.timestamp
      }));

    } catch (error) {
      console.error('❌ Error in legacyLightData query:', error);
      if (error.code === '42P01') {
        console.warn('⚠️ Tabla sensor_data_luxometro no existe');
        return [];
      }
      throw error;
    }
  },

};

module.exports = sensorQueries;
