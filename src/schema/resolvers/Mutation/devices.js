const deviceService = require('../../../services/deviceService');
const { AuthenticationError, ForbiddenError } = require('apollo-server-express');
const { pubsub, SENSOR_EVENTS } = require('../../../utils/pubsub');

/**
 * Device Mutation Resolvers
 * Handles all device control and management operations
 */
const deviceMutations = {
  /**
   * Create a new device
   */
  createDevice: async (parent, { input }, context) => {
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
  updateDevice: async (parent, { id, input }, context) => {
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
  deleteDevice: async (parent, { id }, context) => {
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
  toggleDevice: async (parent, { id }, context) => {
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
  setDeviceValue: async (parent, { id, value }, context) => {
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
  resetDevice: async (parent, { id }, context) => {
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
  toggleMultipleDevices: async (parent, { ids }, context) => {
    try {
      console.log(`[DeviceMutation] Toggling multiple devices`, { ids, user: context.user?.username });
      
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
  }
};

module.exports = deviceMutations;