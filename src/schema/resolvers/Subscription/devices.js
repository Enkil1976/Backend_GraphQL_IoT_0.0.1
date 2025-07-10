const { pubsub, SENSOR_EVENTS } = require('../../../utils/pubsub');
const { AuthenticationError } = require('apollo-server-express');
const { withFilter } = require('graphql-subscriptions');

/**
 * Device Subscription Resolvers
 * Handles real-time device status and event subscriptions
 */
const deviceSubscriptions = {
  /**
   * Subscribe to device status changes
   * Filters by specific deviceId if specified
   */
  deviceStatusChanged: {
    subscribe: withFilter(
      (parent, args, context) => {
        console.log('[DeviceSubscription] Client subscribing to device status changes', {
          deviceId: args.deviceId,
          user: context.user?.username
        });

        // Authentication required
        if (!context.user) {
          throw new AuthenticationError('You must be logged in to subscribe to device status changes');
        }

        // Subscribe to device status change events
        return pubsub.asyncIterator([
          SENSOR_EVENTS.DEVICE_STATUS_CHANGED,
          SENSOR_EVENTS.DEVICE_UPDATED,
          SENSOR_EVENTS.DEVICE_CREATED,
          SENSOR_EVENTS.DEVICE_DELETED
        ]);
      },
      (payload, variables, context) => {
        try {
          console.log('[DeviceSubscription] Filtering device status change', {
            eventType: Object.keys(payload)[0],
            deviceId: variables.deviceId,
            user: context.user?.username
          });

          // If no specific device ID, allow all device events
          if (!variables.deviceId) {
            return true;
          }

          // Check if this event is for the requested device
          let deviceInPayload = null;

          if (payload.deviceStatusChanged) {
            deviceInPayload = payload.deviceStatusChanged;
          } else if (payload.deviceUpdated) {
            deviceInPayload = payload.deviceUpdated;
          } else if (payload.deviceCreated) {
            deviceInPayload = payload.deviceCreated;
          } else if (payload.deviceDeleted) {
            deviceInPayload = payload.deviceDeleted;
          }

          return deviceInPayload && deviceInPayload.id === variables.deviceId;
        } catch (error) {
          console.error('[DeviceSubscription] Error in status change filter:', error);
          return false;
        }
      }
    ),
    resolve: (payload, args, context) => {
      try {
        console.log('[DeviceSubscription] Resolving device status change', {
          eventType: Object.keys(payload)[0],
          user: context.user?.username
        });

        // Return the device from whichever event was triggered
        if (payload.deviceStatusChanged) {
          return payload.deviceStatusChanged;
        } else if (payload.deviceUpdated) {
          return payload.deviceUpdated;
        } else if (payload.deviceCreated) {
          return payload.deviceCreated;
        } else if (payload.deviceDeleted) {
          // For deleted devices, return a minimal device object
          return {
            id: payload.deviceDeleted.id,
            name: 'Deleted Device',
            type: 'UNKNOWN',
            status: 'OFFLINE',
            isOnline: false,
            deletedAt: payload.deviceDeleted.deletedAt
          };
        }

        return null;
      } catch (error) {
        console.error('[DeviceSubscription] Error resolving device status change:', error);
        return null;
      }
    }
  },

  /**
   * Subscribe to device value changes (for dimmers, sensors, etc.)
   * This would be triggered when device values change
   */
  deviceValueChanged: {
    subscribe: withFilter(
      (parent, args, context) => {
        console.log('[DeviceSubscription] Client subscribing to device value changes', {
          deviceId: args.deviceId,
          user: context.user?.username
        });

        // Authentication required
        if (!context.user) {
          throw new AuthenticationError('You must be logged in to subscribe to device value changes');
        }

        // Subscribe to device configuration change events (includes value changes)
        return pubsub.asyncIterator([
          SENSOR_EVENTS.DEVICE_CONFIGURATION_CHANGED,
          SENSOR_EVENTS.DEVICE_STATUS_CHANGED
        ]);
      },
      (payload, variables, context) => {
        try {
          console.log('[DeviceSubscription] Filtering device value change', {
            eventType: Object.keys(payload)[0],
            deviceId: variables.deviceId,
            user: context.user?.username
          });

          // If no specific device ID, allow all device events
          if (!variables.deviceId) {
            return true;
          }

          // Check if this event is for the requested device and includes value changes
          let deviceInPayload = null;

          if (payload.deviceConfigurationChanged) {
            deviceInPayload = payload.deviceConfigurationChanged;
          } else if (payload.deviceStatusChanged) {
            deviceInPayload = payload.deviceStatusChanged;
          }

          // Only pass through if the device matches and has value-related changes
          return deviceInPayload &&
                 deviceInPayload.id === variables.deviceId &&
                 (deviceInPayload.value !== undefined || deviceInPayload.configuration);
        } catch (error) {
          console.error('[DeviceSubscription] Error in value change filter:', error);
          return false;
        }
      }
    ),
    resolve: (payload, args, context) => {
      try {
        console.log('[DeviceSubscription] Resolving device value change', {
          eventType: Object.keys(payload)[0],
          user: context.user?.username
        });

        // Return the device from whichever event was triggered
        if (payload.deviceConfigurationChanged) {
          return payload.deviceConfigurationChanged;
        } else if (payload.deviceStatusChanged) {
          return payload.deviceStatusChanged;
        }

        return null;
      } catch (error) {
        console.error('[DeviceSubscription] Error resolving device value change:', error);
        return null;
      }
    }
  }
};

module.exports = deviceSubscriptions;
