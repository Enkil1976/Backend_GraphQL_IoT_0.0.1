const { query } = require('../../../config/database');
const deviceService = require('../../../services/deviceService');

/**
 * User Type Resolvers
 * Handles nested field resolution for User and related types
 */
const User = {
  /**
   * Map database fields to GraphQL schema
   */
  firstName: (parent) => {
    return parent.first_name || parent.firstName;
  },

  lastName: (parent) => {
    return parent.last_name || parent.lastName;
  },

  isActive: (parent) => {
    return parent.is_active !== undefined ? parent.is_active : parent.isActive;
  },

  lastLogin: (parent) => {
    return parent.last_login || parent.lastLogin;
  },

  createdAt: (parent) => {
    return parent.created_at || parent.createdAt;
  },

  updatedAt: (parent) => {
    return parent.updated_at || parent.updatedAt;
  },

  /**
   * Format user role
   */
  role: (parent) => {
    const role = parent.role || 'viewer';
    return role.toUpperCase();
  },

  /**
   * Parse notification preferences
   */
  notifications: (parent) => {
    if (parent.notifications && typeof parent.notifications === 'object') {
      return parent.notifications;
    }
    
    if (parent.notification_preferences) {
      if (typeof parent.notification_preferences === 'string') {
        try {
          return JSON.parse(parent.notification_preferences);
        } catch (error) {
          console.error('[UserTypeResolver] Error parsing notification preferences:', error);
        }
      }
      
      if (typeof parent.notification_preferences === 'object') {
        return parent.notification_preferences;
      }
    }
    
    // Default notification preferences
    return {
      email: true,
      sms: false,
      push: true,
      webhook: false,
      deviceAlerts: true,
      systemAlerts: true,
      maintenanceReminders: true,
      ruleExecutions: false
    };
  },

  /**
   * Parse dashboard configuration
   */
  dashboardConfig: (parent) => {
    if (parent.dashboardConfig) {
      return parent.dashboardConfig;
    }
    
    if (parent.dashboard_config) {
      if (typeof parent.dashboard_config === 'string') {
        try {
          return JSON.parse(parent.dashboard_config);
        } catch (error) {
          console.error('[UserTypeResolver] Error parsing dashboard config:', error);
          return null;
        }
      }
      
      return parent.dashboard_config;
    }
    
    return null;
  },

  /**
   * Resolve devices owned by user
   */
  ownedDevices: async (parent, args, context) => {
    try {
      const devices = await deviceService.getDevices({ owner_id: parent.id });
      return devices || [];
    } catch (error) {
      console.error('[UserTypeResolver] Error resolving owned devices:', error);
      return [];
    }
  },

  /**
   * Resolve user configurations
   */
  configurations: async (parent, args, context) => {
    try {
      const result = await query(
        `SELECT id, config_name, config, is_active, created_at, updated_at
         FROM user_configurations 
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [parent.id]
      );
      
      return result.rows.map(config => ({
        ...config,
        configName: config.config_name,
        isActive: config.is_active,
        createdAt: config.created_at,
        updatedAt: config.updated_at,
        user: { id: parent.id }
      }));
    } catch (error) {
      console.error('[UserTypeResolver] Error resolving configurations:', error);
      return [];
    }
  },

  /**
   * Resolve active configuration
   */
  activeConfiguration: async (parent, args, context) => {
    try {
      const result = await query(
        `SELECT id, config_name, config, is_active, created_at, updated_at
         FROM user_configurations 
         WHERE user_id = $1 AND is_active = true
         LIMIT 1`,
        [parent.id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const config = result.rows[0];
      return {
        ...config,
        configName: config.config_name,
        isActive: config.is_active,
        createdAt: config.created_at,
        updatedAt: config.updated_at,
        user: { id: parent.id }
      };
    } catch (error) {
      console.error('[UserTypeResolver] Error resolving active configuration:', error);
      return null;
    }
  }
};

/**
 * User Configuration Type Resolvers
 */
const UserConfiguration = {
  /**
   * Resolve user field for configuration
   */
  user: async (parent, args, context) => {
    if (parent.user && typeof parent.user === 'object') {
      return parent.user;
    }
    
    const userId = parent.user_id || parent.user?.id;
    if (!userId) {
      return null;
    }
    
    try {
      const result = await query(
        'SELECT id, username, email, first_name, last_name, role FROM users WHERE id = $1',
        [userId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const user = result.rows[0];
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role?.toUpperCase() || 'VIEWER'
      };
    } catch (error) {
      console.error('[UserConfigurationTypeResolver] Error resolving user:', error);
      return null;
    }
  },

  /**
   * Parse configuration JSON
   */
  config: (parent) => {
    if (parent.config && typeof parent.config === 'object') {
      return parent.config;
    }
    
    if (typeof parent.config === 'string') {
      try {
        return JSON.parse(parent.config);
      } catch (error) {
        console.error('[UserConfigurationTypeResolver] Error parsing config:', error);
        return null;
      }
    }
    
    return null;
  },

  /**
   * Map database fields to GraphQL schema
   */
  configName: (parent) => {
    return parent.config_name || parent.configName;
  },

  isActive: (parent) => {
    return parent.is_active !== undefined ? parent.is_active : parent.isActive;
  },

  createdAt: (parent) => {
    return parent.created_at || parent.createdAt;
  },

  updatedAt: (parent) => {
    return parent.updated_at || parent.updatedAt;
  }
};

/**
 * Notification Preferences Type Resolvers
 */
const NotificationPreferences = {
  /**
   * Ensure all boolean fields have defaults
   */
  email: (parent) => {
    return parent.email !== undefined ? parent.email : true;
  },

  sms: (parent) => {
    return parent.sms !== undefined ? parent.sms : false;
  },

  push: (parent) => {
    return parent.push !== undefined ? parent.push : true;
  },

  webhook: (parent) => {
    return parent.webhook !== undefined ? parent.webhook : false;
  },

  deviceAlerts: (parent) => {
    return parent.deviceAlerts !== undefined ? parent.deviceAlerts : true;
  },

  systemAlerts: (parent) => {
    return parent.systemAlerts !== undefined ? parent.systemAlerts : true;
  },

  maintenanceReminders: (parent) => {
    return parent.maintenanceReminders !== undefined ? parent.maintenanceReminders : true;
  },

  ruleExecutions: (parent) => {
    return parent.ruleExecutions !== undefined ? parent.ruleExecutions : false;
  }
};

module.exports = {
  User,
  UserConfiguration,
  NotificationPreferences
};