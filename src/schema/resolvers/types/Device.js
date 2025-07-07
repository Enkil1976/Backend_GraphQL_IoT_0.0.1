const deviceService = require('../../../services/deviceService');
const userService = require('../../../services/authService');

/**
 * Device Type Resolvers
 * Handles nested field resolution for Device type
 */
const Device = {
  /**
   * Resolve owner user for device
   */
  owner: async (device, args, context) => {
    try {
      if (!device.created_by) {
        return null;
      }
      
      // Get user by ID
      return await userService.getUserById(device.created_by);
    } catch (error) {
      console.error(`[DeviceTypeResolver] Error getting owner for device ${device.id}:`, error);
      return null;
    }
  },

  /**
   * Resolve created by user for device
   */
  createdBy: async (device, args, context) => {
    try {
      if (!device.created_by) {
        return null;
      }
      
      return await userService.getUserById(device.created_by);
    } catch (error) {
      console.error(`[DeviceTypeResolver] Error getting creator for device ${device.id}:`, error);
      return null;
    }
  },

  /**
   * Get latest event for this device
   */
  lastEvent: async (device, args, context) => {
    try {
      console.log(`[DeviceTypeResolver] Getting latest event for device ${device.id}`);
      
      const events = await deviceService.getDeviceHistory(device.id, { limit: 1 });
      return events.length > 0 ? events[0] : null;
    } catch (error) {
      console.error(`[DeviceTypeResolver] Error getting latest event for device ${device.id}:`, error);
      return null;
    }
  },

  /**
   * Get recent events for this device
   */
  events: async (device, { limit = 10 }, context) => {
    try {
      console.log(`[DeviceTypeResolver] Getting events for device ${device.id}`, { limit });
      
      return await deviceService.getDeviceHistory(device.id, { limit });
    } catch (error) {
      console.error(`[DeviceTypeResolver] Error getting events for device ${device.id}:`, error);
      return [];
    }
  },

  /**
   * Resolve device capabilities
   */
  capabilities: async (device, args, context) => {
    try {
      // Parse capabilities from configuration or derive from device type
      let capabilities = [];
      
      // Try to get capabilities from device configuration
      if (device.configuration && device.configuration.capabilities) {
        capabilities = device.configuration.capabilities;
      } else {
        // Generate default capabilities based on device type
        capabilities = generateDefaultCapabilities(device.type);
      }
      
      return capabilities.map(cap => ({
        name: cap.name,
        type: cap.type || 'BOOLEAN',
        readable: cap.readable !== false,
        writable: cap.writable !== false,
        unit: cap.unit || null,
        minValue: cap.minValue || null,
        maxValue: cap.maxValue || null,
        allowedValues: cap.allowedValues || null
      }));
    } catch (error) {
      console.error(`[DeviceTypeResolver] Error getting capabilities for device ${device.id}:`, error);
      return [];
    }
  },

  /**
   * Calculate maintenance status
   */
  maintenanceStatus: async (device, args, context) => {
    try {
      // Simple maintenance status logic based on device age and usage
      const now = new Date();
      const createdAt = new Date(device.created_at);
      const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);
      
      // Check if device has been offline for too long
      if (device.last_seen) {
        const lastSeen = new Date(device.last_seen);
        const hoursOffline = (now - lastSeen) / (1000 * 60 * 60);
        
        if (hoursOffline > 24) {
          return 'ERROR';
        }
      }
      
      // Basic maintenance schedule based on device type
      let maintenanceDays = 90; // Default 3 months
      
      switch (device.type) {
        case 'WATER_PUMP':
        case 'MOTOR':
          maintenanceDays = 60; // 2 months for high-wear devices
          break;
        case 'VENTILATOR':
        case 'HEATER':
          maintenanceDays = 120; // 4 months
          break;
        case 'LIGHTS':
        case 'VALVE':
          maintenanceDays = 180; // 6 months
          break;
      }
      
      if (daysSinceCreation > maintenanceDays + 30) {
        return 'MAINTENANCE_OVERDUE';
      } else if (daysSinceCreation > maintenanceDays) {
        return 'MAINTENANCE_DUE';
      } else if (daysSinceCreation > maintenanceDays * 0.8) {
        return 'WARNING';
      }
      
      return 'GOOD';
    } catch (error) {
      console.error(`[DeviceTypeResolver] Error calculating maintenance status for device ${device.id}:`, error);
      return 'GOOD';
    }
  },

  /**
   * Map database status to GraphQL enum
   */
  status: (device) => {
    // Map database status (lowercase) to GraphQL enum (uppercase)
    if (!device.status) return 'OFFLINE';
    
    const statusMap = {
      'on': 'ON',
      'off': 'OFF',
      'online': 'ON',
      'offline': 'OFFLINE',
      'active': 'ON',
      'inactive': 'OFF',
      'error': 'ERROR',
      'maintenance': 'MAINTENANCE'
    };
    
    return statusMap[device.status.toLowerCase()] || 'OFFLINE';
  },

  /**
   * Map database type to GraphQL enum
   */
  type: (device) => {
    // Map database type (lowercase) to GraphQL enum (uppercase)
    if (!device.type) return 'RELAY';
    
    const typeMap = {
      'fan': 'VENTILATOR',
      'ventilator': 'VENTILATOR',
      'water_pump': 'WATER_PUMP',
      'pump': 'WATER_PUMP',
      'heater': 'HEATER',
      'cooler': 'COOLER',
      'lights': 'LIGHTS',
      'light': 'LIGHTS',
      'valve': 'VALVE',
      'sensor_actuator': 'SENSOR_ACTUATOR',
      'motor': 'MOTOR',
      'relay': 'RELAY',
      'dimmer': 'DIMMER'
    };
    
    return typeMap[device.type.toLowerCase()] || 'RELAY';
  },

  /**
   * Map database device_id to GraphQL deviceId
   */
  deviceId: (device) => {
    return device.device_id;
  },

  /**
   * Map database enable_notifications to GraphQL enableNotifications
   */
  enableNotifications: (device) => {
    return device.enable_notifications !== false; // Default to true if not set
  },

  /**
   * Calculate operating hours
   */
  operatingHours: async (device, args, context) => {
    try {
      // Estimate operating hours based on device history and status
      const now = new Date();
      const createdAt = new Date(device.created_at);
      const totalHours = (now - createdAt) / (1000 * 60 * 60);
      
      // Assume different duty cycles for different device types
      let dutyCycle = 0.5; // Default 50% duty cycle
      
      switch (device.type) {
        case 'LIGHTS':
          dutyCycle = 0.33; // ~8 hours per day
          break;
        case 'WATER_PUMP':
          dutyCycle = 0.1; // ~2.4 hours per day
          break;
        case 'VENTILATOR':
          dutyCycle = 0.7; // ~17 hours per day
          break;
        case 'HEATER':
        case 'COOLER':
          dutyCycle = 0.3; // ~7 hours per day
          break;
      }
      
      return Math.round(totalHours * dutyCycle * 100) / 100;
    } catch (error) {
      console.error(`[DeviceTypeResolver] Error calculating operating hours for device ${device.id}:`, error);
      return 0;
    }
  }
};

/**
 * DeviceEvent Type Resolvers
 */
const DeviceEvent = {
  /**
   * Resolve device for an event
   */
  device: async (event, args, context) => {
    try {
      return await deviceService.getDeviceById(event.device_id);
    } catch (error) {
      console.error(`[DeviceEventResolver] Error getting device for event:`, error);
      return null;
    }
  },

  /**
   * Resolve user who triggered the event
   */
  triggeredBy: async (event, args, context) => {
    try {
      if (!event.triggered_by) {
        return null;
      }
      
      return await userService.getUserById(event.triggered_by);
    } catch (error) {
      console.error(`[DeviceEventResolver] Error getting trigger user for event:`, error);
      return null;
    }
  }
};

/**
 * Generate default capabilities based on device type
 */
function generateDefaultCapabilities(deviceType) {
  const baseCapabilities = [
    {
      name: 'power',
      type: 'BOOLEAN',
      readable: true,
      writable: true
    }
  ];

  switch (deviceType) {
    case 'DIMMER':
    case 'LIGHTS':
      return [
        ...baseCapabilities,
        {
          name: 'brightness',
          type: 'NUMERIC',
          readable: true,
          writable: true,
          unit: '%',
          minValue: 0,
          maxValue: 100
        }
      ];
      
    case 'VALVE':
    case 'WATER_PUMP':
      return [
        ...baseCapabilities,
        {
          name: 'flow_rate',
          type: 'NUMERIC',
          readable: true,
          writable: true,
          unit: 'L/min',
          minValue: 0,
          maxValue: 100
        }
      ];
      
    case 'HEATER':
    case 'COOLER':
      return [
        ...baseCapabilities,
        {
          name: 'temperature_setpoint',
          type: 'NUMERIC',
          readable: true,
          writable: true,
          unit: '°C',
          minValue: 0,
          maxValue: 50
        }
      ];
      
    case 'VENTILATOR':
      return [
        ...baseCapabilities,
        {
          name: 'speed',
          type: 'NUMERIC',
          readable: true,
          writable: true,
          unit: '%',
          minValue: 0,
          maxValue: 100
        }
      ];
      
    default:
      return baseCapabilities;
  }
}

module.exports = {
  Device,
  DeviceEvent
};