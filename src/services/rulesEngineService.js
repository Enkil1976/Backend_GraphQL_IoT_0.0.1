const { query } = require('../config/database');
const { cache } = require('../config/redis');
const { pubsub, EVENTS } = require('../utils/pubsub');
const deviceService = require('./deviceService');
const notificationService = require('./notificationService');
const queueService = require('./queueService');

/**
 * Rules Engine Service
 * Handles complex rule evaluation and action execution
 */
class RulesEngineService {
  constructor() {
    this.isRunning = false;
    this.evaluationInterval = 30000; // 30 seconds
    this.intervalId = null;
    this.priorityCooldowns = {
      1: 300000,  // 5 minutes for critical
      2: 600000,  // 10 minutes for high
      3: 1800000, // 30 minutes for medium
      4: 3600000, // 1 hour for low
      5: 7200000  // 2 hours for very low
    };
  }

  /**
   * Start the rules engine
   */
  async start() {
    if (this.isRunning) {
      console.log('⚡ Rules engine is already running');
      return;
    }

    console.log('🚀 Starting rules engine...');
    this.isRunning = true;
    
    // Initial evaluation
    await this.evaluateAllRules();
    
    // Set up periodic evaluation
    this.intervalId = setInterval(async () => {
      try {
        await this.evaluateAllRules();
      } catch (error) {
        console.error('❌ Error in rules engine evaluation:', error);
      }
    }, this.evaluationInterval);

    console.log('✅ Rules engine started successfully');
  }

  /**
   * Stop the rules engine
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚡ Rules engine is not running');
      return;
    }

    console.log('🛑 Stopping rules engine...');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('✅ Rules engine stopped');
  }

  /**
   * Evaluate all active rules
   */
  async evaluateAllRules() {
    try {
      // Get all active rules
      const rules = await query(
        'SELECT * FROM rules WHERE enabled = true ORDER BY priority ASC'
      );

      console.log(`🔍 Evaluating ${rules.rows.length} active rules...`);

      for (const rule of rules.rows) {
        await this.evaluateRule(rule);
      }
    } catch (error) {
      console.error('❌ Error evaluating rules:', error);
    }
  }

  /**
   * Evaluate a single rule
   * @param {Object} rule - Rule data
   */
  async evaluateRule(rule) {
    try {
      // Check cooldown
      const cooldownKey = `rule:${rule.id}:cooldown`;
      const lastTriggered = await cache.get(cooldownKey);
      
      if (lastTriggered) {
        const timeSinceLastTrigger = Date.now() - parseInt(lastTriggered);
        const cooldownPeriod = this.priorityCooldowns[rule.priority] || 1800000;
        
        if (timeSinceLastTrigger < cooldownPeriod) {
          return;
        }
      }

      // Evaluate rule conditions
      const conditionsMet = await this.evaluateConditions(rule.conditions);
      
      if (conditionsMet) {
        console.log(`🎯 Rule "${rule.name}" triggered`);
        
        // Execute actions
        await this.executeActions(rule.actions, rule);
        
        // Set cooldown
        await cache.set(cooldownKey, Date.now().toString());
        
        // Update last triggered timestamp
        await query(
          'UPDATE rules SET last_triggered = NOW() WHERE id = $1',
          [rule.id]
        );

        // Create rule execution record
        await this.createRuleExecution(rule.id, true, rule.conditions, rule.actions);

        // Publish rule triggered event
        await pubsub.publish(EVENTS.RULE_TRIGGERED, {
          ruleTriggered: {
            rule,
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error(`❌ Error evaluating rule "${rule.name}":`, error);
      await this.createRuleExecution(rule.id, false, rule.conditions, rule.actions, error.message);
    }
  }

  /**
   * Evaluate rule conditions
   * @param {Object|Array} conditions - Rule conditions (can be array or object with rules/operator)
   * @returns {boolean} Whether conditions are met
   */
  async evaluateConditions(conditions) {
    // Handle different condition formats
    let conditionList = [];
    let logicalOperator = 'AND';
    
    if (Array.isArray(conditions)) {
      conditionList = conditions;
    } else if (conditions && conditions.rules && Array.isArray(conditions.rules)) {
      conditionList = conditions.rules;
      logicalOperator = conditions.operator || 'AND';
    } else {
      return false;
    }
    
    if (conditionList.length === 0) {
      return false;
    }

    const results = [];
    
    for (const condition of conditionList) {
      const result = await this.evaluateCondition(condition);
      results.push(result);
    }

    // Apply logical operator
    if (logicalOperator === 'OR') {
      return results.some(result => result === true);
    } else { // Default to AND
      return results.every(result => result === true);
    }
  }

  /**
   * Evaluate a single condition
   * @param {Object} condition - Condition data
   * @returns {boolean} Whether condition is met
   */
  async evaluateCondition(condition) {
    const { type, sensor, sensorType, field, operator, value, device_id, deviceId, time_window } = condition;
    
    // Handle both sensor and sensorType field names
    const sensorName = sensor || sensorType;
    const deviceIdValue = device_id || deviceId;

    switch (type) {
      case 'SENSOR':
      case 'sensor':
        return await this.evaluateSensorCondition(sensorName, field, operator, value);
      
      case 'DEVICE':
      case 'device':
        return await this.evaluateDeviceCondition(deviceIdValue, operator, value);
      
      case 'TIME':
      case 'time':
        return await this.evaluateTimeCondition(condition);
      
      case 'HISTORY':
      case 'sensor_history':
        return await this.evaluateSensorHistoryCondition(sensorName, field, operator, value, time_window);
      
      case 'sensor_trend':
        return await this.evaluateSensorTrendCondition(sensor, field, condition.trend_type, time_window);
      
      case 'sensor_heartbeat':
        return await this.evaluateSensorHeartbeatCondition(sensor, condition.timeout_minutes);
      
      case 'sustained_state':
        return await this.evaluateSustainedStateCondition(condition);
      
      default:
        console.warn(`Unknown condition type: ${type}`);
        return false;
    }
  }

  /**
   * Evaluate sensor condition
   * @param {string} sensor - Sensor name
   * @param {string} field - Field name
   * @param {string} operator - Comparison operator
   * @param {number} value - Threshold value
   * @returns {boolean} Condition result
   */
  async evaluateSensorCondition(sensor, field, operator, value) {
    const sensorData = await this.getLatestSensorData(sensor);
    
    if (!sensorData) {
      console.log(`🔍 No sensor data found for sensor: ${sensor}`);
      return false;
    }

    // Field name mapping for backwards compatibility
    const fieldMapping = {
      'temperature': 'temperatura',
      'humidity': 'humedad',
      'waterTemperature': 'temperaturaAgua',
      'heatIndex': 'heatindex',
      'dewPoint': 'dewpoint'
    };

    // Use mapped field name if available, otherwise use original field name
    const actualField = fieldMapping[field] || field;
    
    if (sensorData[actualField] === undefined) {
      console.log(`🔍 Field "${field}" (mapped to "${actualField}") not found in sensor data:`, Object.keys(sensorData));
      return false;
    }

    const currentValue = sensorData[actualField];
    console.log(`🔍 Rule evaluation: ${sensor}.${actualField} = ${currentValue} ${operator} ${value}`);
    
    switch (operator) {
      case 'GT':
      case '>':
        return currentValue > value;
      case 'LT':
      case '<':
        return currentValue < value;
      case 'GTE':
      case '>=':
        return currentValue >= value;
      case 'LTE':
      case '<=':
        return currentValue <= value;
      case 'EQ':
      case '==':
        return currentValue === value;
      case 'NEQ':
      case '!=':
        return currentValue !== value;
      default:
        return false;
    }
  }

  /**
   * Evaluate device condition
   * @param {string} deviceId - Device ID
   * @param {string} operator - Comparison operator
   * @param {string} value - Expected value
   * @returns {boolean} Condition result
   */
  async evaluateDeviceCondition(deviceId, operator, value) {
    try {
      const device = await deviceService.getDeviceById(deviceId);
      
      if (!device) {
        return false;
      }

      const currentStatus = device.status;
      
      switch (operator) {
        case '==':
          return currentStatus === value;
        case '!=':
          return currentStatus !== value;
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Evaluate time condition
   * @param {Object} condition - Time condition
   * @returns {boolean} Condition result
   */
  async evaluateTimeCondition(condition) {
    const now = new Date();
    const { time_type, start_time, end_time, days_of_week, datetime } = condition;

    switch (time_type) {
      case 'daily_window':
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM
        return currentTime >= start_time && currentTime <= end_time;
      
      case 'day_of_week':
        const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
        return days_of_week.includes(currentDay);
      
      case 'datetime_range':
        const startDateTime = new Date(datetime.start);
        const endDateTime = new Date(datetime.end);
        return now >= startDateTime && now <= endDateTime;
      
      default:
        return false;
    }
  }

  /**
   * Evaluate sensor history condition
   * @param {string} sensor - Sensor name
   * @param {string} field - Field name
   * @param {string} operator - Comparison operator
   * @param {number} value - Threshold value
   * @param {Object} timeWindow - Time window configuration
   * @returns {boolean} Condition result
   */
  async evaluateSensorHistoryCondition(sensor, field, operator, value, timeWindow) {
    const { duration, aggregation } = timeWindow;
    const historicalData = await this.getSensorHistoryData(sensor, duration);
    
    if (!historicalData || historicalData.length === 0) {
      return false;
    }

    const values = historicalData.map(data => data[field]).filter(val => val !== undefined);
    
    if (values.length === 0) {
      return false;
    }

    let aggregatedValue;
    
    switch (aggregation) {
      case 'avg':
        aggregatedValue = values.reduce((sum, val) => sum + val, 0) / values.length;
        break;
      case 'min':
        aggregatedValue = Math.min(...values);
        break;
      case 'max':
        aggregatedValue = Math.max(...values);
        break;
      case 'sum':
        aggregatedValue = values.reduce((sum, val) => sum + val, 0);
        break;
      default:
        return false;
    }

    switch (operator) {
      case '>':
        return aggregatedValue > value;
      case '<':
        return aggregatedValue < value;
      case '>=':
        return aggregatedValue >= value;
      case '<=':
        return aggregatedValue <= value;
      case '==':
        return aggregatedValue === value;
      case '!=':
        return aggregatedValue !== value;
      default:
        return false;
    }
  }

  /**
   * Evaluate sensor trend condition
   * @param {string} sensor - Sensor name
   * @param {string} field - Field name
   * @param {string} trendType - Trend type (rising, falling, stable)
   * @param {Object} timeWindow - Time window configuration
   * @returns {boolean} Condition result
   */
  async evaluateSensorTrendCondition(sensor, field, trendType, timeWindow) {
    const { duration } = timeWindow;
    const historicalData = await this.getSensorHistoryData(sensor, duration);
    
    if (!historicalData || historicalData.length < 2) {
      return false;
    }

    const values = historicalData.map(data => data[field]).filter(val => val !== undefined);
    
    if (values.length < 2) {
      return false;
    }

    // Calculate trend using linear regression
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const threshold = 0.01; // Minimum slope to consider as trend
    
    switch (trendType) {
      case 'rising':
        return slope > threshold;
      case 'falling':
        return slope < -threshold;
      case 'stable':
        return Math.abs(slope) <= threshold;
      default:
        return false;
    }
  }

  /**
   * Evaluate sensor heartbeat condition
   * @param {string} sensor - Sensor name
   * @param {number} timeoutMinutes - Timeout in minutes
   * @returns {boolean} Condition result
   */
  async evaluateSensorHeartbeatCondition(sensor, timeoutMinutes) {
    const sensorData = await this.getLatestSensorData(sensor);
    
    if (!sensorData || !sensorData.timestamp) {
      return true; // No data means heartbeat failed
    }

    const lastUpdate = new Date(sensorData.timestamp);
    const now = new Date();
    const timeSinceLastUpdate = now - lastUpdate;
    const timeoutMs = timeoutMinutes * 60 * 1000;
    
    return timeSinceLastUpdate > timeoutMs;
  }

  /**
   * Evaluate sustained state condition
   * @param {Object} condition - Sustained state condition
   * @returns {boolean} Condition result
   */
  async evaluateSustainedStateCondition(condition) {
    const { sensor, field, operator, value, duration_minutes } = condition;
    const stateKey = `sustained_state:${sensor}:${field}:${operator}:${value}`;
    
    // Check if condition is currently met
    const currentlyMet = await this.evaluateSensorCondition(sensor, field, operator, value);
    
    if (!currentlyMet) {
      // Clear the state if condition is not met
      await cache.del(stateKey);
      return false;
    }

    // Get the start time of the sustained state
    const startTime = await cache.get(stateKey);
    
    if (!startTime) {
      // First time condition is met, record the start time
      await cache.set(stateKey, Date.now().toString());
      return false;
    }

    // Check if the duration has been exceeded
    const sustainedDuration = Date.now() - parseInt(startTime);
    const requiredDuration = duration_minutes * 60 * 1000;
    
    return sustainedDuration >= requiredDuration;
  }

  /**
   * Execute rule actions
   * @param {Array} actions - Rule actions
   * @param {Object} rule - Rule data
   */
  async executeActions(actions, rule) {
    if (!Array.isArray(actions) || actions.length === 0) {
      return;
    }

    for (const action of actions) {
      try {
        await this.executeAction(action, rule);
      } catch (error) {
        console.error(`❌ Error executing action:`, error);
      }
    }
  }

  /**
   * Execute a single action
   * @param {Object} action - Action data
   * @param {Object} rule - Rule data
   */
  async executeAction(action, rule) {
    const { type, device_id, status, configuration, notification, operation } = action;

    switch (type?.toLowerCase()) {
      case 'device_status':
      case 'device_control':
        await this.executeDeviceStatusAction(device_id || action.deviceId, status || action.action, action);
        break;
      
      case 'device_configuration':
        await this.executeDeviceConfigurationAction(device_id, configuration);
        break;
      
      case 'notification':
        await this.executeNotificationAction(action, rule);
        break;
      
      case 'operation':
        await this.executeOperationAction(operation, rule);
        break;
      
      default:
        console.warn(`Unknown action type: ${type}`);
    }
  }

  /**
   * Execute device status action
   * @param {string} deviceId - Device ID
   * @param {string} status - New status
   */
  async executeDeviceStatusAction(deviceId, status) {
    console.log(`🔧 Executing device status action: ${deviceId} -> ${status}`);
    
    // Queue critical action
    await queueService.publishAction({
      type: 'device_status',
      device_id: deviceId,
      status,
      priority: 'high',
      actor: 'rules_engine'
    });
  }

  /**
   * Execute device configuration action
   * @param {string} deviceId - Device ID
   * @param {Object} configuration - New configuration
   */
  async executeDeviceConfigurationAction(deviceId, configuration) {
    console.log(`⚙️ Executing device configuration action: ${deviceId}`);
    
    // Queue critical action
    await queueService.publishAction({
      type: 'device_configuration',
      device_id: deviceId,
      configuration,
      priority: 'high',
      actor: 'rules_engine'
    });
  }

  /**
   * Execute notification action
   * @param {Object} action - Action data with notification details
   * @param {Object} rule - Rule data
   */
  async executeNotificationAction(action, rule) {
    console.log(`📧 Executing notification action for rule: ${rule.name}`);
    
    const { 
      title, 
      message, 
      template, 
      priority = 'medium', 
      channels = ['webhook'], 
      canal = 'whatsapp',
      targetChannel = 'webhook',
      variables = {} 
    } = action;
    
    // Get current sensor data for template variables
    const latestSensorData = await this.getLatestSensorData('temhum1');
    
    // Add rule context and sensor data to variables
    const enrichedVariables = {
      ...variables,
      ...latestSensorData,
      rule_name: rule.name,
      rule_id: rule.id,
      timestamp: new Date().toISOString()
    };

    // Use template as message if no explicit message
    const finalMessage = message || template || 'Rule triggered notification';

    // Map canal to appropriate channel for backwards compatibility
    let effectiveChannels = channels;
    if (canal && targetChannel) {
      // If canal and targetChannel are specified, use canal as the channel type
      effectiveChannels = [canal];
    }

    await notificationService.sendNotification({
      title: title || `Rule: ${rule.name}`,
      message: finalMessage,
      priority,
      channels: effectiveChannels,
      canal: canal,
      targetChannel: targetChannel,
      variables: enrichedVariables,
      templateId: null,
      metadata: {
        rule_id: rule.id,
        rule_name: rule.name,
        triggered_by: 'rules_engine',
        usuario: 'sistema',
        canal: canal,
        targetChannel: targetChannel
      }
    });
  }

  /**
   * Execute operation action
   * @param {Object} operation - Operation data
   * @param {Object} rule - Rule data
   */
  async executeOperationAction(operation, rule) {
    console.log(`⚡ Executing operation action for rule: ${rule.name}`);
    
    // Queue operation
    await queueService.publishAction({
      type: 'operation',
      operation,
      priority: 'medium',
      actor: 'rules_engine',
      metadata: {
        rule_id: rule.id,
        rule_name: rule.name
      }
    });
  }

  /**
   * Get latest sensor data
   * @param {string} sensor - Sensor name
   * @returns {Object} Latest sensor data
   */
  async getLatestSensorData(sensor) {
    const key = `sensor_latest:${sensor.toLowerCase()}`;
    const data = await cache.hgetall(key);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    
    // Convert string values to numbers where appropriate
    const convertedData = {};
    for (const [field, value] of Object.entries(data)) {
      if (field === 'timestamp') {
        convertedData[field] = new Date(value);
      } else if (value && !isNaN(value)) {
        convertedData[field] = parseFloat(value);
      } else {
        convertedData[field] = value;
      }
    }
    
    // Add timestamp if not present (use current time)
    if (!convertedData.timestamp) {
      convertedData.timestamp = new Date();
    }
    
    return convertedData;
  }

  /**
   * Get sensor history data
   * @param {string} sensor - Sensor name
   * @param {number} duration - Duration in minutes
   * @returns {Array} Historical sensor data
   */
  async getSensorHistoryData(sensor, duration) {
    const key = `sensor_history:${sensor.toLowerCase()}`;
    const data = await cache.lrange(key, 0, -1);
    
    if (!data || data.length === 0) {
      return [];
    }

    const now = new Date();
    const cutoffTime = new Date(now.getTime() - duration * 60 * 1000);
    
    return data
      .filter(item => item && item.timestamp && new Date(item.timestamp) >= cutoffTime);
  }

  /**
   * Create rule execution record
   * @param {string} ruleId - Rule ID
   * @param {boolean} success - Whether execution was successful
   * @param {Array} conditions - Rule conditions
   * @param {Array} actions - Rule actions
   * @param {string} error - Error message if failed
   */
  async createRuleExecution(ruleId, success, conditions, actions, error = null) {
    await query(
      `INSERT INTO rule_executions (rule_id, success, evaluation_result, actions_executed, error_message, triggered_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [ruleId, success, JSON.stringify(conditions), JSON.stringify(actions), error]
    );
  }

  /**
   * Get rule execution statistics
   * @param {string} ruleId - Rule ID
   * @param {Object} timeRange - Time range
   * @returns {Object} Rule statistics
   */
  async getRuleStats(ruleId, timeRange) {
    const { startDate, endDate } = timeRange;
    
    const result = await query(
      `SELECT 
        COUNT(*) as total_executions,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_executions,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_executions,
        MAX(executed_at) as last_execution
       FROM rule_executions
       WHERE rule_id = $1 
         AND executed_at >= $2 
         AND executed_at <= $3`,
      [ruleId, startDate, endDate]
    );

    return result.rows[0];
  }

  /**
   * Test rule conditions
   * @param {Array} conditions - Rule conditions
   * @returns {Object} Test results
   */
  async testRuleConditions(conditions) {
    const results = [];
    
    for (const condition of conditions) {
      try {
        const result = await this.evaluateCondition(condition);
        results.push({
          condition,
          result,
          error: null
        });
      } catch (error) {
        results.push({
          condition,
          result: false,
          error: error.message
        });
      }
    }

    return {
      allConditionsMet: results.every(r => r.result === true),
      individualResults: results
    };
  }

  /**
   * Get engine status
   * @returns {Object} Engine status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      evaluationInterval: this.evaluationInterval,
      priorityCooldowns: this.priorityCooldowns
    };
  }
}

module.exports = new RulesEngineService();