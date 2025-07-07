#!/usr/bin/env node
/**
 * Water Pump Cycling Management Script
 * Allows flexible configuration of pump cycling patterns
 */

require('dotenv').config();
const { query } = require('../src/config/database');

class PumpCycleManager {
  
  /**
   * Create custom pump cycling pattern
   * @param {number} onMinutes - Minutes pump should be ON
   * @param {number} offMinutes - Minutes pump should be OFF  
   * @param {string} description - Description for the cycle
   */
  async createCustomCycle(onMinutes, offMinutes, description = '') {
    console.log(`🔧 Creating custom pump cycle: ${onMinutes}min ON, ${offMinutes}min OFF`);
    
    try {
      // First, clean existing pump cycles
      await this.removeAllCycles();
      
      const totalCycle = onMinutes + offMinutes;
      console.log(`   Total cycle duration: ${totalCycle} minutes`);
      
      // Create rules for the custom pattern
      const rules = this.generateCycleRules(onMinutes, offMinutes, description);
      
      for (const rule of rules) {
        console.log(`   Creating rule: ${rule.name}`);
        
        const result = await query(`
          INSERT INTO rules (
            name, description, enabled, priority, cooldown_minutes, 
            conditions, actions, created_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          RETURNING id, name
        `, [
          rule.name,
          rule.description,
          true,
          9, // High priority
          Math.min(5, Math.floor(onMinutes / 3)), // Dynamic cooldown
          JSON.stringify(rule.conditions),
          JSON.stringify(rule.actions),
          1 // Admin user
        ]);
        
        console.log(`   ✅ Rule created with ID: ${result.rows[0].id}`);
      }
      
      console.log(`\n🎉 Custom pump cycle created successfully!`);
      console.log(`📋 Pattern: ${onMinutes} min ON → ${offMinutes} min OFF → repeat`);
      return true;
      
    } catch (error) {
      console.error('❌ Error creating custom cycle:', error);
      return false;
    }
  }
  
  /**
   * Generate cycle rules based on ON/OFF minutes
   */
  generateCycleRules(onMinutes, offMinutes, description) {
    const totalCycle = onMinutes + offMinutes;
    const rules = [];
    
    // Strategy: Create rules that work within hour boundaries
    if (totalCycle <= 60) {
      // Cycle fits within an hour - create simple pattern
      rules.push({
        name: `CICLO: Bomba ON (${onMinutes}min cada ${totalCycle}min)`,
        description: `${description} - Enciende bomba por ${onMinutes} minutos cada ${totalCycle} minutos`,
        conditions: {
          operator: 'AND',
          rules: [{
            type: 'TIME',
            timeStart: '00:00',
            timeEnd: this.minutesToTimeString(onMinutes)
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
        description: `${description} - Apaga bomba por ${offMinutes} minutos cada ${totalCycle} minutos`,
        conditions: {
          operator: 'AND',
          rules: [{
            type: 'TIME',
            timeStart: this.minutesToTimeString(onMinutes),
            timeEnd: this.minutesToTimeString(totalCycle)
          }]
        },
        actions: [{
          type: 'DEVICE_CONTROL',
          deviceId: '1',
          action: 'TURN_OFF'
        }]
      });
      
    } else {
      // Cycle spans multiple hours - create multiple rules
      console.log('   📝 Creating multi-hour cycle pattern...');
      
      // Create ON rule
      rules.push({
        name: `CICLO: Bomba ON (${onMinutes}min de ${totalCycle}min)`,
        description: `${description} - Enciende bomba por ${onMinutes} minutos en ciclo de ${totalCycle} minutos`,
        conditions: {
          operator: 'AND',
          rules: [{
            type: 'TIME',
            timeStart: '00:00',
            timeEnd: this.minutesToTimeString(Math.min(onMinutes, 59))
          }]
        },
        actions: [{
          type: 'DEVICE_CONTROL',
          deviceId: '1',
          action: 'TURN_ON'
        }]
      });
      
      // Create OFF rule
      rules.push({
        name: `CICLO: Bomba OFF (${offMinutes}min de ${totalCycle}min)`,
        description: `${description} - Apaga bomba por ${offMinutes} minutos en ciclo de ${totalCycle} minutos`,
        conditions: {
          operator: 'AND',
          rules: [{
            type: 'TIME',
            timeStart: this.minutesToTimeString(onMinutes),
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
  minutesToTimeString(minutes) {
    if (minutes >= 60) {
      return '23:59'; // Cap at end of day
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
  
  /**
   * Remove all pump cycling rules
   */
  async removeAllCycles() {
    console.log('🧹 Removing all existing pump cycles...');
    
    try {
      const result = await query(`
        DELETE FROM rules 
        WHERE name LIKE '%CICLO%' 
        AND name LIKE '%Bomba%'
        RETURNING id, name
      `);
      
      console.log(`   ✅ Removed ${result.rows.length} existing pump cycle rules`);
      return result.rows;
      
    } catch (error) {
      console.error('❌ Error removing cycles:', error);
      throw error;
    }
  }
  
  /**
   * Disable all pump cycles (emergency stop)
   */
  async disableAllCycles() {
    console.log('🚫 Disabling all pump cycles (EMERGENCY STOP)...');
    
    try {
      const result = await query(`
        UPDATE rules 
        SET enabled = false, updated_at = NOW()
        WHERE name LIKE '%CICLO%' 
        AND name LIKE '%Bomba%'
        RETURNING id, name
      `);
      
      console.log(`   ✅ Disabled ${result.rows.length} pump cycle rules`);
      return result.rows;
      
    } catch (error) {
      console.error('❌ Error disabling cycles:', error);
      throw error;
    }
  }
  
  /**
   * Enable all pump cycles
   */
  async enableAllCycles() {
    console.log('✅ Enabling all pump cycles...');
    
    try {
      const result = await query(`
        UPDATE rules 
        SET enabled = true, updated_at = NOW()
        WHERE name LIKE '%CICLO%' 
        AND name LIKE '%Bomba%'
        RETURNING id, name
      `);
      
      console.log(`   ✅ Enabled ${result.rows.length} pump cycle rules`);
      return result.rows;
      
    } catch (error) {
      console.error('❌ Error enabling cycles:', error);
      throw error;
    }
  }
  
  /**
   * List current pump cycles
   */
  async listCurrentCycles() {
    console.log('📋 Current pump cycles:');
    
    try {
      const result = await query(`
        SELECT 
          id, name, enabled, priority, cooldown_minutes,
          conditions, actions, last_triggered, trigger_count
        FROM rules 
        WHERE name LIKE '%CICLO%' 
        AND name LIKE '%Bomba%'
        ORDER BY name
      `);
      
      if (result.rows.length === 0) {
        console.log('   ℹ️  No pump cycles configured');
        return [];
      }
      
      console.log('\n   ID | Name                              | Enabled | Triggers | Last Triggered');
      console.log('   ---|-----------------------------------|---------|----------|---------------');
      
      result.rows.forEach(rule => {
        const lastTriggered = rule.last_triggered ? 
          new Date(rule.last_triggered).toLocaleString('es-ES', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
          }) : 'Never';
        
        console.log(`   ${rule.id.toString().padEnd(2)} | ${rule.name.padEnd(33)} | ${rule.enabled ? 'Yes' : 'No'}.padEnd(7) | ${rule.trigger_count.toString().padEnd(8)} | ${lastTriggered}`);
      });
      
      return result.rows;
      
    } catch (error) {
      console.error('❌ Error listing cycles:', error);
      return [];
    }
  }
  
  /**
   * Show usage examples
   */
  showUsage() {
    console.log(`
🚰 Water Pump Cycle Manager - Usage Examples:

📋 List current cycles:
   node scripts/manage-pump-cycles.js list

🔧 Create custom cycles:
   node scripts/manage-pump-cycles.js create 20 10    # 20min ON, 10min OFF
   node scripts/manage-pump-cycles.js create 30 30    # 30min ON, 30min OFF  
   node scripts/manage-pump-cycles.js create 5 25     # 5min ON, 25min OFF

🚫 Control cycles:
   node scripts/manage-pump-cycles.js disable         # Emergency stop
   node scripts/manage-pump-cycles.js enable          # Re-enable all
   node scripts/manage-pump-cycles.js remove          # Delete all cycles

📊 Monitor:
   node scripts/verify-pump-cycles.js                 # Full system check

💡 Common Patterns:
   • Every 20 minutes: create 20 10 (20min ON, 10min OFF)
   • Every 30 minutes: create 15 15 (15min ON, 15min OFF)  
   • Every hour: create 30 30 (30min ON, 30min OFF)
   • Short bursts: create 5 25 (5min ON, 25min OFF)
`);
  }
}

// Command line interface
async function main() {
  const manager = new PumpCycleManager();
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    manager.showUsage();
    return;
  }
  
  const command = args[0].toLowerCase();
  
  try {
    switch (command) {
      case 'create':
        if (args.length < 3) {
          console.log('❌ Usage: create <onMinutes> <offMinutes> [description]');
          console.log('   Example: create 20 10 "Custom irrigation cycle"');
          return;
        }
        const onMin = parseInt(args[1]);
        const offMin = parseInt(args[2]);
        const desc = args[3] || `Custom ${onMin}/${offMin} cycle`;
        
        if (isNaN(onMin) || isNaN(offMin) || onMin <= 0 || offMin <= 0) {
          console.log('❌ ON and OFF minutes must be positive numbers');
          return;
        }
        
        await manager.createCustomCycle(onMin, offMin, desc);
        break;
        
      case 'remove':
      case 'delete':
        await manager.removeAllCycles();
        break;
        
      case 'disable':
      case 'stop':
        await manager.disableAllCycles();
        break;
        
      case 'enable':
      case 'start':
        await manager.enableAllCycles();
        break;
        
      case 'list':
      case 'status':
        await manager.listCurrentCycles();
        break;
        
      case 'help':
      case '--help':
      case '-h':
        manager.showUsage();
        break;
        
      default:
        console.log(`❌ Unknown command: ${command}`);
        manager.showUsage();
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Export for use in other modules
module.exports = { PumpCycleManager };

// Run if called directly
if (require.main === module) {
  main().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}