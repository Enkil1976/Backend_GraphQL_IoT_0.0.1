const { query } = require('../../../config/database');
const notificationService = require('../../../services/notificationService');
const { AuthenticationError, ForbiddenError } = require('apollo-server-express');
const { pubsub, SENSOR_EVENTS } = require('../../../utils/pubsub');

/**
 * Notification Mutation Resolvers
 * Handles all notification management operations
 */
const notificationMutations = {
  /**
   * Mark notification as read
   */
  markNotificationRead: async (parent, { id }, context) => {
    try {
      console.log(`[NotificationMutation] Marking notification ${id} as read`, { user: context.user?.username });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to mark notifications as read');
      }

      // Get the notification first
      const notification = await notificationService.getNotificationById(id);
      
      if (!notification) {
        throw new Error('Notification not found');
      }

      // Check if user has access to this notification
      if (notification.user_id && notification.user_id !== context.user.id) {
        // Only admin can modify other users' notifications
        if (!context.user.role || context.user.role !== 'admin') {
          throw new ForbiddenError('Insufficient permissions to modify this notification');
        }
      }

      // Mark as read
      await query(
        'UPDATE notifications SET read_at = NOW() WHERE id = $1 AND read_at IS NULL',
        [id]
      );

      // Get updated notification
      const updatedNotification = await notificationService.getNotificationById(id);
      
      console.log(`[NotificationMutation] Marked notification ${id} as read`);
      
      // Publish notification update event
      await pubsub.publish(SENSOR_EVENTS.DEVICE_UPDATED, {
        notificationUpdated: {
          ...updatedNotification,
          type: updatedNotification.type || 'INFO_MESSAGE',
          severity: updatedNotification.priority?.toUpperCase() || 'MEDIUM',
          channel: updatedNotification.channels?.split(',')[0] || 'EMAIL',
          isRead: true,
          readAt: updatedNotification.read_at,
          user: { id: updatedNotification.user_id || context.user.id },
          source: updatedNotification.source || 'SYSTEM',
          deliveryStatus: updatedNotification.status?.toUpperCase() || 'SENT',
          actions: []
        }
      });

      return {
        ...updatedNotification,
        type: updatedNotification.type || 'INFO_MESSAGE',
        severity: updatedNotification.priority?.toUpperCase() || 'MEDIUM',
        channel: updatedNotification.channels?.split(',')[0] || 'EMAIL',
        isRead: true,
        readAt: updatedNotification.read_at,
        user: { id: updatedNotification.user_id || context.user.id },
        source: updatedNotification.source || 'SYSTEM',
        deliveryStatus: updatedNotification.status?.toUpperCase() || 'SENT',
        actions: []
      };
    } catch (error) {
      console.error(`[NotificationMutation] Error marking notification ${id} as read:`, error);
      throw error;
    }
  },

  /**
   * Mark all notifications as read for current user
   */
  markAllNotificationsRead: async (parent, args, context) => {
    try {
      console.log('[NotificationMutation] Marking all notifications as read', { user: context.user?.username });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to mark notifications as read');
      }

      // Mark all unread notifications as read for current user
      const result = await query(
        'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
        [context.user.id]
      );

      console.log(`[NotificationMutation] Marked ${result.rowCount} notifications as read`);
      
      return true;
    } catch (error) {
      console.error('[NotificationMutation] Error marking all notifications as read:', error);
      throw error;
    }
  },

  /**
   * Delete a notification
   */
  deleteNotification: async (parent, { id }, context) => {
    try {
      console.log(`[NotificationMutation] Deleting notification ${id}`, { user: context.user?.username });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to delete notifications');
      }

      // Get the notification first
      const notification = await notificationService.getNotificationById(id);
      
      if (!notification) {
        throw new Error('Notification not found');
      }

      // Check if user has access to this notification
      if (notification.user_id && notification.user_id !== context.user.id) {
        // Only admin can delete other users' notifications
        if (!context.user.role || context.user.role !== 'admin') {
          throw new ForbiddenError('Insufficient permissions to delete this notification');
        }
      }

      const result = await query(
        'DELETE FROM notifications WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Notification not found or already deleted');
      }

      console.log(`[NotificationMutation] Deleted notification ${id}`);
      
      return true;
    } catch (error) {
      console.error(`[NotificationMutation] Error deleting notification ${id}:`, error);
      throw error;
    }
  },

  /**
   * Send custom notification
   */
  sendNotification: async (parent, { input }, context) => {
    try {
      console.log('[NotificationMutation] Sending custom notification', { input, user: context.user?.username });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to send notifications');
      }

      // Admin or editor permission required
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to send notifications');
      }

      const {
        title,
        message,
        type,
        severity = 'MEDIUM',
        channel,
        userId,
        templateId,
        variables,
        actions,
        metadata
      } = input;

      // Build notification data
      const notificationData = {
        title,
        message,
        priority: severity.toLowerCase(),
        channels: [channel],
        metadata: {
          ...metadata,
          sent_by: context.user.id,
          type,
          custom: true
        }
      };

      if (templateId) {
        notificationData.templateId = templateId;
        notificationData.variables = variables;
      }

      // Send notification
      const result = await notificationService.sendNotification(notificationData);
      
      // Create user-specific notification record if userId specified
      let userNotification = null;
      if (userId) {
        const userNotificationResult = await query(
          `INSERT INTO notifications (title, message, type, priority, channels, user_id, source, metadata, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           RETURNING *`,
          [
            title,
            message,
            type,
            severity.toLowerCase(),
            channel,
            userId,
            'USER_ACTION',
            JSON.stringify(metadata),
            'sent'
          ]
        );
        userNotification = userNotificationResult.rows[0];
      }

      console.log(`[NotificationMutation] Sent custom notification: ${title}`);
      
      return {
        ...(userNotification || {}),
        id: userNotification?.id || result.id,
        title,
        message,
        type,
        severity,
        channel,
        isRead: false,
        user: { id: userId || context.user.id },
        source: 'USER_ACTION',
        deliveryStatus: result.success ? 'SENT' : 'FAILED',
        actions: actions || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[NotificationMutation] Error sending notification:', error);
      throw error;
    }
  },

  /**
   * Create notification template
   */
  createNotificationTemplate: async (parent, { input }, context) => {
    try {
      console.log('[NotificationMutation] Creating notification template', { input, user: context.user?.username });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to create notification templates');
      }

      // Admin or editor permission required
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to create notification templates');
      }

      const {
        name,
        description,
        type,
        titleTemplate,
        messageTemplate,
        supportedChannels,
        variables,
        channelConfigs
      } = input;

      const templateData = {
        name,
        title: titleTemplate,
        content: messageTemplate,
        variables: variables || [],
        channels: supportedChannels
      };

      const template = await notificationService.createNotificationTemplate(templateData);
      
      console.log(`[NotificationMutation] Created template: ${template.name} (ID: ${template.id})`);
      
      return {
        ...template,
        type: type,
        titleTemplate: template.title,
        messageTemplate: template.content,
        supportedChannels: template.channels ? template.channels.split(',') : supportedChannels,
        variables: typeof template.variables === 'string' 
          ? JSON.parse(template.variables) 
          : (template.variables || []),
        channelConfigs: channelConfigs || [],
        createdBy: { id: context.user.id }
      };
    } catch (error) {
      console.error('[NotificationMutation] Error creating notification template:', error);
      throw error;
    }
  },

  /**
   * Update notification template
   */
  updateNotificationTemplate: async (parent, { id, input }, context) => {
    try {
      console.log(`[NotificationMutation] Updating notification template ${id}`, { input, user: context.user?.username });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to update notification templates');
      }

      // Admin or editor permission required
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to update notification templates');
      }

      const updateData = {};
      
      if (input.name !== undefined) updateData.name = input.name;
      if (input.titleTemplate !== undefined) updateData.title = input.titleTemplate;
      if (input.messageTemplate !== undefined) updateData.content = input.messageTemplate;
      if (input.variables !== undefined) updateData.variables = input.variables;
      if (input.supportedChannels !== undefined) updateData.channels = input.supportedChannels;

      const template = await notificationService.updateNotificationTemplate(id, updateData);
      
      console.log(`[NotificationMutation] Updated template: ${template.name}`);
      
      return {
        ...template,
        type: template.type || 'INFO_MESSAGE',
        titleTemplate: template.title,
        messageTemplate: template.content,
        supportedChannels: template.channels ? template.channels.split(',') : ['EMAIL'],
        variables: typeof template.variables === 'string' 
          ? JSON.parse(template.variables) 
          : (template.variables || []),
        channelConfigs: input.channelConfigs || [],
        createdBy: { id: template.created_by }
      };
    } catch (error) {
      console.error(`[NotificationMutation] Error updating notification template ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete notification template
   */
  deleteNotificationTemplate: async (parent, { id }, context) => {
    try {
      console.log(`[NotificationMutation] Deleting notification template ${id}`, { user: context.user?.username });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to delete notification templates');
      }

      // Admin permission required
      if (!context.user.role || context.user.role !== 'admin') {
        throw new ForbiddenError('Only administrators can delete notification templates');
      }

      const result = await notificationService.deleteNotificationTemplate(id);
      
      if (!result) {
        throw new Error('Template not found');
      }

      console.log(`[NotificationMutation] Deleted notification template ${id}`);
      
      return true;
    } catch (error) {
      console.error(`[NotificationMutation] Error deleting notification template ${id}:`, error);
      throw error;
    }
  }
};

module.exports = notificationMutations;