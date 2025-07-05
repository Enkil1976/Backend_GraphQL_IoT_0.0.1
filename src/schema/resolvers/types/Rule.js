const { query } = require('../../../config/database');
const userService = require('../../../services/authService');

/**
 * Rule Type Resolvers
 * Handles nested field resolution for Rule type
 */
const Rule = {
  /**
   * Resolve created by user for rule
   */
  createdBy: async (rule, args, context) => {
    try {
      if (!rule.created_by) {
        return null;
      }
      
      return await userService.getUserById(rule.created_by);
    } catch (error) {
      console.error(`[RuleTypeResolver] Error getting creator for rule ${rule.id}:`, error);
      return null;
    }
  },

  /**
   * Calculate trigger count from executions
   */
  triggerCount: async (rule, args, context) => {
    try {
      const result = await query(
        'SELECT COUNT(*) as count FROM rule_executions WHERE rule_id = $1 AND success = true',
        [rule.id]
      );
      
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      console.error(`[RuleTypeResolver] Error getting trigger count for rule ${rule.id}:`, error);
      return 0;
    }
  },

  /**
   * Get latest execution for this rule
   */
  lastExecution: async (rule, args, context) => {
    try {
      const result = await query(
        'SELECT * FROM rule_executions WHERE rule_id = $1 ORDER BY executed_at DESC LIMIT 1',
        [rule.id]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error(`[RuleTypeResolver] Error getting latest execution for rule ${rule.id}:`, error);
      return null;
    }
  },

  /**
   * Get recent executions for this rule
   */
  executions: async (rule, { limit = 10 }, context) => {
    try {
      const result = await query(
        'SELECT * FROM rule_executions WHERE rule_id = $1 ORDER BY executed_at DESC LIMIT $2',
        [rule.id, limit]
      );
      
      return result.rows;
    } catch (error) {
      console.error(`[RuleTypeResolver] Error getting executions for rule ${rule.id}:`, error);
      return [];
    }
  },

  /**
   * Determine if rule is currently active (enabled and valid)
   */
  isActive: async (rule, args, context) => {
    try {
      // Rule is active if it's enabled and not in an error state
      return rule.enabled && !rule.error;
    } catch (error) {
      console.error(`[RuleTypeResolver] Error determining active status for rule ${rule.id}:`, error);
      return false;
    }
  },

  /**
   * Calculate next evaluation time
   */
  nextEvaluation: async (rule, args, context) => {
    try {
      if (!rule.enabled) {
        return null;
      }

      // For this simple implementation, rules are evaluated every 30 seconds
      // In a real system, this would be more sophisticated
      const now = new Date();
      const nextEval = new Date(now.getTime() + 30000); // 30 seconds from now
      
      return nextEval.toISOString();
    } catch (error) {
      console.error(`[RuleTypeResolver] Error calculating next evaluation for rule ${rule.id}:`, error);
      return null;
    }
  },

  /**
   * Parse JSON conditions into proper object
   */
  conditions: async (rule, args, context) => {
    try {
      if (typeof rule.conditions === 'string') {
        return JSON.parse(rule.conditions);
      }
      return rule.conditions;
    } catch (error) {
      console.error(`[RuleTypeResolver] Error parsing conditions for rule ${rule.id}:`, error);
      return {
        operator: 'AND',
        rules: []
      };
    }
  },

  /**
   * Parse JSON actions into proper array
   */
  actions: async (rule, args, context) => {
    try {
      if (typeof rule.actions === 'string') {
        return JSON.parse(rule.actions);
      }
      return rule.actions || [];
    } catch (error) {
      console.error(`[RuleTypeResolver] Error parsing actions for rule ${rule.id}:`, error);
      return [];
    }
  },

  /**
   * Map database field to GraphQL field
   */
  cooldownMinutes: (rule) => {
    return rule.cooldown_minutes || 15;
  }
};

/**
 * RuleExecution Type Resolvers
 */
const RuleExecution = {
  /**
   * Resolve rule for an execution
   */
  rule: async (execution, args, context) => {
    try {
      const result = await query(
        'SELECT * FROM rules WHERE id = $1',
        [execution.rule_id]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error(`[RuleExecutionResolver] Error getting rule for execution:`, error);
      return null;
    }
  },

  /**
   * Map database field to GraphQL field
   */
  triggeredAt: (execution) => {
    return execution.executed_at;
  },

  /**
   * Map database field to GraphQL field
   */
  executionTimeMs: (execution) => {
    return execution.execution_time_ms || 0;
  },

  /**
   * Parse trigger data from JSON
   */
  triggerData: (execution) => {
    try {
      if (execution.trigger_data) {
        return typeof execution.trigger_data === 'string' 
          ? JSON.parse(execution.trigger_data) 
          : execution.trigger_data;
      }
      return {};
    } catch (error) {
      return {};
    }
  },

  /**
   * Build evaluation result from execution data
   */
  evaluationResult: (execution) => {
    try {
      return {
        conditionsMet: execution.success,
        conditionDetails: [],
        sensorData: {},
        deviceStates: {},
        contextData: {}
      };
    } catch (error) {
      return {
        conditionsMet: false,
        conditionDetails: [],
        sensorData: {},
        deviceStates: {},
        contextData: {}
      };
    }
  },

  /**
   * Build actions executed from execution data
   */
  actionsExecuted: (execution) => {
    try {
      // In a more complex system, this would track individual action results
      if (execution.actions) {
        const actions = typeof execution.actions === 'string' 
          ? JSON.parse(execution.actions) 
          : execution.actions;
        
        return actions.map((action, index) => ({
          actionIndex: index,
          success: execution.success,
          executionTimeMs: Math.floor((execution.execution_time_ms || 0) / actions.length),
          result: {},
          error: execution.success ? null : execution.error
        }));
      }
      return [];
    } catch (error) {
      return [];
    }
  }
};

/**
 * RuleStatistics Type Resolvers
 */
const RuleStatistics = {
  /**
   * Calculate execution history points
   */
  executionHistory: async (stats, args, context) => {
    try {
      // This would generate time-series data for charts
      // For now, return empty array
      return [];
    } catch (error) {
      return [];
    }
  }
};

module.exports = {
  Rule,
  RuleExecution,
  RuleStatistics
};