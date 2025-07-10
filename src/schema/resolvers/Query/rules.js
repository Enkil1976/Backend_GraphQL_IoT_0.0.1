const { query } = require('../../../config/database');
const rulesEngineService = require('../../../services/rulesEngineService');
const { AuthenticationError, ForbiddenError } = require('apollo-server-express');

/**
 * Rule Query Resolvers
 * Handles all rule-related GraphQL queries
 */
const ruleQueries = {
  /**
   * Get all rules with optional filtering
   */
  rules: async(parent, { enabled, priority, userId, orderBy }, context) => {
    try {
      console.log('[RuleResolver] Getting rules', { enabled, priority, userId, orderBy, user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view rules');
      }

      let queryStr = 'SELECT * FROM rules WHERE 1=1';
      const values = [];
      let paramCount = 1;

      // Apply filters
      if (enabled !== undefined) {
        queryStr += ` AND enabled = $${paramCount++}`;
        values.push(enabled);
      }

      if (priority !== undefined) {
        queryStr += ` AND priority = $${paramCount++}`;
        values.push(priority);
      }

      if (userId) {
        queryStr += ` AND created_by = $${paramCount++}`;
        values.push(userId);
      }

      // Apply ordering
      switch (orderBy) {
      case 'NAME_ASC':
        queryStr += ' ORDER BY name ASC';
        break;
      case 'NAME_DESC':
        queryStr += ' ORDER BY name DESC';
        break;
      case 'PRIORITY_ASC':
        queryStr += ' ORDER BY priority ASC';
        break;
      case 'PRIORITY_DESC':
        queryStr += ' ORDER BY priority DESC';
        break;
      case 'CREATED_ASC':
        queryStr += ' ORDER BY created_at ASC';
        break;
      case 'CREATED_DESC':
        queryStr += ' ORDER BY created_at DESC';
        break;
      case 'LAST_TRIGGERED_ASC':
        queryStr += ' ORDER BY last_triggered ASC NULLS FIRST';
        break;
      case 'LAST_TRIGGERED_DESC':
        queryStr += ' ORDER BY last_triggered DESC NULLS LAST';
        break;
      default:
        queryStr += ' ORDER BY priority ASC';
      }

      const result = await query(queryStr, values);

      console.log(`[RuleResolver] Found ${result.rows.length} rules`);
      return result.rows;
    } catch (error) {
      console.error('[RuleResolver] Error in rules query:', error);
      throw error;
    }
  },

  /**
   * Get rule by ID
   */
  rule: async(parent, { id }, context) => {
    try {
      console.log(`[RuleResolver] Getting rule ${id}`, { user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view rule details');
      }

      const result = await query(
        'SELECT * FROM rules WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const rule = result.rows[0];
      console.log(`[RuleResolver] Found rule: ${rule.name}`);
      return rule;
    } catch (error) {
      console.error(`[RuleResolver] Error getting rule ${id}:`, error);
      if (error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get rule executions with filtering
   */
  ruleExecutions: async(parent, { ruleId, success, limit, offset }, context) => {
    try {
      console.log('[RuleResolver] Getting rule executions', {
        ruleId, success, limit, offset, user: context.user?.username
      });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view rule executions');
      }

      // Editors and above can view rule executions
      if (!context.user.role || !['admin', 'editor', 'operator'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to view rule executions');
      }

      let queryStr = 'SELECT * FROM rule_executions WHERE 1=1';
      const values = [];
      let paramCount = 1;

      if (ruleId) {
        queryStr += ` AND rule_id = $${paramCount++}`;
        values.push(ruleId);
      }

      if (success !== undefined) {
        queryStr += ` AND success = $${paramCount++}`;
        values.push(success);
      }

      queryStr += ` ORDER BY executed_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
      values.push(limit, offset);

      const result = await query(queryStr, values);

      console.log(`[RuleResolver] Found ${result.rows.length} executions`);
      return result.rows;
    } catch (error) {
      console.error('[RuleResolver] Error getting rule executions:', error);
      throw error;
    }
  },

  /**
   * Get rule statistics
   */
  ruleStats: async(parent, { ruleId, timeRange }, context) => {
    try {
      console.log(`[RuleResolver] Getting stats for rule ${ruleId}`, {
        timeRange, user: context.user?.username
      });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view rule statistics');
      }

      // Editors and above can view rule statistics
      if (!context.user.role || !['admin', 'editor', 'operator'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to view rule statistics');
      }

      const stats = await rulesEngineService.getRuleStats(ruleId, timeRange);

      if (!stats) {
        return null;
      }

      console.log(`[RuleResolver] Generated stats for rule ${ruleId}`);
      return stats;
    } catch (error) {
      console.error(`[RuleResolver] Error getting stats for rule ${ruleId}:`, error);
      throw error;
    }
  },

  /**
   * Validate rule conditions
   */
  validateRuleConditions: async(parent, { conditions }, context) => {
    try {
      console.log('[RuleResolver] Validating rule conditions', { user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to validate rules');
      }

      // Basic validation
      const errors = [];
      const warnings = [];

      if (!conditions || !conditions.rules || conditions.rules.length === 0) {
        errors.push('At least one condition rule is required');
      }

      // Validate each condition rule
      for (let i = 0; i < conditions.rules.length; i++) {
        const rule = conditions.rules[i];

        if (!rule.type) {
          errors.push(`Condition ${i + 1}: Type is required`);
          continue;
        }

        switch (rule.type) {
        case 'SENSOR':
          if (!rule.sensorType) {
            errors.push(`Condition ${i + 1}: Sensor type is required for sensor conditions`);
          }
          if (!rule.field) {
            errors.push(`Condition ${i + 1}: Field is required for sensor conditions`);
          }
          if (!rule.operator) {
            errors.push(`Condition ${i + 1}: Operator is required for sensor conditions`);
          }
          if (rule.value === undefined) {
            errors.push(`Condition ${i + 1}: Value is required for sensor conditions`);
          }
          break;

        case 'DEVICE':
          if (!rule.deviceId) {
            errors.push(`Condition ${i + 1}: Device ID is required for device conditions`);
          }
          break;

        case 'TIME':
          if (!rule.timeStart || !rule.timeEnd) {
            warnings.push(`Condition ${i + 1}: Time conditions should specify start and end times`);
          }
          break;

        case 'HISTORY':
          if (!rule.aggregation) {
            errors.push(`Condition ${i + 1}: Aggregation type is required for history conditions`);
          }
          if (!rule.timeRangeMinutes) {
            errors.push(`Condition ${i + 1}: Time range is required for history conditions`);
          }
          break;
        }
      }

      const isValid = errors.length === 0;
      
      return {
        valid: isValid,
        isValid: isValid,
        errors: errors.map(error => ({ field: '', message: error, code: 'VALIDATION_ERROR' })),
        errorMessages: errors,
        warnings: warnings
      };
    } catch (error) {
      console.error('[RuleResolver] Error validating rule conditions:', error);
      throw error;
    }
  },

  /**
   * Test rule evaluation
   */
  testRule: async(parent, { id }, context) => {
    try {
      console.log(`[RuleResolver] Testing rule ${id}`, { user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to test rules');
      }

      // Editors and above can test rules
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to test rules');
      }

      // Get the rule
      const ruleResult = await query('SELECT * FROM rules WHERE id = $1', [id]);

      if (ruleResult.rows.length === 0) {
        throw new Error('Rule not found');
      }

      const rule = ruleResult.rows[0];
      const startTime = Date.now();

      // Test the rule conditions
      const testResult = await rulesEngineService.testRuleConditions(rule.conditions);
      const executionTime = Date.now() - startTime;

      console.log(`[RuleResolver] Test completed for rule ${id} in ${executionTime}ms`);

      return {
        conditionsMet: testResult.allConditionsMet,
        evaluationTime: executionTime,
        mockData: {}, // Could be enhanced with actual sensor data
        details: {
          conditionsMet: testResult.allConditionsMet,
          conditionDetails: testResult.individualResults.map((result, index) => ({
            conditionIndex: index,
            result: result.result,
            details: result.error || 'Condition evaluated successfully'
          })),
          sensorData: {},
          deviceStates: {},
          contextData: {}
        }
      };
    } catch (error) {
      console.error(`[RuleResolver] Error testing rule ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get rule templates
   */
  ruleTemplates: async(parent, args, context) => {
    try {
      console.log('[RuleResolver] Getting rule templates', { user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view rule templates');
      }

      // Return predefined rule templates
      const templates = [
        {
          id: 'temperature_alert',
          name: 'Temperature Alert',
          description: 'Alert when temperature exceeds threshold',
          category: 'Environment',
          conditions: {
            operator: 'AND',
            rules: [{
              type: 'SENSOR',
              sensorType: 'TEMHUM1',
              field: 'temperatura',
              operator: 'GT',
              value: 30
            }]
          },
          actions: [{
            type: 'NOTIFICATION',
            channels: ['EMAIL'],
            template: 'High temperature detected: {{value}}°C'
          }],
          variables: [{
            name: 'threshold',
            type: 'number',
            description: 'Temperature threshold in Celsius',
            defaultValue: 30,
            required: true
          }]
        },
        {
          id: 'humidity_control',
          name: 'Humidity Control',
          description: 'Control ventilation based on humidity levels',
          category: 'Climate Control',
          conditions: {
            operator: 'AND',
            rules: [{
              type: 'SENSOR',
              sensorType: 'TEMHUM1',
              field: 'humedad',
              operator: 'GT',
              value: 80
            }]
          },
          actions: [{
            type: 'DEVICE_CONTROL',
            deviceId: 'ventilator_1',
            action: 'TURN_ON'
          }],
          variables: [{
            name: 'humidity_threshold',
            type: 'number',
            description: 'Humidity threshold percentage',
            defaultValue: 80,
            required: true
          }, {
            name: 'ventilator_device',
            type: 'string',
            description: 'Ventilator device ID',
            defaultValue: 'ventilator_1',
            required: true
          }]
        }
      ];

      console.log(`[RuleResolver] Found ${templates.length} rule templates`);
      return templates;
    } catch (error) {
      console.error('[RuleResolver] Error getting rule templates:', error);
      throw error;
    }
  }
};

module.exports = ruleQueries;
