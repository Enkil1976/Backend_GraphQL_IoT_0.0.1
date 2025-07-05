const { withFilter } = require('graphql-subscriptions');
const { pubsub, SENSOR_EVENTS } = require('../../../utils/pubsub');

/**
 * Notification Subscription Resolvers
 * Handles real-time notification subscriptions with user-specific filtering
 */
const notificationSubscriptions = {
  /**
   * Subscribe to new notifications for the current user
   */
  newNotification: {
    subscribe: withFilter(
      () => pubsub.asyncIterator([SENSOR_EVENTS.NOTIFICATION_SENT]),
      (payload, variables, context) => {
        try {
          // Only send notifications to authenticated users
          if (!context.user) {
            return false;
          }

          const notification = payload.newNotification;
          
          // Check if this notification is for the current user
          if (notification.user_id && notification.user_id !== context.user.id) {
            // Only admin can see all notifications
            if (!context.user.role || context.user.role !== 'admin') {
              return false;
            }
          }

          // Apply any additional filters from subscription variables
          if (variables.channel && notification.channel !== variables.channel) {
            return false;
          }

          if (variables.type && notification.type !== variables.type) {
            return false;
          }

          if (variables.severity && notification.severity !== variables.severity) {
            return false;
          }

          return true;
        } catch (error) {
          console.error('[NotificationSubscription] Error in newNotification filter:', error);
          return false;
        }
      }
    ),
    resolve: (payload) => {
      const notification = payload.newNotification;
      
      return {
        ...notification,
        type: notification.type || 'INFO_MESSAGE',
        severity: notification.severity || 'MEDIUM',
        channel: notification.channel || 'EMAIL',
        isRead: false,
        user: { id: notification.user_id },
        source: notification.source || 'SYSTEM',
        deliveryStatus: notification.deliveryStatus || 'SENT',
        actions: notification.actions || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  },

  /**
   * Subscribe to notification updates (read status changes, etc.)
   */
  notificationUpdated: {
    subscribe: withFilter(
      () => pubsub.asyncIterator([SENSOR_EVENTS.DEVICE_UPDATED]), // Using existing event
      (payload, variables, context) => {
        try {
          // Only send notifications to authenticated users
          if (!context.user) {
            return false;
          }

          const notification = payload.notificationUpdated;
          
          // Check if this notification belongs to the current user
          if (notification.user_id && notification.user_id !== context.user.id) {
            // Only admin can see all notifications
            if (!context.user.role || context.user.role !== 'admin') {
              return false;
            }
          }

          // Apply any additional filters from subscription variables
          if (variables.channel && notification.channel !== variables.channel) {
            return false;
          }

          if (variables.type && notification.type !== variables.type) {
            return false;
          }

          return true;
        } catch (error) {
          console.error('[NotificationSubscription] Error in notificationUpdated filter:', error);
          return false;
        }
      }
    ),
    resolve: (payload) => {
      return payload.notificationUpdated;
    }
  }
};

module.exports = notificationSubscriptions;