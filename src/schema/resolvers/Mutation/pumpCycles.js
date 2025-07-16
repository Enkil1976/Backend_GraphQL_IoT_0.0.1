const { query } = require('../../../config/database');
const { AuthenticationError, ForbiddenError } = require('apollo-server-express');

/**
 * Pump Cycle Management Resolvers
 * Provides GraphQL API for managing water pump cycling patterns
 */
const pumpCycleMutations = {

  /**
   * Create custom pump cycling pattern
   */
  createPumpCycle: async(parent, { input }, context) => {
    try {
      console.log('[PumpCycle] Creating custom cycle', { input, user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to manage pump cycles');
      }

      // Admin or editor permission required
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to manage pump cycles');
      }

      const { onMinutes, offMinutes, description = '', enabled = true } = input;

      // Validation
      if (onMinutes <= 0 || offMinutes <= 0) {
        throw new Error('ON and OFF minutes must be positive numbers');
      }

      if (onMinutes > 120 || offMinutes > 120) {
        throw new Error('Cycle periods cannot exceed 120 minutes');
      }

      const totalCycle = onMinutes + offMinutes;
      console.log(`[PumpCycle] Creating cycle: ${onMinutes}min ON, ${offMinutes}min OFF (${totalCycle}min total)`);

      // Remove existing pump cycles
      await query(`
        DELETE FROM rules 
        WHERE name LIKE '%CICLO%' 
        AND name LIKE '%Bomba%'
      `);

      // Generate cycle rules
      const rules = generatePumpCycleRules(onMinutes, offMinutes, description);
      const createdRules = [];

      for (const rule of rules) {
        const result = await query(`
          INSERT INTO rules (
            name, description, enabled, priority, cooldown_minutes, 
            conditions, actions, created_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          RETURNING *
        `, [
          rule.name,
          rule.description,
          enabled,
          9, // High priority
          Math.min(5, Math.floor(onMinutes / 3)), // Dynamic cooldown
          JSON.stringify(rule.conditions),
          JSON.stringify(rule.actions),
          context.user.id
        ]);

        createdRules.push(result.rows[0]);
      }

      console.log(`[PumpCycle] Created ${createdRules.length} rules for pump cycle`);

      return {
        success: true,
        message: `Custom pump cycle created: ${onMinutes}min ON, ${offMinutes}min OFF`,
        onMinutes,
        offMinutes,
        totalCycleMinutes: totalCycle,
        rulesCreated: createdRules.length,
        rules: createdRules
      };

    } catch (error) {
      console.error('[PumpCycle] Error creating cycle:', error);
      throw error;
    }
  },

  /**
   * Remove all pump cycling rules
   */
  removePumpCycles: async(parent, args, context) => {
    try {
      console.log('[PumpCycle] Removing all pump cycles', { user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to manage pump cycles');
      }

      // Admin permission required for deletion
      if (!context.user.role || context.user.role !== 'admin') {
        throw new ForbiddenError('Only administrators can delete pump cycles');
      }

      const result = await query(`
        DELETE FROM rules 
        WHERE name LIKE '%CICLO%' 
        AND name LIKE '%Bomba%'
        RETURNING id, name
      `);

      console.log(`[PumpCycle] Removed ${result.rows.length} pump cycle rules`);

      return {
        success: true,
        message: `Removed ${result.rows.length} pump cycle rules`,
        rulesRemoved: result.rows.length
      };

    } catch (error) {
      console.error('[PumpCycle] Error removing cycles:', error);
      throw error;
    }
  },

  /**
   * Enable/disable pump cycling
   */
  togglePumpCycles: async(parent, { enabled }, context) => {
    try {
      console.log('[PumpCycle] Toggling pump cycles', { enabled, user: context.user?.username });

      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to manage pump cycles');
      }

      // Editor permission or above required
      if (!context.user.role || !['admin', 'editor'].includes(context.user.role)) {
        throw new ForbiddenError('Insufficient permissions to control pump cycles');
      }

      const result = await query(`
        UPDATE rules 
        SET enabled = $1, updated_at = NOW()
        WHERE name LIKE '%CICLO%' 
        AND name LIKE '%Bomba%'
        RETURNING id, name, enabled
      `, [enabled]);

      const action = enabled ? 'enabled' : 'disabled';
      console.log(`[PumpCycle] ${action} ${result.rows.length} pump cycle rules`);

      return {
        success: true,
        message: `${result.rows.length} pump cycle rules ${action}`,
        enabled,
        rulesAffected: result.rows.length,
        rules: result.rows
      };

    } catch (error) {
      console.error('[PumpCycle] Error toggling cycles:', error);
      throw error;
    }
  },

  /**
   * Get current pump cycle status
   */
  getPumpCycleStatus: async(parent, args, context) => {
    try {
      console.log('[PumpCycle] Getting pump cycle status');

      const result = await query(`
        SELECT 
          id, name, enabled, priority, cooldown_minutes,
          conditions, actions, last_triggered, trigger_count,
          created_at, updated_at
        FROM rules 
        WHERE name LIKE '%CICLO%' 
        AND name LIKE '%Bomba%'
        ORDER BY name
      `);

      const enabledCount = result.rows.filter(rule => rule.enabled).length;
      const totalCount = result.rows.length;

      // Try to determine cycle pattern from rules
      let cyclePattern = null;
      if (result.rows.length >= 2) {
        // Look for ON/OFF pattern in rule names
        const onRule = result.rows.find(r => r.name.includes('ON'));
        const offRule = result.rows.find(r => r.name.includes('OFF'));

        if (onRule && offRule) {
          // Extract minutes from rule names (basic pattern matching)
          const onMatch = onRule.name.match(/(\d+)min/);
          const offMatch = offRule.name.match(/(\d+)min/);

          if (onMatch && offMatch) {
            cyclePattern = {
              onMinutes: parseInt(onMatch[1]),
              offMinutes: parseInt(offMatch[1]),
              totalMinutes: parseInt(onMatch[1]) + parseInt(offMatch[1])
            };
          }
        }
      }

      return {
        isActive: enabledCount > 0,
        totalRules: totalCount,
        enabledRules: enabledCount,
        cyclePattern,
        rules: result.rows,
        lastUpdated: result.rows.length > 0 ? result.rows[0].updated_at : null
      };

    } catch (error) {
      console.error('[PumpCycle] Error getting status:', error);
      throw error;
    }
  }
};

/**
 * Generate pump cycle rules based on ON/OFF minutes
 */
function generatePumpCycleRules(onMinutes, offMinutes, description) {
  const totalCycle = onMinutes + offMinutes;
  const rules = [];

  // Create descriptive rule names
  const cycleDesc = description || `Ciclo automático ${onMinutes}/${offMinutes}min`;

  if (totalCycle <= 60) {
    // Cycle fits within an hour - create repeating pattern
    rules.push({
      name: `CICLO: Bomba ON (${onMinutes}min cada ${totalCycle}min)`,
      description: `${cycleDesc} - Enciende bomba por ${onMinutes} minutos cada ${totalCycle} minutos`,
      conditions: {
        operator: 'AND',
        rules: [{
          type: 'TIME',
          timeStart: '00:00',
          timeEnd: minutesToTimeString(onMinutes)
        }]
      },
      actions: [{
        type: 'DEVICE_CONTROL',
        deviceId: '1',
        action: 'TURN_ON'
      }]
    });

    rules.push({
      name: `CICLO: Bomba OFF (${offMinutes}min cada ${totalCycle}min)`,
      description: `${cycleDesc} - Apaga bomba por ${offMinutes} minutos cada ${totalCycle} minutos`,
      conditions: {
        operator: 'AND',
        rules: [{
          type: 'TIME',
          timeStart: minutesToTimeString(onMinutes),
          timeEnd: minutesToTimeString(totalCycle)
        }]
      },
      actions: [{
        type: 'DEVICE_CONTROL',
        deviceId: '1',
        action: 'TURN_OFF'
      }]
    });

  } else {
    // Cycle spans multiple hours - create hourly rules
    rules.push({
      name: `CICLO: Bomba ON (${onMinutes}min de ${totalCycle}min)`,
      description: `${cycleDesc} - Enciende bomba por ${onMinutes} minutos en ciclo de ${totalCycle} minutos`,
      conditions: {
        operator: 'AND',
        rules: [{
          type: 'TIME',
          timeStart: '00:00',
          timeEnd: minutesToTimeString(Math.min(onMinutes, 59))
        }]
      },
      actions: [{
        type: 'DEVICE_CONTROL',
        deviceId: '1',
        action: 'TURN_ON'
      }]
    });

    rules.push({
      name: `CICLO: Bomba OFF (${offMinutes}min de ${totalCycle}min)`,
      description: `${cycleDesc} - Apaga bomba por ${offMinutes} minutos en ciclo de ${totalCycle} minutos`,
      conditions: {
        operator: 'AND',
        rules: [{
          type: 'TIME',
          timeStart: minutesToTimeString(onMinutes),
          timeEnd: '23:59'
        }]
      },
      actions: [{
        type: 'DEVICE_CONTROL',
        deviceId: '1',
        action: 'TURN_OFF'
      }]
    });
  }

  return rules;
}

/**
 * Convert minutes to HH:MM format
 */
function minutesToTimeString(minutes) {
  if (minutes >= 60) {
    return '23:59'; // Cap at end of day
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

module.exports = pumpCycleMutations;
