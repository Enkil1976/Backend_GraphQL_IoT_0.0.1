const deviceService = require('../../../services/deviceService');
const notificationService = require('../../../services/notificationService');
const { AuthenticationError, ForbiddenError } = require('apollo-server-express');
const { pubsub, SENSOR_EVENTS } = require('../../../utils/pubsub');

/**
 * Send device control notification
 * @param {Object} device - Device object
 * @param {string} action - Action performed (ON, OFF, TOGGLE, etc.)
 * @param {Object} user - User who performed the action
 * @param {string} previousStatus - Previous device status
 */
async function sendDeviceNotification(device, action, user, previousStatus = null) {
  try {
    // Check if device has notifications enabled (default: true)
    if (device.enable_notifications === false) {
      return;
    }

    // Determine action type and emoji
    let actionText, emoji, severity;
    switch (action.toUpperCase()) {
    case 'ON':
      actionText = 'encendido';
      emoji = '🟢';
      severity = 'MEDIUM';
      break;
    case 'OFF':
      actionText = 'apagado';
      emoji = '🔴';
      severity = 'MEDIUM';
      break;
    case 'TOGGLE':
      actionText = device.status === 'ON' ? 'encendido' : 'apagado';
      emoji = device.status === 'ON' ? '🟢' : '🔴';
      severity = 'MEDIUM';
      break;
    case 'RESET':
      actionText = 'reiniciado';
      emoji = '🔄';
      severity = 'HIGH';
      break;
    case 'VALUE_CHANGE':
      actionText = `ajustado a ${device.value || 'valor personalizado'}`;
      emoji = '⚙️';
      severity = 'LOW';
      break;
    default:
      actionText = 'modificado';
      emoji = '🔧';
      severity = 'MEDIUM';
    }

    // Create notification message with current timestamp
    const currentTime = new Date().toLocaleString('es-ES', {
      timeZone: 'America/Mexico_City',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const title = `${emoji} Dispositivo ${actionText}`;
    const message = `El dispositivo "${device.name}" ha sido ${actionText} por ${user.username}.
    
📍 Ubicación: ${device.location || 'Invernadero'}
⚡ Estado actual: ${device.status}
🕐 Hora: ${currentTime}
👤 Usuario: ${user.username}`;

    // Send notification via webhook (WhatsApp)
    await notificationService.sendNotification({
      title,
      message,
      priority: severity.toLowerCase(),
      channels: ['whatsapp'],
      canal: 'whatsapp',
      targetChannel: 'webhook',
      metadata: {
        device_id: device.id,
        device_name: device.name,
        device_type: device.type,
        action_performed: action,
        previous_status: previousStatus,
        user_id: user.id,
        username: user.username,
        timestamp: new Date().toISOString(),
        source: 'device_control'
      }
    });

    console.log(`📱 Sent device notification: ${device.name} ${actionText} by ${user.username}`);
  } catch (error) {
    console.error('❌ Error sending device notification:', error);
    // Don't throw error to avoid breaking device control
  }
}

/**
 * Device Mutation Resolvers
 * Handles all device control and management operations
 */
const deviceMutations = {
  /**
   * Create a new device
   */
  createDevice: async(parent, { input }, context) => {
    try {
      console.log('[DeviceMutation] Creating device', { input, user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to create devices');
      }

      // Admin or editor permission required
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to create devices');
      }

      // Add creator info to device and map deviceId to device_id
      const deviceData = {
        ...input,
        device_id: input.deviceId, // Map GraphQL field to database field
        created_by: context.user.id
      };

      // Remove deviceId to avoid conflicts
      delete deviceData.deviceId;

      const device = await deviceService.createDevice(deviceData);

      console.log(`[DeviceMutation] Created device: ${device.name} (ID: ${device.id})`);

      // Publish device creation event
      await pubsub.publish(SENSOR_EVENTS.DEVICE_CREATED, {
        deviceCreated: device
      });

      return device;
    } catch (error) {
      console.error('[DeviceMutation] Error creating device:', error);
      throw error;
    }
  },

  /**
   * Update device properties
   */
  updateDevice: async(parent, { id, input }, context) => {
    try {
      console.log(`[DeviceMutation] Updating device ${id}`, { input, user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to update devices');
      }

      // Admin or editor permission required
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to update devices');
      }

      const device = await deviceService.updateDevice(id, input);

      console.log(`[DeviceMutation] Updated device: ${device.name}`);

      // Publish device update event
      await pubsub.publish(SENSOR_EVENTS.DEVICE_UPDATED, {
        deviceUpdated: device
      });

      return device;
    } catch (error) {
      console.error(`[DeviceMutation] Error updating device ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete a device
   */
  deleteDevice: async(parent, { id }, context) => {
    try {
      console.log(`[DeviceMutation] Deleting device ${id}`, { user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to delete devices');
      }

      // Admin permission required
      if (!context.user.role || context.user.role !== 'admin') {
        throw new ForbiddenError('Only administrators can delete devices');
      }

      const result = await deviceService.deleteDevice(id);

      console.log(`[DeviceMutation] Deleted device ${id}: ${result}`);

      // Publish device deletion event
      await pubsub.publish(SENSOR_EVENTS.DEVICE_DELETED, {
        deviceDeleted: { id, deletedAt: new Date().toISOString() }
      });

      return result;
    } catch (error) {
      console.error(`[DeviceMutation] Error deleting device ${id}:`, error);
      throw error;
    }
  },

  /**
   * Toggle device on/off
   */
  toggleDevice: async(parent, { id }, context) => {
    try {
      console.log(`[DeviceMutation] Toggling device ${id}`, { user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to control devices');
      }

      // Operator permission or above required
      if (!context.user.role || !['admin', 'editor', 'operator'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to control devices');
      }

      const device = await deviceService.toggleDevice(id);

      console.log(`[DeviceMutation] Toggled device ${id} to status: ${device.status}`);

      // Send device control notification
      await sendDeviceNotification(device, 'TOGGLE', context.user);

      // Publish status change event
      await pubsub.publish(SENSOR_EVENTS.DEVICE_STATUS_CHANGED, {
        deviceStatusChanged: device
      });

      return device;
    } catch (error) {
      console.error(`[DeviceMutation] Error toggling device ${id}:`, error);
      throw error;
    }
  },

  /**
   * Set device value (for dimmers, valves, etc.)
   */
  setDeviceValue: async(parent, { id, value }, context) => {
    try {
      console.log(`[DeviceMutation] Setting device ${id} value to ${value}`, { user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to control devices');
      }

      // Operator permission or above required
      if (!context.user.role || !['admin', 'editor', 'operator'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to control devices');
      }

      const device = await deviceService.setDeviceValue(id, value);

      console.log(`[DeviceMutation] Set device ${id} value to: ${value}`);

      // Send device control notification
      await sendDeviceNotification(device, 'VALUE_CHANGE', context.user);

      // Publish status change event
      await pubsub.publish(SENSOR_EVENTS.DEVICE_STATUS_CHANGED, {
        deviceStatusChanged: device
      });

      return device;
    } catch (error) {
      console.error(`[DeviceMutation] Error setting device ${id} value:`, error);
      throw error;
    }
  },

  /**
   * Reset device to default state
   */
  resetDevice: async(parent, { id }, context) => {
    try {
      console.log(`[DeviceMutation] Resetting device ${id}`, { user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to reset devices');
      }

      // Editor permission or above required
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to reset devices');
      }

      const device = await deviceService.resetDevice(id);

      console.log(`[DeviceMutation] Reset device ${id}`);

      // Send device control notification
      await sendDeviceNotification(device, 'RESET', context.user);

      // Publish status change event
      await pubsub.publish(SENSOR_EVENTS.DEVICE_STATUS_CHANGED, {
        deviceStatusChanged: device
      });

      return device;
    } catch (error) {
      console.error(`[DeviceMutation] Error resetting device ${id}:`, error);
      throw error;
    }
  },

  /**
   * Toggle multiple devices at once
   */
  toggleMultipleDevices: async(parent, { ids }, context) => {
    try {
      console.log('[DeviceMutation] Toggling multiple devices', { ids, user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to control devices');
      }

      // Operator permission or above required
      if (!context.user.role || !['admin', 'editor', 'operator'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to control devices');
      }

      const devices = [];

      // Process each device
      for (const id of ids) {
        try {
          const device = await deviceService.toggleDevice(id);
          devices.push(device);

          // Send device control notification
          await sendDeviceNotification(device, 'TOGGLE', context.user);

          // Publish individual status change events
          await pubsub.publish(SENSOR_EVENTS.DEVICE_STATUS_CHANGED, {
            deviceStatusChanged: device
          });
        } catch (error) {
          console.error(`[DeviceMutation] Error toggling device ${id}:`, error);
          // Continue with other devices
        }
      }

      console.log(`[DeviceMutation] Toggled ${devices.length}/${ids.length} devices`);
      return devices;
    } catch (error) {
      console.error('[DeviceMutation] Error toggling multiple devices:', error);
      throw error;
    }
  },

  /**
   * Turn ON a device (explicit control)
   */
  turnOnDevice: async(parent, { id }, context) => {
    try {
      console.log(`[DeviceMutation] Turning ON device ${id}`, { user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to control devices');
      }

      // Operator permission or above required
      if (!context.user.role || !['admin', 'editor', 'operator'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to control devices');
      }

      const device = await deviceService.updateDeviceStatus(id, 'on');

      console.log(`[DeviceMutation] Turned ON device ${id}: ${device.name}`);

      // Send device control notification
      await sendDeviceNotification(device, 'ON', context.user);

      // Publish status change event
      await pubsub.publish(SENSOR_EVENTS.DEVICE_STATUS_CHANGED, {
        deviceStatusChanged: device
      });

      return device;
    } catch (error) {
      console.error(`[DeviceMutation] Error turning ON device ${id}:`, error);
      throw error;
    }
  },

  /**
   * Turn OFF a device (explicit control)
   */
  turnOffDevice: async(parent, { id }, context) => {
    try {
      console.log(`[DeviceMutation] Turning OFF device ${id}`, { user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to control devices');
      }

      // Operator permission or above required
      if (!context.user.role || !['admin', 'editor', 'operator'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to control devices');
      }

      const device = await deviceService.updateDeviceStatus(id, 'off');

      console.log(`[DeviceMutation] Turned OFF device ${id}: ${device.name}`);

      // Send device control notification
      await sendDeviceNotification(device, 'OFF', context.user);

      // Publish status change event
      await pubsub.publish(SENSOR_EVENTS.DEVICE_STATUS_CHANGED, {
        deviceStatusChanged: device
      });

      return device;
    } catch (error) {
      console.error(`[DeviceMutation] Error turning OFF device ${id}:`, error);
      throw error;
    }
  }
};

module.exports = deviceMutations;
