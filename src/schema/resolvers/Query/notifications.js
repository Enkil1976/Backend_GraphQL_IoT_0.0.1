const notificationService = require('../../../services/notificationService');
const { AuthenticationError, ForbiddenError } = require('apollo-server-express');

/**
 * Notification Query Resolvers
 * Handles all notification-related GraphQL queries
 */
const notificationQueries = {
  /**
   * Get notifications with pagination and filtering
   */
  notifications: async(parent, { unread, channel, limit, offset }, context) => {
    try {
      console.log('[NotificationResolver] Getting notifications', {
        unread, channel, limit, offset, user: context.user?.username
      });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view notifications');
      }

      // Build filter options
      const options = {
        limit,
        offset,
        userId: context.user.id // Only get notifications for current user
      };

      if (unread !== undefined) {
        options.unread = unread;
      }

      if (channel) {
        options.channel = channel;
      }

      const result = await notificationService.getNotifications(options);

      // Build GraphQL connection response
      const edges = result.notifications.map((notification, index) => ({
        cursor: Buffer.from(`${offset + index}`).toString('base64'),
        node: {
          ...notification,
          // Map database fields to GraphQL schema
          type: notification.type || 'INFO_MESSAGE',
          severity: notification.priority?.toUpperCase() || 'MEDIUM',
          channel: typeof notification.channels === 'string'
            ? notification.channels.split(',')[0]
            : (Array.isArray(notification.channels) ? notification.channels[0] : 'WEBHOOK'),
          isRead: notification.read_at !== null,
          readAt: notification.read_at,
          user: { id: context.user.id }, // Will be resolved by type resolver
          source: notification.source || 'SYSTEM',
          sourceId: notification.source_id,
          deliveryStatus: notification.status?.toUpperCase() || 'PENDING',
          deliveredAt: notification.sent_at,
          actions: []
        }
      }));

      const hasNextPage = offset + limit < result.totalCount;
      const hasPreviousPage = offset > 0;

      // Calculate unread count
      const unreadResult = await notificationService.getNotifications({
        ...options,
        unread: true,
        limit: 1000 // Get all unread to count
      });

      console.log(`[NotificationResolver] Found ${result.notifications.length} notifications (${unreadResult.totalCount} unread)`);

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
        },
        totalCount: result.totalCount,
        unreadCount: unreadResult.totalCount
      };
    } catch (error) {
      console.error('[NotificationResolver] Error in notifications query:', error);
      throw error;
    }
  },

  /**
   * Get notification by ID
   */
  notification: async(parent, { id }, context) => {
    try {
      console.log(`[NotificationResolver] Getting notification ${id}`, { user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view notification details');
      }

      const notification = await notificationService.getNotificationById(id);

      if (!notification) {
        return null;
      }

      // Check if user has access to this notification
      if (notification.user_id && notification.user_id !== context.user.id) {
        // Only admin can view other users' notifications
        if (!context.user.role || context.user.role !== 'admin') {
          throw new ForbiddenError('Insufficient permissions to view this notification');
        }
      }

      console.log(`[NotificationResolver] Found notification: ${notification.title}`);

      return {
        ...notification,
        type: notification.type || 'INFO_MESSAGE',
        severity: notification.priority?.toUpperCase() || 'MEDIUM',
        channel: typeof notification.channels === 'string'
          ? notification.channels.split(',')[0]
          : (Array.isArray(notification.channels) ? notification.channels[0] : 'WEBHOOK'),
        isRead: notification.read_at !== null,
        readAt: notification.read_at,
        user: { id: notification.user_id || context.user.id },
        source: notification.source || 'SYSTEM',
        sourceId: notification.source_id,
        deliveryStatus: notification.status?.toUpperCase() || 'PENDING',
        deliveredAt: notification.sent_at,
        actions: []
      };
    } catch (error) {
      console.error(`[NotificationResolver] Error getting notification ${id}:`, error);
      if (error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get all notification templates
   */
  notificationTemplates: async(parent, args, context) => {
    try {
      console.log('[NotificationResolver] Getting notification templates', { user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view notification templates');
      }

      // Editors and above can view templates
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to view notification templates');
      }

      const templates = await notificationService.getNotificationTemplates();

      console.log(`[NotificationResolver] Found ${templates.length} templates`);

      return templates.map(template => ({
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
      }));
    } catch (error) {
      console.error('[NotificationResolver] Error getting notification templates:', error);
      throw error;
    }
  },

  /**
   * Get notification template by ID
   */
  notificationTemplate: async(parent, { id }, context) => {
    try {
      console.log(`[NotificationResolver] Getting notification template ${id}`, { user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view notification template details');
      }

      // Editors and above can view templates
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to view notification templates');
      }

      const template = await notificationService.getNotificationTemplate(id);

      if (!template) {
        return null;
      }

      console.log(`[NotificationResolver] Found template: ${template.name}`);

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
      console.error(`[NotificationResolver] Error getting notification template ${id}:`, error);
      if (error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  }
};

module.exports = notificationQueries;
