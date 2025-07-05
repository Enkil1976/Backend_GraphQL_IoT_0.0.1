const { redis, cache } = require('../config/redis');
const { pubsub, QUEUE_EVENTS } = require('../utils/pubsub');

/**
 * Queue Service
 * Handles Redis Streams-based critical action queue with DLQ support
 */
class QueueService {
  constructor() {
    this.streamName = 'actions_stream';
    this.dlqStreamName = 'actions_dlq';
    this.consumerGroup = 'actions_consumer_group';
    this.consumerName = 'actions_consumer';
    this.maxRetries = 3;
    this.processingTimeout = 30000; // 30 seconds
    this.isProcessing = false;
    this.processingInterval = 5000; // 5 seconds
    this.intervalId = null;
  }

  /**
   * Initialize the queue service
   */
  async initialize() {
    try {
      // Create consumer group (will fail if already exists, which is fine)
      await redis.xgroup('CREATE', this.streamName, this.consumerGroup, '0', 'MKSTREAM');
      console.log('✅ Action queue consumer group created');
    } catch (error) {
      if (error.message.includes('BUSYGROUP')) {
        console.log('✅ Action queue consumer group already exists');
      } else {
        console.error('❌ Error creating consumer group:', error);
      }
    }

    try {
      // Create DLQ consumer group
      await redis.xgroup('CREATE', this.dlqStreamName, this.consumerGroup, '0', 'MKSTREAM');
      console.log('✅ DLQ consumer group created');
    } catch (error) {
      if (error.message.includes('BUSYGROUP')) {
        console.log('✅ DLQ consumer group already exists');
      } else {
        console.error('❌ Error creating DLQ consumer group:', error);
      }
    }
  }

  /**
   * Start processing actions
   */
  async startProcessing() {
    if (this.isProcessing) {
      console.log('⚡ Queue processor is already running');
      return;
    }

    await this.initialize();
    
    console.log('🚀 Starting action queue processor...');
    this.isProcessing = true;
    
    // Start processing loop
    this.intervalId = setInterval(async () => {
      try {
        await this.processActions();
        await this.processPendingActions();
      } catch (error) {
        console.error('❌ Error in queue processor:', error);
      }
    }, this.processingInterval);

    console.log('✅ Action queue processor started');
  }

  /**
   * Stop processing actions
   */
  stopProcessing() {
    if (!this.isProcessing) {
      console.log('⚡ Queue processor is not running');
      return;
    }

    console.log('🛑 Stopping action queue processor...');
    this.isProcessing = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('✅ Action queue processor stopped');
  }

  /**
   * Publish an action to the queue
   * @param {Object} action - Action data
   * @returns {string} Stream entry ID
   */
  async publishAction(action) {
    const actionData = {
      type: action.type,
      device_id: action.device_id || '',
      status: action.status || '',
      configuration: action.configuration ? JSON.stringify(action.configuration) : '',
      operation: action.operation ? JSON.stringify(action.operation) : '',
      priority: action.priority || 'medium',
      actor: action.actor || 'system',
      metadata: action.metadata ? JSON.stringify(action.metadata) : '{}',
      retry_count: '0',
      created_at: new Date().toISOString()
    };

    try {
      const streamId = await redis.xadd(this.streamName, '*', ...Object.entries(actionData).flat());
      
      console.log(`📤 Action published to queue: ${action.type} (${streamId})`);
      
      // Publish queue action event
      await pubsub.publish(QUEUE_EVENTS.ACTION_QUEUED, {
        actionQueued: {
          id: streamId,
          ...action
        }
      });

      return streamId;
    } catch (error) {
      console.error('❌ Error publishing action to queue:', error);
      throw error;
    }
  }

  /**
   * Process actions from the queue
   */
  async processActions() {
    try {
      // Temporarily disabled to isolate Redis issue
      console.log('🔄 Queue processing (temporarily disabled for debugging)');
      return;
      
      // Read from the stream using ioredis object format
      const results = await redis.call('XREADGROUP', 
        'GROUP', this.consumerGroup, this.consumerName,
        'BLOCK', 1000,
        'COUNT', 10,
        'STREAMS', this.streamName, '>'
      );

      if (!results || results.length === 0) {
        return;
      }

      const [streamName, messages] = results[0];
      
      for (const [messageId, fields] of messages) {
        await this.processAction(messageId, fields);
      }
    } catch (error) {
      console.error('❌ Error processing actions:', error);
    }
  }

  /**
   * Process pending actions (those that failed to acknowledge)
   */
  async processPendingActions() {
    try {
      // Temporarily disabled to isolate Redis issue
      console.log('🔄 Pending processing (temporarily disabled for debugging)');
      return;
      
      // Get pending messages
      const pendingMessages = await redis.xpending(
        this.streamName, this.consumerGroup, 
        '-', '+', 10, this.consumerName
      );

      if (!pendingMessages || pendingMessages.length === 0) {
        return;
      }

      for (const [messageId, consumerName, idleTime, deliveryCount] of pendingMessages) {
        // Process messages that have been idle for too long
        if (idleTime > this.processingTimeout) {
          // Claim the message
          const claimedMessages = await redis.xclaim(
            this.streamName, this.consumerGroup, this.consumerName,
            1000, messageId
          );

          if (claimedMessages && claimedMessages.length > 0) {
            const [claimedId, fields] = claimedMessages[0];
            await this.processAction(claimedId, fields);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error processing pending actions:', error);
    }
  }

  /**
   * Process a single action
   * @param {string} messageId - Stream message ID
   * @param {Array} fields - Action fields
   */
  async processAction(messageId, fields) {
    try {
      // Convert fields array to object
      const action = this.fieldsToObject(fields);
      
      console.log(`🔄 Processing action: ${action.type} (${messageId})`);
      
      // Execute the action
      const success = await this.executeAction(action);
      
      if (success) {
        // Acknowledge the message
        await redis.xack(this.streamName, this.consumerGroup, messageId);
        
        console.log(`✅ Action completed successfully: ${action.type} (${messageId})`);
        
        // Publish action completed event
        await pubsub.publish(QUEUE_EVENTS.ACTION_COMPLETED, {
          actionCompleted: {
            id: messageId,
            ...action
          }
        });
      } else {
        // Handle retry logic
        await this.handleActionFailure(messageId, action);
      }
    } catch (error) {
      console.error(`❌ Error processing action ${messageId}:`, error);
      
      // Convert fields array to object for error handling
      const action = this.fieldsToObject(fields);
      await this.handleActionFailure(messageId, action, error.message);
    }
  }

  /**
   * Execute an action
   * @param {Object} action - Action data
   * @returns {boolean} Success status
   */
  async executeAction(action) {
    const { type, device_id, status, configuration, operation } = action;

    try {
      switch (type) {
        case 'device_status':
          return await this.executeDeviceStatusAction(device_id, status);
        
        case 'device_configuration':
          return await this.executeDeviceConfigurationAction(device_id, JSON.parse(configuration));
        
        case 'operation':
          return await this.executeOperationAction(JSON.parse(operation));
        
        default:
          console.warn(`Unknown action type: ${type}`);
          return false;
      }
    } catch (error) {
      console.error(`❌ Error executing action:`, error);
      return false;
    }
  }

  /**
   * Execute device status action
   * @param {string} deviceId - Device ID
   * @param {string} status - New status
   * @returns {boolean} Success status
   */
  async executeDeviceStatusAction(deviceId, status) {
    try {
      const deviceService = require('./deviceService');
      await deviceService.updateDeviceStatus(deviceId, status);
      return true;
    } catch (error) {
      console.error(`❌ Failed to update device status:`, error);
      return false;
    }
  }

  /**
   * Execute device configuration action
   * @param {string} deviceId - Device ID
   * @param {Object} configuration - New configuration
   * @returns {boolean} Success status
   */
  async executeDeviceConfigurationAction(deviceId, configuration) {
    try {
      const deviceService = require('./deviceService');
      await deviceService.updateDeviceConfiguration(deviceId, configuration);
      return true;
    } catch (error) {
      console.error(`❌ Failed to update device configuration:`, error);
      return false;
    }
  }

  /**
   * Execute operation action
   * @param {Object} operation - Operation data
   * @returns {boolean} Success status
   */
  async executeOperationAction(operation) {
    try {
      // Implementation depends on specific operation types
      console.log(`⚡ Executing operation:`, operation);
      return true;
    } catch (error) {
      console.error(`❌ Failed to execute operation:`, error);
      return false;
    }
  }

  /**
   * Handle action failure
   * @param {string} messageId - Stream message ID
   * @param {Object} action - Action data
   * @param {string} error - Error message
   */
  async handleActionFailure(messageId, action, error = null) {
    const retryCount = parseInt(action.retry_count || '0');
    
    if (retryCount >= this.maxRetries) {
      // Move to DLQ
      await this.moveToDeadLetterQueue(messageId, action, error);
      
      // Acknowledge the original message
      await redis.xack(this.streamName, this.consumerGroup, messageId);
      
      console.log(`💀 Action moved to DLQ: ${action.type} (${messageId})`);
      
      // Publish action failed event
      await pubsub.publish(QUEUE_EVENTS.ACTION_FAILED, {
        actionFailed: {
          id: messageId,
          ...action,
          error
        }
      });
    } else {
      // Increment retry count and republish
      const updatedAction = {
        ...action,
        retry_count: (retryCount + 1).toString(),
        last_error: error || 'Unknown error',
        last_retry_at: new Date().toISOString()
      };

      await this.publishAction(updatedAction);
      
      // Acknowledge the original message
      await redis.xack(this.streamName, this.consumerGroup, messageId);
      
      console.log(`🔄 Action retried: ${action.type} (retry ${retryCount + 1}/${this.maxRetries})`);
    }
  }

  /**
   * Move action to Dead Letter Queue
   * @param {string} messageId - Stream message ID
   * @param {Object} action - Action data
   * @param {string} error - Error message
   */
  async moveToDeadLetterQueue(messageId, action, error) {
    const dlqData = {
      original_message_id: messageId,
      type: action.type,
      device_id: action.device_id || '',
      status: action.status || '',
      configuration: action.configuration || '',
      operation: action.operation || '',
      priority: action.priority || 'medium',
      actor: action.actor || 'system',
      metadata: action.metadata || '{}',
      retry_count: action.retry_count || '0',
      error: error || 'Max retries exceeded',
      failed_at: new Date().toISOString(),
      created_at: action.created_at || new Date().toISOString()
    };

    await redis.xadd(this.dlqStreamName, '*', ...Object.entries(dlqData).flat());
  }

  /**
   * Get queue statistics
   * @returns {Object} Queue statistics
   */
  async getQueueStats() {
    try {
      const streamInfo = await redis.xinfo('STREAM', this.streamName);
      const dlqInfo = await redis.xinfo('STREAM', this.dlqStreamName);
      
      const pending = await redis.xpending(this.streamName, this.consumerGroup);
      
      return {
        streamLength: streamInfo[1],
        dlqLength: dlqInfo[1],
        pendingCount: pending[0],
        consumerCount: pending[1],
        isProcessing: this.isProcessing
      };
    } catch (error) {
      console.error('❌ Error getting queue stats:', error);
      return {
        streamLength: 0,
        dlqLength: 0,
        pendingCount: 0,
        consumerCount: 0,
        isProcessing: this.isProcessing
      };
    }
  }

  /**
   * Get actions from DLQ
   * @param {number} limit - Number of actions to retrieve
   * @returns {Array} DLQ actions
   */
  async getDeadLetterActions(limit = 100) {
    try {
      const messages = await redis.xrange(this.dlqStreamName, '-', '+', 'COUNT', limit);
      
      return messages.map(([messageId, fields]) => ({
        id: messageId,
        ...this.fieldsToObject(fields)
      }));
    } catch (error) {
      console.error('❌ Error getting DLQ actions:', error);
      return [];
    }
  }

  /**
   * Retry action from DLQ
   * @param {string} messageId - DLQ message ID
   * @returns {boolean} Success status
   */
  async retryFromDLQ(messageId) {
    try {
      // Get the message from DLQ
      const messages = await redis.xrange(this.dlqStreamName, messageId, messageId);
      
      if (!messages || messages.length === 0) {
        throw new Error('Message not found in DLQ');
      }

      const [id, fields] = messages[0];
      const action = this.fieldsToObject(fields);
      
      // Reset retry count and republish
      delete action.original_message_id;
      delete action.error;
      delete action.failed_at;
      action.retry_count = '0';
      
      await this.publishAction(action);
      
      // Remove from DLQ
      await redis.xdel(this.dlqStreamName, messageId);
      
      console.log(`🔄 Action retried from DLQ: ${action.type} (${messageId})`);
      
      return true;
    } catch (error) {
      console.error('❌ Error retrying from DLQ:', error);
      return false;
    }
  }

  /**
   * Clear streams (for testing/maintenance)
   */
  async clearStreams() {
    try {
      await redis.del(this.streamName);
      await redis.del(this.dlqStreamName);
      console.log('🧹 Streams cleared');
    } catch (error) {
      console.error('❌ Error clearing streams:', error);
    }
  }

  /**
   * Convert Redis fields array to object
   * @param {Array} fields - Redis fields array
   * @returns {Object} Field object
   */
  fieldsToObject(fields) {
    const obj = {};
    for (let i = 0; i < fields.length; i += 2) {
      obj[fields[i]] = fields[i + 1];
    }
    return obj;
  }
}

module.exports = new QueueService();