const deviceService = require('../../../services/deviceService');
const { AuthenticationError, ForbiddenError } = require('apollo-server-express');

/**
 * Device Query Resolvers
 * Handles all device-related GraphQL queries
 */
const deviceQueries = {
  /**
   * Get all devices with optional filtering
   */
  devices: async (parent, { status, type }, context) => {
    try {
      console.log('[DeviceResolver] Getting devices', { status, type, user: context.user?.username });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view devices');
      }

      const filters = {};
      if (status) filters.status = status;
      if (type) filters.type = type;

      const devices = await deviceService.getDevices(filters);
      
      console.log(`[DeviceResolver] Found ${devices.length} devices`);
      return devices;
    } catch (error) {
      console.error('[DeviceResolver] Error in devices query:', error);
      throw error;
    }
  },

  /**
   * Get device by ID
   */
  device: async (parent, { id }, context) => {
    try {
      console.log(`[DeviceResolver] Getting device ${id}`, { user: context.user?.username });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view device details');
      }

      const device = await deviceService.getDeviceById(id);
      
      if (!device) {
        return null;
      }

      console.log(`[DeviceResolver] Found device: ${device.name}`);
      return device;
    } catch (error) {
      console.error(`[DeviceResolver] Error getting device ${id}:`, error);
      if (error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get device history/events
   */
  deviceHistory: async (parent, { deviceId, limit }, context) => {
    try {
      console.log(`[DeviceResolver] Getting history for device ${deviceId}`, { 
        limit, user: context.user?.username 
      });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view device history');
      }

      // Editors and above can view device history
      if (!context.user.role || !['admin', 'editor', 'operator'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to view device history');
      }

      const history = await deviceService.getDeviceHistory(deviceId, { limit });
      
      console.log(`[DeviceResolver] Found ${history.length} history entries`);
      return history;
    } catch (error) {
      console.error(`[DeviceResolver] Error getting history for device ${deviceId}:`, error);
      throw error;
    }
  }
};

module.exports = deviceQueries;