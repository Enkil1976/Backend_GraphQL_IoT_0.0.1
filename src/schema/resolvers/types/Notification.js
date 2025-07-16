const { query } = require('../../../config/database');
const notificationService = require('../../../services/notificationService');

/**
 * Notification Type Resolvers
 * Handles nested field resolution for Notification and related types
 */
const Notification = {
  /**
   * Resolve user field for notification
   */
  user: async(parent, args, context) => {
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
      console.error('[NotificationTypeResolver] Error resolving user:', error);
      return null;
    }
  },

  /**
   * Resolve template field for notification
   */
  template: async(parent, args, context) => {
    if (!parent.template_id) {
      return null;
    }

    try {
      const template = await notificationService.getNotificationTemplate(parent.template_id);
      if (!template) {
        return null;
      }

      return {
        ...template,
        type: template.type || 'INFO_MESSAGE',
        titleTemplate: template.title,
        messageTemplate: template.content,
        supportedChannels: template.channels ? template.channels.split(',') : ['EMAIL'],
        variables: typeof template.variables === 'string'
          ? JSON.parse(template.variables)
          : (template.variables || []),
        channelConfigs: [],
        createdBy: { id: template.created_by }
      };
    } catch (error) {
      console.error('[NotificationTypeResolver] Error resolving template:', error);
      return null;
    }
  },

  /**
   * Parse metadata field
   */
  metadata: (parent) => {
    if (!parent.metadata) {
      return null;
    }

    if (typeof parent.metadata === 'string') {
      try {
        return JSON.parse(parent.metadata);
      } catch (error) {
        console.error('[NotificationTypeResolver] Error parsing metadata:', error);
        return null;
      }
    }

    return parent.metadata;
  },

  /**
   * Parse actions field
   */
  actions: (parent) => {
    if (!parent.actions) {
      return [];
    }

    if (typeof parent.actions === 'string') {
      try {
        const actions = JSON.parse(parent.actions);
        return Array.isArray(actions) ? actions : [];
      } catch (error) {
        console.error('[NotificationTypeResolver] Error parsing actions:', error);
        return [];
      }
    }

    if (Array.isArray(parent.actions)) {
      return parent.actions;
    }

    return [];
  },

  /**
   * Format delivery status
   */
  deliveryStatus: (parent) => {
    if (parent.deliveryStatus) {
      return parent.deliveryStatus;
    }

    const status = parent.status || 'PENDING';
    return status.toUpperCase();
  },

  /**
   * Format notification source
   */
  source: (parent) => {
    if (parent.source) {
      return parent.source.toUpperCase();
    }

    return 'SYSTEM';
  },

  /**
   * Format notification type
   */
  type: (parent) => {
    if (parent.type) {
      return parent.type.toUpperCase();
    }

    return 'INFO_MESSAGE';
  },

  /**
   * Format notification severity
   */
  severity: (parent) => {
    if (parent.severity) {
      return parent.severity;
    }

    if (parent.priority) {
      return parent.priority.toUpperCase();
    }

    return 'MEDIUM';
  },

  /**
   * Format notification channel
   */
  channel: (parent) => {
    if (parent.channel) {
      return parent.channel.toUpperCase();
    }

    if (parent.channels) {
      const channels = parent.channels.split(',');
      return channels[0]?.toUpperCase() || 'EMAIL';
    }

    return 'EMAIL';
  },

  /**
   * Check if notification is read
   */
  isRead: (parent) => {
    if (parent.isRead !== undefined) {
      return parent.isRead;
    }

    return parent.read_at !== null;
  },

  /**
   * Format timestamps
   */
  createdAt: (parent) => {
    return parent.created_at || parent.createdAt;
  },

  updatedAt: (parent) => {
    return parent.updated_at || parent.updatedAt || parent.created_at || parent.createdAt;
  },

  readAt: (parent) => {
    return parent.read_at || parent.readAt;
  },

  deliveredAt: (parent) => {
    return parent.delivered_at || parent.deliveredAt || parent.sent_at;
  }
};

/**
 * Notification Template Type Resolvers
 */
const NotificationTemplate = {
  /**
   * Resolve createdBy field for template
   */
  createdBy: async(parent, args, context) => {
    if (parent.createdBy && typeof parent.createdBy === 'object') {
      return parent.createdBy;
    }

    const userId = parent.created_by || parent.createdBy?.id;
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
      console.error('[NotificationTemplateTypeResolver] Error resolving createdBy:', error);
      return null;
    }
  },

  /**
   * Parse variables field
   */
  variables: (parent) => {
    if (!parent.variables) {
      return [];
    }

    if (typeof parent.variables === 'string') {
      try {
        const variables = JSON.parse(parent.variables);
        return Array.isArray(variables) ? variables : [];
      } catch (error) {
        console.error('[NotificationTemplateTypeResolver] Error parsing variables:', error);
        return [];
      }
    }

    if (Array.isArray(parent.variables)) {
      return parent.variables;
    }

    return [];
  },

  /**
   * Parse supported channels
   */
  supportedChannels: (parent) => {
    if (parent.supportedChannels && Array.isArray(parent.supportedChannels)) {
      return parent.supportedChannels;
    }

    if (parent.channels) {
      if (typeof parent.channels === 'string') {
        return parent.channels.split(',').map(channel => channel.trim().toUpperCase());
      }

      if (Array.isArray(parent.channels)) {
        return parent.channels.map(channel => channel.toUpperCase());
      }
    }

    return ['EMAIL'];
  },

  /**
   * Parse channel configs
   */
  channelConfigs: (parent) => {
    if (parent.channelConfigs && Array.isArray(parent.channelConfigs)) {
      return parent.channelConfigs;
    }

    if (parent.channel_configs) {
      if (typeof parent.channel_configs === 'string') {
        try {
          const configs = JSON.parse(parent.channel_configs);
          return Array.isArray(configs) ? configs : [];
        } catch (error) {
          console.error('[NotificationTemplateTypeResolver] Error parsing channel configs:', error);
          return [];
        }
      }

      if (Array.isArray(parent.channel_configs)) {
        return parent.channel_configs;
      }
    }

    return [];
  },

  /**
   * Format template type
   */
  type: (parent) => {
    if (parent.type) {
      return parent.type.toUpperCase();
    }

    return 'INFO_MESSAGE';
  },

  /**
   * Format timestamps
   */
  createdAt: (parent) => {
    return parent.created_at || parent.createdAt;
  },

  updatedAt: (parent) => {
    return parent.updated_at || parent.updatedAt || parent.created_at || parent.createdAt;
  }
};

/**
 * Template Variable Type Resolvers
 */
const TemplateVariable = {
  /**
   * Parse default value
   */
  defaultValue: (parent) => {
    if (parent.defaultValue !== undefined) {
      return parent.defaultValue;
    }

    if (parent.default_value !== undefined) {
      return parent.default_value;
    }

    return null;
  }
};

/**
 * Notification Action Type Resolvers
 */
const NotificationAction = {
  /**
   * Format action style
   */
  style: (parent) => {
    if (parent.style) {
      return parent.style.toUpperCase();
    }

    return 'PRIMARY';
  }
};

module.exports = {
  Notification,
  NotificationTemplate,
  TemplateVariable,
  NotificationAction
};
