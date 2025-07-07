const { RedisPubSub } = require('graphql-redis-subscriptions');
const { redis } = require('../config/redis');

// Create Redis instances for PubSub
const publisherRedis = redis.duplicate();
const subscriberRedis = redis.duplicate();

// Create GraphQL Redis PubSub instance
const pubsub = new RedisPubSub({
  publisher: publisherRedis,
  subscriber: subscriberRedis,
});

// Event types constants for type safety
const EVENTS = {
  // Sensor events
  SENSOR_DATA_UPDATED: 'SENSOR_DATA_UPDATED',
  SENSOR_STATUS_CHANGED: 'SENSOR_STATUS_CHANGED',
  
  // Device events
  DEVICE_STATUS_CHANGED: 'DEVICE_STATUS_CHANGED',
  DEVICE_VALUE_CHANGED: 'DEVICE_VALUE_CHANGED',
  
  // Rule events
  RULE_TRIGGERED: 'RULE_TRIGGERED',
  RULE_UPDATED: 'RULE_UPDATED',
  RULE_ENGINE_STATUS: 'RULE_ENGINE_STATUS',
  RULE_EXECUTION_STREAM: 'RULE_EXECUTION_STREAM',
  
  // Notification events
  NEW_NOTIFICATION: 'NEW_NOTIFICATION',
  NOTIFICATION_UPDATED: 'NOTIFICATION_UPDATED',
  
  // User events
  USER_UPDATED: 'USER_UPDATED',
  
  // Weather events
  WEATHER_DATA_UPDATED: 'WEATHER_DATA_UPDATED',
  WEATHER_CONFIG_CHANGED: 'WEATHER_CONFIG_CHANGED',
  
  // System events
  SYSTEM_STATUS: 'SYSTEM_STATUS',
  HEALTH_CHECK: 'HEALTH_CHECK'
};

// Queue events for action queue system
const QUEUE_EVENTS = {
  ACTION_QUEUED: 'ACTION_QUEUED',
  ACTION_STARTED: 'ACTION_STARTED',
  ACTION_COMPLETED: 'ACTION_COMPLETED',
  ACTION_FAILED: 'ACTION_FAILED',
  ACTION_RETRIED: 'ACTION_RETRIED',
  ACTION_MOVED_TO_DLQ: 'ACTION_MOVED_TO_DLQ'
};

// Specific sensor events for more granular subscriptions
const SENSOR_EVENTS = {
  // Temperature/Humidity sensors
  TEMHUM_DATA: 'TEMHUM_DATA',
  
  // Water quality sensors
  WATER_QUALITY_DATA: 'WATER_QUALITY_DATA',
  WATER_TEMPERATURE_DATA: 'WATER_TEMPERATURE_DATA',
  
  // Light sensors
  LIGHT_DATA: 'LIGHT_DATA',
  
  // Power monitoring
  POWER_DATA: 'POWER_DATA',
  
  // Device events (compatible with existing system)
  DEVICE_CREATED: 'DEVICE_CREATED',
  DEVICE_UPDATED: 'DEVICE_UPDATED',
  DEVICE_DELETED: 'DEVICE_DELETED',
  DEVICE_STATUS_CHANGED: 'DEVICE_STATUS_CHANGED',
  DEVICE_CONFIGURATION_CHANGED: 'DEVICE_CONFIGURATION_CHANGED'
};

// Helper functions for publishing events
const publishSensorData = (sensorReading) => {
  return pubsub.publish(EVENTS.SENSOR_DATA_UPDATED, {
    sensorDataUpdated: sensorReading
  });
};

const publishSensorStatus = (sensor) => {
  return pubsub.publish(EVENTS.SENSOR_STATUS_CHANGED, {
    sensorStatusChanged: sensor
  });
};

const publishDeviceStatus = (device) => {
  return pubsub.publish(EVENTS.DEVICE_STATUS_CHANGED, {
    deviceStatusChanged: device
  });
};

const publishDeviceValue = (device) => {
  return pubsub.publish(EVENTS.DEVICE_VALUE_CHANGED, {
    deviceValueChanged: device
  });
};

const publishRuleTriggered = (execution) => {
  return pubsub.publish(EVENTS.RULE_TRIGGERED, {
    ruleTriggered: execution
  });
};

const publishRuleUpdated = (rule) => {
  return pubsub.publish(EVENTS.RULE_UPDATED, {
    ruleUpdated: rule
  });
};

const publishRuleEngineStatus = (status) => {
  return pubsub.publish(EVENTS.RULE_ENGINE_STATUS, {
    ruleEngineStatus: status
  });
};

const publishRuleExecutionStream = (execution) => {
  return pubsub.publish(EVENTS.RULE_EXECUTION_STREAM, {
    ruleExecutionStream: execution
  });
};

const publishNewNotification = (notification) => {
  return pubsub.publish(EVENTS.NEW_NOTIFICATION, {
    newNotification: notification
  });
};

const publishNotificationUpdated = (notification) => {
  return pubsub.publish(EVENTS.NOTIFICATION_UPDATED, {
    notificationUpdated: notification
  });
};

const publishUserUpdated = (user) => {
  return pubsub.publish(EVENTS.USER_UPDATED, {
    userUpdated: user
  });
};

const publishSystemStatus = (status) => {
  return pubsub.publish(EVENTS.SYSTEM_STATUS, {
    systemStatus: status
  });
};

// Subscription helper with filtering
const createFilteredSubscription = (eventName, filter) => {
  return {
    subscribe: filter 
      ? require('graphql-subscriptions').withFilter(
          () => pubsub.asyncIterator([eventName]),
          filter
        )
      : () => pubsub.asyncIterator([eventName])
  };
};

// Error handling for PubSub
publisherRedis.on('error', (error) => {
  console.error('PubSub Publisher Redis error:', error);
});

subscriberRedis.on('error', (error) => {
  console.error('PubSub Subscriber Redis error:', error);
});

// Health check for PubSub
const healthCheck = async () => {
  try {
    // Test publish/subscribe functionality
    const testChannel = 'health_check_test';
    const testMessage = { timestamp: Date.now() };
    
    await pubsub.publish(testChannel, testMessage);
    
    return { 
      status: 'OK', 
      message: 'PubSub system healthy',
      publisherStatus: publisherRedis.status,
      subscriberStatus: subscriberRedis.status
    };
  } catch (error) {
    return { 
      status: 'ERROR', 
      message: error.message,
      publisherStatus: publisherRedis.status,
      subscriberStatus: subscriberRedis.status
    };
  }
};

// Graceful shutdown
const close = async () => {
  try {
    await publisherRedis.quit();
    await subscriberRedis.quit();
    console.log('📛 PubSub connections closed');
  } catch (error) {
    console.error('Error closing PubSub connections:', error);
  }
};

module.exports = {
  pubsub,
  EVENTS,
  SENSOR_EVENTS,
  QUEUE_EVENTS,
  
  // Publisher helpers
  publishSensorData,
  publishSensorStatus,
  publishDeviceStatus,
  publishDeviceValue,
  publishRuleTriggered,
  publishRuleUpdated,
  publishRuleEngineStatus,
  publishRuleExecutionStream,
  publishNewNotification,
  publishNotificationUpdated,
  publishUserUpdated,
  publishSystemStatus,
  
  // Subscription helpers
  createFilteredSubscription,
  
  // Utilities
  healthCheck,
  close
};