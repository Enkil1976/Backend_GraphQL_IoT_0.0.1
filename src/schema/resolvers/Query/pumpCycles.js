const { query } = require('../../../config/database');

/**
 * Pump Cycle Query Resolvers
 * Provides GraphQL queries for pump cycling system status
 */
const pumpCycleQueries = {
  
  /**
   * Get current pump cycle status
   */
  pumpCycleStatus: async (parent, args, context) => {
    try {
      console.log('[PumpCycleQuery] Getting pump cycle status');
      
      // Get all pump cycle rules
      const rulesResult = await query(`
        SELECT 
          id, name, enabled, priority, cooldown_minutes,
          conditions, actions, last_triggered, trigger_count,
          created_at, updated_at
        FROM rules 
        WHERE name LIKE '%CICLO%' 
        AND name LIKE '%Bomba%'
        ORDER BY name
      `);
      
      const rules = rulesResult.rows;
      const enabledCount = rules.filter(rule => rule.enabled).length;
      const totalCount = rules.length;
      
      // Determine cycle pattern from rules
      let cyclePattern = null;
      if (rules.length >= 2) {
        const onRule = rules.find(r => r.name.includes('ON') || r.name.includes('on'));
        const offRule = rules.find(r => r.name.includes('OFF') || r.name.includes('off'));
        
        if (onRule && offRule) {
          // Extract minutes from rule names
          const onMatch = onRule.name.match(/(\d+)min/);
          const offMatch = offRule.name.match(/(\d+)min/);
          
          if (onMatch && offMatch) {
            cyclePattern = {
              onMinutes: parseInt(onMatch[1]),
              offMinutes: parseInt(offMatch[1]),
              totalMinutes: parseInt(onMatch[1]) + parseInt(offMatch[1]),
              description: `${onMatch[1]}min ON, ${offMatch[1]}min OFF`,
              createdAt: onRule.created_at
            };
          }
        }
      }
      
      // Get execution statistics
      const statsResult = await query(`
        SELECT 
          COUNT(*) as total_executions,
          SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful_executions,
          MAX(triggered_at) as last_execution
        FROM rule_executions re
        JOIN rules r ON re.rule_id = r.id
        WHERE r.name LIKE '%CICLO%' 
        AND r.name LIKE '%Bomba%'
      `);
      
      const stats = statsResult.rows[0] || {
        total_executions: 0,
        successful_executions: 0,
        last_execution: null
      };
      
      // Calculate next evaluation (rules engine runs every 30 seconds)
      const nextEvaluation = new Date(Date.now() + 30000);
      
      return {
        isActive: enabledCount > 0,
        totalRules: totalCount,
        enabledRules: enabledCount,
        cyclePattern,
        rules,
        lastUpdated: rules.length > 0 ? rules[0].updated_at : null,
        nextEvaluation,
        totalExecutions: parseInt(stats.total_executions) || 0,
        successfulExecutions: parseInt(stats.successful_executions) || 0,
        lastExecution: stats.last_execution
      };
      
    } catch (error) {
      console.error('[PumpCycleQuery] Error getting status:', error);
      throw error;
    }
  },
  
  /**
   * Get pump cycle execution history
   */
  pumpCycleHistory: async (parent, { limit = 20, offset = 0 }, context) => {
    try {
      console.log('[PumpCycleQuery] Getting pump cycle history', { limit, offset });
      
      const result = await query(`
        SELECT 
          re.id,
          re.rule_id,
          re.success,
          re.triggered_at,
          re.execution_time_ms,
          re.error_message,
          re.actions_executed,
          r.name as rule_name,
          r.actions
        FROM rule_executions re
        JOIN rules r ON re.rule_id = r.id
        WHERE r.name LIKE '%CICLO%' 
        AND r.name LIKE '%Bomba%'
        ORDER BY re.triggered_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);
      
      // Transform to match GraphQL schema
      const executions = result.rows.map(row => {
        // Determine action and cycle phase from rule name and actions
        let action = 'TURN_ON';
        let cyclePhase = 'UNKNOWN';
        
        if (row.rule_name.includes('ON') || row.rule_name.includes('on')) {
          action = 'TURN_ON';
          cyclePhase = 'ON_PHASE';
        } else if (row.rule_name.includes('OFF') || row.rule_name.includes('off')) {
          action = 'TURN_OFF';
          cyclePhase = 'OFF_PHASE';
        }
        
        // Try to extract from actions JSON
        try {
          const actions = JSON.parse(row.actions);
          if (actions && actions.length > 0 && actions[0].action) {
            action = actions[0].action;
          }
        } catch (e) {
          // Use default action
        }
        
        return {
          id: row.id,
          rule: {
            id: row.rule_id,
            name: row.rule_name,
            // Other rule fields would be resolved by Rule type resolver
          },
          action,
          success: row.success,
          executedAt: row.triggered_at,
          executionTime: row.execution_time_ms || 0,
          cyclePhase,
          error: row.error_message
        };
      });
      
      return executions;
      
    } catch (error) {
      console.error('[PumpCycleQuery] Error getting history:', error);
      throw error;
    }
  }
};

module.exports = pumpCycleQueries;