const { query } = require('../../../config/database');
const rulesEngineService = require('../../../services/rulesEngineService');
const { AuthenticationError, ForbiddenError } = require('apollo-server-express');
const { pubsub, SENSOR_EVENTS } = require('../../../utils/pubsub');

/**
 * Rule Mutation Resolvers
 * Handles all rule management operations
 */
const ruleMutations = {
  /**
   * Create a new rule
   */
  createRule: async(parent, { input }, context) => {
    try {
      console.log('[RuleMutation] Creating rule', { input, user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to create rules');
      }

      // Admin or editor permission required
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to create rules');
      }

      const {
        name,
        description,
        enabled = true,
        priority = 5,
        cooldownMinutes = 15,
        conditions,
        actions
      } = input;

      // Insert rule into database
      const result = await query(
        `INSERT INTO rules (name, description, enabled, priority, cooldown_minutes, conditions, actions, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [
          name,
          description,
          enabled,
          priority,
          cooldownMinutes,
          JSON.stringify(conditions),
          JSON.stringify(actions),
          context.user.id
        ]
      );

      const rule = result.rows[0];

      console.log(`[RuleMutation] Created rule: ${rule.name} (ID: ${rule.id})`);

      // Publish rule creation event
      await pubsub.publish(SENSOR_EVENTS.DEVICE_CREATED, {
        ruleCreated: rule
      });

      return rule;
    } catch (error) {
      console.error('[RuleMutation] Error creating rule:', error);
      throw error;
    }
  },

  /**
   * Update rule properties
   */
  updateRule: async(parent, { id, input }, context) => {
    try {
      console.log(`[RuleMutation] Updating rule ${id}`, { input, user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to update rules');
      }

      // Admin or editor permission required
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to update rules');
      }

      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (input.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(input.name);
      }

      if (input.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(input.description);
      }

      if (input.enabled !== undefined) {
        updates.push(`enabled = $${paramCount++}`);
        values.push(input.enabled);
      }

      if (input.priority !== undefined) {
        updates.push(`priority = $${paramCount++}`);
        values.push(input.priority);
      }

      if (input.cooldownMinutes !== undefined) {
        updates.push(`cooldown_minutes = $${paramCount++}`);
        values.push(input.cooldownMinutes);
      }

      if (input.conditions !== undefined) {
        updates.push(`conditions = $${paramCount++}`);
        values.push(JSON.stringify(input.conditions));
      }

      if (input.actions !== undefined) {
        updates.push(`actions = $${paramCount++}`);
        values.push(JSON.stringify(input.actions));
      }

      updates.push('updated_at = NOW()');
      values.push(id);

      const result = await query(
        `UPDATE rules SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Rule not found');
      }

      const rule = result.rows[0];

      console.log(`[RuleMutation] Updated rule: ${rule.name}`);

      // Publish rule update event
      await pubsub.publish(SENSOR_EVENTS.DEVICE_UPDATED, {
        ruleUpdated: rule
      });

      return rule;
    } catch (error) {
      console.error(`[RuleMutation] Error updating rule ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete a rule
   */
  deleteRule: async(parent, { id }, context) => {
    try {
      console.log(`[RuleMutation] Deleting rule ${id}`, { user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to delete rules');
      }

      // Admin permission required
      if (!context.user.role || context.user.role !== 'admin') {
        throw new ForbiddenError('Only administrators can delete rules');
      }

      const result = await query(
        'DELETE FROM rules WHERE id = $1 RETURNING name',
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error('Rule not found');
      }

      console.log(`[RuleMutation] Deleted rule ${id}: ${result.rows[0].name}`);

      // Publish rule deletion event
      await pubsub.publish(SENSOR_EVENTS.DEVICE_DELETED, {
        ruleDeleted: { id, deletedAt: new Date().toISOString() }
      });

      return true;
    } catch (error) {
      console.error(`[RuleMutation] Error deleting rule ${id}:`, error);
      throw error;
    }
  },

  /**
   * Enable a rule
   */
  enableRule: async(parent, { id }, context) => {
    try {
      console.log(`[RuleMutation] Enabling rule ${id}`, { user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to enable rules');
      }

      // Editor permission or above required
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to enable rules');
      }

      const result = await query(
        'UPDATE rules SET enabled = true, updated_at = NOW() WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error('Rule not found');
      }

      const rule = result.rows[0];

      console.log(`[RuleMutation] Enabled rule: ${rule.name}`);

      // Publish rule update event
      await pubsub.publish(SENSOR_EVENTS.DEVICE_UPDATED, {
        ruleUpdated: rule
      });

      return rule;
    } catch (error) {
      console.error(`[RuleMutation] Error enabling rule ${id}:`, error);
      throw error;
    }
  },

  /**
   * Disable a rule
   */
  disableRule: async(parent, { id }, context) => {
    try {
      console.log(`[RuleMutation] Disabling rule ${id}`, { user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to disable rules');
      }

      // Editor permission or above required
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to disable rules');
      }

      const result = await query(
        'UPDATE rules SET enabled = false, updated_at = NOW() WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error('Rule not found');
      }

      const rule = result.rows[0];

      console.log(`[RuleMutation] Disabled rule: ${rule.name}`);

      // Publish rule update event
      await pubsub.publish(SENSOR_EVENTS.DEVICE_UPDATED, {
        ruleUpdated: rule
      });

      return rule;
    } catch (error) {
      console.error(`[RuleMutation] Error disabling rule ${id}:`, error);
      throw error;
    }
  },

  /**
   * Manually trigger a rule
   */
  triggerRule: async(parent, { id, mockData }, context) => {
    try {
      console.log(`[RuleMutation] Triggering rule ${id}`, { mockData, user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to trigger rules');
      }

      // Editor permission or above required
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to trigger rules');
      }

      // Get the rule
      const ruleResult = await query('SELECT * FROM rules WHERE id = $1', [id]);

      if (ruleResult.rows.length === 0) {
        throw new Error('Rule not found');
      }

      const rule = ruleResult.rows[0];
      const startTime = Date.now();

      try {
        // Force evaluate the rule
        await rulesEngineService.evaluateRule(rule);
        const executionTime = Date.now() - startTime;

        // Create execution record
        const executionResult = await query(
          `INSERT INTO rule_executions (rule_id, success, evaluation_result, actions_executed, triggered_at, execution_time_ms)
           VALUES ($1, $2, $3, $4, NOW(), $5)
           RETURNING *`,
          [
            rule.id,
            true,
            JSON.stringify(rule.conditions),
            JSON.stringify(rule.actions),
            executionTime
          ]
        );

        console.log(`[RuleMutation] Rule ${id} triggered successfully in ${executionTime}ms`);

        return {
          id: executionResult.rows[0].id,
          rule,
          triggeredAt: new Date().toISOString(),
          success: true,
          executionTimeMs: executionTime,
          triggerData: mockData || {},
          evaluationResult: {
            conditionsMet: true,
            conditionDetails: [],
            sensorData: {},
            deviceStates: {},
            contextData: {}
          },
          actionsExecuted: []
        };
      } catch (execError) {
        const executionTime = Date.now() - startTime;

        // Create failed execution record
        const executionResult = await query(
          `INSERT INTO rule_executions (rule_id, success, evaluation_result, actions_executed, error_message, triggered_at, execution_time_ms)
           VALUES ($1, $2, $3, $4, $5, NOW(), $6)
           RETURNING *`,
          [
            rule.id,
            false,
            JSON.stringify(rule.conditions),
            JSON.stringify(rule.actions),
            execError.message,
            executionTime
          ]
        );

        console.error(`[RuleMutation] Rule ${id} trigger failed in ${executionTime}ms:`, execError);

        return {
          id: executionResult.rows[0].id,
          rule,
          triggeredAt: new Date().toISOString(),
          success: false,
          executionTimeMs: executionTime,
          triggerData: mockData || {},
          error: execError.message,
          evaluationResult: {
            conditionsMet: false,
            conditionDetails: [],
            sensorData: {},
            deviceStates: {},
            contextData: {}
          },
          actionsExecuted: []
        };
      }
    } catch (error) {
      console.error(`[RuleMutation] Error triggering rule ${id}:`, error);
      throw error;
    }
  },

  /**
   * Enable multiple rules
   */
  enableRules: async(parent, { ids }, context) => {
    try {
      console.log('[RuleMutation] Enabling multiple rules', { ids, user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to enable rules');
      }

      // Editor permission or above required
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to enable rules');
      }

      const result = await query(
        'UPDATE rules SET enabled = true, updated_at = NOW() WHERE id = ANY($1) RETURNING *',
        [ids]
      );

      console.log(`[RuleMutation] Enabled ${result.rows.length}/${ids.length} rules`);
      return result.rows;
    } catch (error) {
      console.error('[RuleMutation] Error enabling multiple rules:', error);
      throw error;
    }
  },

  /**
   * Disable multiple rules
   */
  disableRules: async(parent, { ids }, context) => {
    try {
      console.log('[RuleMutation] Disabling multiple rules', { ids, user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to disable rules');
      }

      // Editor permission or above required
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to disable rules');
      }

      const result = await query(
        'UPDATE rules SET enabled = false, updated_at = NOW() WHERE id = ANY($1) RETURNING *',
        [ids]
      );

      console.log(`[RuleMutation] Disabled ${result.rows.length}/${ids.length} rules`);
      return result.rows;
    } catch (error) {
      console.error('[RuleMutation] Error disabling multiple rules:', error);
      throw error;
    }
  },

  /**
   * Delete multiple rules
   */
  deleteRules: async(parent, { ids }, context) => {
    try {
      console.log('[RuleMutation] Deleting multiple rules', { ids, user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to delete rules');
      }

      // Admin permission required
      if (!context.user.role || context.user.role !== 'admin') {
        throw new ForbiddenError('Only administrators can delete rules');
      }

      const result = await query(
        'DELETE FROM rules WHERE id = ANY($1) RETURNING id, name',
        [ids]
      );

      console.log(`[RuleMutation] Deleted ${result.rows.length}/${ids.length} rules`);
      return result.rows.length === ids.length;
    } catch (error) {
      console.error('[RuleMutation] Error deleting multiple rules:', error);
      throw error;
    }
  },

  /**
   * Create rule from template
   */
  createRuleFromTemplate: async(parent, { templateId, variables }, context) => {
    try {
      console.log(`[RuleMutation] Creating rule from template ${templateId}`, {
        variables, user: context.user?.username
      });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to create rules');
      }

      // Admin or editor permission required
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to create rules');
      }

      // Get template (this would typically come from a database)
      const templates = {
        'temperature_alert': {
          name: 'Temperature Alert',
          description: 'Alert when temperature exceeds threshold',
          conditions: {
            operator: 'AND',
            rules: [{
              type: 'SENSOR',
              sensorId: variables.sensorId,
              field: 'temperatura',
              operator: 'GT',
              value: variables.threshold || 30
            }]
          },
          actions: [{
            type: 'NOTIFICATION',
            channels: ['EMAIL'],
            template: `High temperature detected: ${variables.threshold || 30}°C`
          }]
        },
        'humidity_control': {
          name: 'Humidity Control',
          description: 'Control ventilation based on humidity levels',
          conditions: {
            operator: 'AND',
            rules: [{
              type: 'SENSOR',
              sensorId: variables.sensorId,
              field: 'humedad',
              operator: 'GT',
              value: variables.humidity_threshold || 80
            }]
          },
          actions: [{
            type: 'DEVICE_CONTROL',
            deviceId: variables.ventilator_device || 'ventilator_1',
            action: 'TURN_ON'
          }]
        }
      };

      const template = templates[templateId];
      if (!template) {
        throw new Error('Template not found');
      }

      // Create rule from template
      const result = await query(
        `INSERT INTO rules (name, description, enabled, priority, cooldown_minutes, conditions, actions, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [
          `${template.name} (${new Date().toLocaleDateString()})`,
          template.description,
          true,
          5,
          15,
          JSON.stringify(template.conditions),
          JSON.stringify(template.actions),
          context.user.id
        ]
      );

      const rule = result.rows[0];

      console.log(`[RuleMutation] Created rule from template: ${rule.name} (ID: ${rule.id})`);

      return rule;
    } catch (error) {
      console.error(`[RuleMutation] Error creating rule from template ${templateId}:`, error);
      throw error;
    }
  }
};

module.exports = ruleMutations;
