const { query } = require('../config/database');
const { cache } = require('../config/redis');
const { pubsub, SENSOR_EVENTS } = require('../utils/pubsub');
const mqttService = require('./mqttService');

/**
 * Device Service for GraphQL Backend
 * Handles device CRUD operations, status management, and real-time updates
 * Adapted from REST backend with GraphQL-specific enhancements
 */
class DeviceService {
  constructor() {
    this.allowedStatuses = ['online', 'offline', 'active', 'inactive', 'error', 'on', 'off'];
  }

  /**
   * Initialize device service (for compatibility with original backend architecture)
   * @param {Object} dependencies - Service dependencies
   */
  initDeviceService(dependencies) {
    // For GraphQL backend, we use pubsub instead of WebSocket callbacks
    console.log('DeviceService: Initialized for GraphQL backend with PubSub');
  }

  /**
   * Create a new device
   * @param {Object} deviceData - Device creation data
   * @returns {Object} Created device
   */
  async createDevice(deviceData) {
    const {
      name,
      device_id,
      type,
      description,
      status = 'offline',
      config = {},
      room_id,
      owner_user_id
    } = deviceData;

    if (!name || !device_id || !type) {
      throw new Error('Name, device_id, and type are required for creating a device.');
    }

    // Validate status
    if (status && !this.allowedStatuses.includes(status)) {
      throw new Error(`Invalid status. Allowed values: ${this.allowedStatuses.join(', ')}`);
    }

    try {
      const result = await query(
        `INSERT INTO devices (name, device_id, type, description, status, configuration, room, owner_user_id, last_seen, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING *`,
        [name, device_id, type, description, status, JSON.stringify(config), room_id, owner_user_id, null]
      );

      const newDevice = result.rows[0];
      console.log(`Device created: ${newDevice.name} (ID: ${newDevice.id}), Owner User ID: ${newDevice.owner_user_id}`);

      // Cache device in Redis
      await cache.set(`device:${newDevice.id}`, newDevice, 3600);
      await cache.set(`device:${newDevice.id}:status`, newDevice.status, 3600);

      // Publish GraphQL subscription event
      await pubsub.publish(SENSOR_EVENTS.DEVICE_CREATED, {
        deviceCreated: newDevice
      });

      return newDevice;
    } catch (err) {
      console.error(`Error in createDevice (device_id: ${device_id}): ${err.message}`);

      if (err.code === '23505') { // Unique violation
        throw new Error(`Device with this name or device_id already exists. (${err.constraint})`);
      }
      throw err;
    }
  }

  /**
   * Get all devices with optional filtering
   * @param {Object} params - Filter parameters
   * @returns {Array} List of devices
   */
  async getDevices(params = {}) {
    let queryStr = `
      SELECT d.*, u.username as owner_username 
      FROM devices d 
      LEFT JOIN users u ON d.owner_user_id = u.id
      WHERE 1=1
    `;
    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (params.type) {
      conditions.push(`d.type = $${paramCount++}`);
      values.push(params.type);
    }
    if (params.status) {
      conditions.push(`d.status = $${paramCount++}`);
      values.push(params.status);
    }
    if (params.room_id) {
      conditions.push(`d.room = $${paramCount++}`);
      values.push(params.room_id);
    }
    if (params.owner_user_id) {
      conditions.push(`d.owner_user_id = $${paramCount++}`);
      values.push(params.owner_user_id);
    }

    if (conditions.length > 0) {
      queryStr += ' AND ' + conditions.join(' AND ');
    }
    queryStr += ' ORDER BY d.created_at DESC';

    try {
      const result = await query(queryStr, values);

      // Cache results in Redis for 5 minutes
      const cacheKey = `devices:list:${JSON.stringify(params)}`;
      await cache.set(cacheKey, result.rows, 300);

      return result.rows;
    } catch (err) {
      console.error('Error in getDevices:', err);
      throw err;
    }
  }

  /**
   * Get device by ID
   * @param {string} id - Device ID
   * @returns {Object} Device data
   */
  async getDeviceById(id) {
    const deviceIdInt = parseInt(id, 10);
    if (isNaN(deviceIdInt)) {
      throw new Error('Invalid device ID format.');
    }

    // Try cache first
    const cached = await cache.get(`device:${deviceIdInt}`);
    if (cached) {
      return cached;
    }

    try {
      const result = await query(
        `SELECT d.*, u.username as owner_username 
         FROM devices d 
         LEFT JOIN users u ON d.owner_user_id = u.id
         WHERE d.id = $1`,
        [deviceIdInt]
      );

      if (result.rows.length === 0) {
        throw new Error('Device not found.');
      }

      const device = result.rows[0];

      // Cache for 1 hour
      await cache.set(`device:${deviceIdInt}`, device, 3600);

      return device;
    } catch (err) {
      console.error(`Error in getDeviceById (ID: ${id}):`, err);
      throw err;
    }
  }

  /**
   * Update device
   * @param {string} id - Device ID
   * @param {Object} updateData - Update data
   * @returns {Object} Updated device
   */
  async updateDevice(id, updateData) {
    const deviceIdInt = parseInt(id, 10);
    if (isNaN(deviceIdInt)) {
      throw new Error('Invalid device ID format.');
    }

    const { name, type, description, status, config, room_id, owner_user_id, last_seen_at } = updateData;
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) { fields.push(`name = $${paramCount++}`); values.push(name); }
    if (type !== undefined) { fields.push(`type = $${paramCount++}`); values.push(type); }
    if (description !== undefined) { fields.push(`description = $${paramCount++}`); values.push(description); }
    if (status !== undefined) {
      // Validate status
      if (!this.allowedStatuses.includes(status)) {
        throw new Error(`Invalid status. Allowed values: ${this.allowedStatuses.join(', ')}`);
      }
      fields.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (config !== undefined) { fields.push(`configuration = $${paramCount++}`); values.push(JSON.stringify(config)); }
    if (room_id !== undefined) { fields.push(`room = $${paramCount++}`); values.push(room_id); }
    if (owner_user_id !== undefined) { fields.push(`owner_user_id = $${paramCount++}`); values.push(owner_user_id === null ? null : parseInt(owner_user_id, 10)); }
    if (last_seen_at !== undefined) { fields.push(`last_seen = $${paramCount++}`); values.push(last_seen_at); }

    if (fields.length === 0) {
      throw new Error('No fields provided for update.');
    }
    values.push(deviceIdInt);

    try {
      const queryStr = `UPDATE devices SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;
      const result = await query(queryStr, values);

      if (result.rows.length === 0) {
        throw new Error('Device not found for update.');
      }

      const updatedDevice = result.rows[0];
      console.log(`Device updated: ${updatedDevice.name} (ID: ${id}), Owner User ID: ${updatedDevice.owner_user_id}`);

      // Update cache
      await cache.set(`device:${deviceIdInt}`, updatedDevice, 3600);
      if (status !== undefined) {
        await cache.set(`device:${deviceIdInt}:status`, status, 3600);
      }

      // Clear devices list cache
      await cache.del('devices:list:*');

      // Publish GraphQL subscription events
      await pubsub.publish(SENSOR_EVENTS.DEVICE_UPDATED, {
        deviceUpdated: updatedDevice
      });

      return updatedDevice;
    } catch (err) {
      console.error(`Error in updateDevice (ID: ${id}): ${err.message}`);

      if (err.code === '23505') {
        throw new Error(`Update failed: Another device with this name or device_id might exist. (${err.constraint})`);
      }
      throw err;
    }
  }

  /**
   * Delete device
   * @param {string} id - Device ID
   * @returns {Object} Deletion result
   */
  async deleteDevice(id) {
    const deviceIdInt = parseInt(id, 10);
    if (isNaN(deviceIdInt)) {
      throw new Error('Invalid device ID format.');
    }

    try {
      // Fetch device data before deleting for notifications
      const deviceDataResult = await query('SELECT name, owner_user_id FROM devices WHERE id = $1', [deviceIdInt]);
      const deviceToNotify = deviceDataResult.rows[0];

      const result = await query('DELETE FROM devices WHERE id = $1 RETURNING *', [deviceIdInt]);

      if (result.rows.length === 0) {
        throw new Error('Device not found for deletion.');
      }

      const deletedDeviceData = result.rows[0];
      console.log(`Device deleted: ${deletedDeviceData.name} (ID: ${id})`);

      // Clear cache
      await cache.del(`device:${deviceIdInt}`);
      await cache.del(`device:${deviceIdInt}:status`);
      await cache.del('devices:list:*');

      // Publish GraphQL subscription events
      await pubsub.publish(SENSOR_EVENTS.DEVICE_DELETED, {
        deviceDeleted: { id: deletedDeviceData.id, name: deletedDeviceData.name }
      });

      return {
        message: 'Device deleted successfully',
        id: deletedDeviceData.id,
        name: deletedDeviceData.name
      };
    } catch (err) {
      console.error(`Error in deleteDevice (ID: ${id}): ${err.message}`);
      throw err;
    }
  }

  /**
   * Update device status
   * @param {string} id - Device ID
   * @param {string} newStatus - New status
   * @returns {Object} Updated device
   */
  async updateDeviceStatus(id, newStatus) {
    const deviceIdInt = parseInt(id, 10);
    if (isNaN(deviceIdInt)) {
      throw new Error('Invalid device ID format.');
    }

    if (newStatus === undefined || newStatus === null || typeof newStatus !== 'string' || newStatus.trim() === '') {
      throw new Error('Status is required and must be a non-empty string.');
    }

    if (!this.allowedStatuses.includes(newStatus.toLowerCase())) {
      throw new Error(`Invalid status value: '${newStatus}'.`);
    }

    try {
      const result = await query(
        `UPDATE devices
         SET status = $1, updated_at = NOW(), last_seen = NOW()
         WHERE id = $2
         RETURNING *`,
        [newStatus, deviceIdInt]
      );

      if (result.rows.length === 0) {
        throw new Error('Device not found for status update.');
      }

      const updatedDeviceWithStatus = result.rows[0];
      console.log(`Device status updated: ${updatedDeviceWithStatus.name} (ID: ${id}) to ${newStatus}`);

      // Send MQTT command to physical device
      await this.sendMqttCommand(updatedDeviceWithStatus, newStatus);

      // Update cache
      await cache.set(`device:${deviceIdInt}`, updatedDeviceWithStatus, 3600);
      await cache.set(`device:${deviceIdInt}:status`, newStatus, 3600);

      // Publish GraphQL subscription events
      await pubsub.publish(SENSOR_EVENTS.DEVICE_STATUS_CHANGED, {
        deviceStatusChanged: {
          device: updatedDeviceWithStatus,
          previousStatus: updatedDeviceWithStatus.status,
          newStatus: newStatus
        }
      });

      return updatedDeviceWithStatus;
    } catch (err) {
      console.error(`Error in updateDeviceStatus (ID: ${id}, Status: ${newStatus}): ${err.message}`);
      throw err;
    }
  }

  /**
   * Set device configuration
   * @param {string} dbDeviceId - Device database ID
   * @param {Object} newConfig - New configuration
   * @returns {Object} Updated device
   */
  async setDeviceConfiguration(dbDeviceId, newConfig) {
    console.log(`Attempting to set configuration for device ID ${dbDeviceId}:`, newConfig);

    const deviceIdInt = parseInt(dbDeviceId, 10);
    if (isNaN(deviceIdInt) || deviceIdInt <= 0) {
      throw new Error('Invalid device database ID provided for setDeviceConfiguration.');
    }

    if (typeof newConfig !== 'object' || newConfig === null) {
      throw new Error('Invalid newConfig provided; must be an object.');
    }

    try {
      const result = await query(
        `UPDATE devices
         SET configuration = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify(newConfig), deviceIdInt]
      );

      if (result.rows.length === 0) {
        throw new Error(`Device with database ID ${deviceIdInt} not found for config update.`);
      }

      const updatedDevice = result.rows[0];
      console.log(`Configuration updated for device ${updatedDevice.name} (ID: ${deviceIdInt}). New config:`, updatedDevice.configuration);

      // Update cache
      await cache.set(`device:${deviceIdInt}`, updatedDevice, 3600);

      // Publish GraphQL subscription events
      await pubsub.publish(SENSOR_EVENTS.DEVICE_CONFIGURATION_CHANGED, {
        deviceConfigurationChanged: {
          device: updatedDevice,
          configuration: newConfig
        }
      });

      return updatedDevice;
    } catch (err) {
      console.error(`Error in setDeviceConfiguration for device ID ${deviceIdInt}:`, err);
      if (err.message.includes('not found')) throw err;
      throw new Error('Failed to set device configuration.');
    }
  }

  /**
   * Get device consumption history (power monitoring data)
   * @param {string} monitoredDeviceId - Monitored device ID
   * @param {Object} queryParams - Query parameters
   * @returns {Object} Consumption history data
   */
  async getDeviceConsumptionHistory(monitoredDeviceId, queryParams = {}) {
    console.log(`Fetching consumption history for monitored device ID ${monitoredDeviceId} with params: ${JSON.stringify(queryParams)}`);

    const deviceIdInt = parseInt(monitoredDeviceId, 10);
    if (isNaN(deviceIdInt) || deviceIdInt <= 0) {
      throw new Error('Invalid monitored_device_id provided.');
    }

    const conditions = ['pml.device_id = $1'];
    const values = [deviceIdInt];
    let paramCount = 2;

    if (queryParams.startDate) {
      conditions.push(`pml.received_at >= $${paramCount++}`);
      values.push(queryParams.startDate);
    }
    if (queryParams.endDate) {
      conditions.push(`pml.received_at <= $${paramCount++}`);
      values.push(queryParams.endDate);
    }
    if (queryParams.lastHours && !queryParams.startDate && !queryParams.endDate) {
      const hours = parseInt(queryParams.lastHours, 10);
      if (!isNaN(hours) && hours > 0) {
        conditions.push(`pml.received_at >= NOW() - INTERVAL '${hours} hours'`);
      } else {
        console.warn(`Invalid lastHours parameter: ${queryParams.lastHours}. Ignoring.`);
      }
    }

    const orderBy = 'pml.received_at DESC';
    const limit = parseInt(queryParams.limit, 10) || 100;
    const page = parseInt(queryParams.page, 10) || 1;
    const offset = (page - 1) * limit;

    const dataQueryString = `
      SELECT pml.id, pml.device_id, pml.voltage, pml.current, pml.watts as power, pml.received_at
      FROM power_monitor_logs pml
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT $${paramCount++}
      OFFSET $${paramCount++}
    `;
    const dataValues = [...values, limit, offset];

    const countConditionsString = conditions.join(' AND ');
    const countQueryString = `SELECT COUNT(*) FROM power_monitor_logs pml WHERE ${countConditionsString}`;

    try {
      // Verify device exists
      const deviceExistsResult = await query('SELECT id FROM devices WHERE id = $1', [deviceIdInt]);
      if (deviceExistsResult.rows.length === 0) {
        throw new Error(`Device with id ${deviceIdInt} not found (the device supposed to be monitored).`);
      }

      const result = await query(dataQueryString, dataValues);
      const totalCountResult = await query(countQueryString, values);
      const totalRecords = parseInt(totalCountResult.rows[0].count, 10);

      return {
        data: result.rows,
        meta: { page, limit, totalRecords, totalPages: Math.ceil(totalRecords / limit) }
      };
    } catch (err) {
      if (err.message.includes('not found')) throw err;
      console.error(`Error fetching consumption history for device ID ${deviceIdInt}: ${err.message}`);
      throw new Error('Failed to retrieve consumption history.');
    }
  }

  /**
   * Get devices by room
   * @param {string} room - Room name
   * @returns {Array} List of devices
   */
  async getDevicesByRoom(room) {
    try {
      const result = await query(
        `SELECT d.*, u.username as owner_username 
         FROM devices d 
         LEFT JOIN users u ON d.owner_user_id = u.id
         WHERE d.room = $1
         ORDER BY d.created_at DESC`,
        [room]
      );

      return result.rows;
    } catch (err) {
      console.error(`Error in getDevicesByRoom for room ${room}:`, err);
      throw err;
    }
  }

  /**
   * Get device statistics
   * @returns {Object} Device statistics
   */
  async getDeviceStats() {
    try {
      // Try cache first
      const cached = await cache.get('device:stats');
      if (cached) {
        return cached;
      }

      const result = await query(`
        SELECT 
          COUNT(*) as total_devices,
          COUNT(CASE WHEN status = 'online' THEN 1 END) as online_devices,
          COUNT(CASE WHEN status = 'offline' THEN 1 END) as offline_devices,
          COUNT(CASE WHEN status = 'error' THEN 1 END) as error_devices,
          COUNT(DISTINCT room) as total_rooms,
          COUNT(DISTINCT type) as total_types
        FROM devices
      `);

      const stats = result.rows[0];

      // Cache for 5 minutes
      await cache.set('device:stats', stats, 300);

      return stats;
    } catch (err) {
      console.error('Error in getDeviceStats:', err);
      throw err;
    }
  }

  /**
   * Get device configuration
   * @param {string} id - Device ID
   * @returns {Object} Device configuration
   */
  async getDeviceConfiguration(id) {
    try {
      const result = await query(
        'SELECT configuration FROM devices WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error('Device not found');
      }

      return result.rows[0].configuration || {};
    } catch (err) {
      console.error(`Error in getDeviceConfiguration for device ${id}:`, err);
      throw err;
    }
  }

  /**
   * Get device history/events
   * @param {string} deviceId - Device ID
   * @param {Object} options - Query options
   * @returns {Array} Device events
   */
  async getDeviceHistory(deviceId, options = {}) {
    const { limit = 50 } = options;

    try {
      // For now, we'll create mock history based on device operations
      // In a real system, this would query a device_events table
      const device = await this.getDeviceById(deviceId);

      if (!device) {
        throw new Error('Device not found');
      }

      // Mock events for demonstration
      const events = [
        {
          id: `${deviceId}_${Date.now()}`,
          device_id: deviceId,
          eventType: 'STATUS_CHANGED',
          timestamp: device.updated_at,
          newValue: device.status === 'online' ? 1 : 0,
          previousValue: device.status === 'online' ? 0 : 1,
          message: `Device ${device.status === 'online' ? 'came online' : 'went offline'}`,
          success: true,
          source: 'SYSTEM'
        }
      ];

      return events.slice(0, limit);
    } catch (err) {
      console.error(`Error in getDeviceHistory for device ${deviceId}:`, err);
      throw err;
    }
  }

  /**
   * Toggle device on/off
   * @param {string} id - Device ID
   * @returns {Object} Updated device
   */
  async toggleDevice(id) {
    try {
      const device = await this.getDeviceById(id);

      if (!device) {
        throw new Error('Device not found');
      }

      // Determine new status based on current status
      let newStatus;
      if (device.status === 'on' || device.status === 'online' || device.status === 'active') {
        newStatus = 'off';
      } else {
        newStatus = 'on';
      }

      // Send MQTT command with toggle action
      await this.sendMqttCommand(device, 'toggle');

      return await this.updateDeviceStatus(id, newStatus);
    } catch (err) {
      console.error(`Error in toggleDevice for device ${id}:`, err);
      throw err;
    }
  }

  /**
   * Set device value (for dimmers, valves, etc.)
   * @param {string} id - Device ID
   * @param {number} value - Value to set
   * @returns {Object} Updated device
   */
  async setDeviceValue(id, value) {
    try {
      const deviceIdInt = parseInt(id, 10);
      if (isNaN(deviceIdInt)) {
        throw new Error('Invalid device ID format.');
      }

      if (value === undefined || value === null || typeof value !== 'number') {
        throw new Error('Value is required and must be a number.');
      }

      // Update device configuration with the new value
      const currentConfig = await this.getDeviceConfiguration(id);
      const newConfig = {
        ...currentConfig,
        value: value,
        last_value_update: new Date().toISOString()
      };

      await this.setDeviceConfiguration(deviceIdInt, newConfig);

      // Get the updated device
      const updatedDevice = await this.getDeviceById(id);

      // Add the value to the device object
      updatedDevice.value = value;

      // Publish configuration change event
      await pubsub.publish(SENSOR_EVENTS.DEVICE_CONFIGURATION_CHANGED, {
        deviceConfigurationChanged: updatedDevice
      });

      return updatedDevice;
    } catch (err) {
      console.error(`Error in setDeviceValue for device ${id}:`, err);
      throw err;
    }
  }

  /**
   * Reset device to default state
   * @param {string} id - Device ID
   * @returns {Object} Updated device
   */
  async resetDevice(id) {
    try {
      const deviceIdInt = parseInt(id, 10);
      if (isNaN(deviceIdInt)) {
        throw new Error('Invalid device ID format.');
      }

      // Reset device configuration to defaults
      const defaultConfig = {
        reset_timestamp: new Date().toISOString(),
        value: 0,
        brightness: 0,
        speed: 0,
        temperature_setpoint: 20
      };

      await this.setDeviceConfiguration(deviceIdInt, defaultConfig);

      // Set device to offline status
      const updatedDevice = await this.updateDeviceStatus(id, 'offline');

      return updatedDevice;
    } catch (err) {
      console.error(`Error in resetDevice for device ${id}:`, err);
      throw err;
    }
  }

  /**
   * Send MQTT command to device based on device type and action
   * @param {Object} device - Device object
   * @param {string} action - Action to perform (on/off/toggle)
   * @param {number} value - Optional value for dimmers, etc.
   */
  async sendMqttCommand(device, action, value = null) {
    try {
      if (!device) {
        console.warn('Cannot send MQTT command: device is missing');
        return;
      }

      // Use device_id if available, otherwise use device name or ID as fallback
      const deviceIdentifier = device.device_id || device.name || device.id;

      let topic, payload;

      // Map device types to MQTT topics and payloads
      switch (device.type?.toLowerCase()) {
      case 'fan':
      case 'ventilator':
        topic = 'Invernadero/Ventilador/sw';
        payload = { ventiladorSw: action === 'on' || action === 'toggle' };
        break;

      case 'water_pump':
      case 'pump':
        topic = 'Invernadero/Bomba/sw';
        payload = { bombaSw: action === 'on' || action === 'toggle' };
        break;

      case 'heater':
        topic = 'Invernadero/Calefactor/sw';
        payload = { calefactorSw: action === 'on' || action === 'toggle' };
        break;

      case 'water_heater':
        topic = 'Invernadero/CalefactorAgua/sw';
        payload = { calefactorAguaSw: action === 'on' || action === 'toggle' };
        break;

      case 'lights':
      case 'led':
        topic = `Invernadero/${deviceIdentifier}/sw`;
        if (value !== null) {
          payload = { brightness: value, power: action === 'on' };
        } else {
          payload = { power: action === 'on' || action === 'toggle' };
        }
        break;

      default:
        // Generic device control
        topic = `Invernadero/${deviceIdentifier}/sw`;
        payload = { state: action === 'on' || action === 'toggle' };
        break;
      }

      if (topic && payload) {
        console.log(`📡 Sending MQTT command to ${topic}:`, payload);
        await mqttService.publish(topic, payload);
        console.log(`✅ MQTT command sent successfully for device ${device.name}`);
      } else {
        console.warn(`⚠️ No MQTT mapping found for device type: ${device.type}`);
      }
    } catch (error) {
      console.error(`❌ Error sending MQTT command for device ${device.name}:`, error);
      // Don't throw error to prevent breaking the device status update
    }
  }
}

module.exports = new DeviceService();
