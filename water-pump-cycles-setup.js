/**
 * Water Pump Cycling System Setup
 * Creates automated 15-minute ON/OFF cycles for water pump
 * Runs 24/7 with 15 minutes ON, 15 minutes OFF pattern
 */

const { query } = require('./src/config/database');

async function setupWaterPumpCycles() {
  console.log('🚰 Setting up Water Pump Cycling System...');
  
  try {
    // Delete existing pump cycle rules to avoid conflicts
    console.log('🧹 Cleaning existing pump cycle rules...');
    await query(`
      DELETE FROM rules 
      WHERE name LIKE '%CICLO%' 
      AND name LIKE '%Bomba%'
    `);
    
    // Water pump cycling rules - 4 rules to cover 24/7 operation
    // Each rule covers 15-minute windows repeating every 30 minutes
    const pumpCycleRules = [
      {
        name: 'CICLO: Bomba ON (minutos 00-15)',
        description: 'Enciende bomba de agua durante los primeros 15 minutos de cada media hora',
        priority: 9,
        cooldownMinutes: 5,
        conditions: {
          operator: 'AND',
          rules: [{
            type: 'TIME',
            timeStart: '00:00',
            timeEnd: '00:15'
          }]
        },
        actions: [{
          type: 'DEVICE_CONTROL',
          deviceId: '1',
          action: 'TURN_ON'
        }]
      },
      {
        name: 'CICLO: Bomba OFF (minutos 15-30)',
        description: 'Apaga bomba de agua durante los minutos 15-30 de cada media hora',
        priority: 9,
        cooldownMinutes: 5,
        conditions: {
          operator: 'AND',
          rules: [{
            type: 'TIME',
            timeStart: '00:15',
            timeEnd: '00:30'
          }]
        },
        actions: [{
          type: 'DEVICE_CONTROL',
          deviceId: '1',
          action: 'TURN_OFF'
        }]
      },
      {
        name: 'CICLO: Bomba ON (minutos 30-45)',
        description: 'Enciende bomba de agua durante los minutos 30-45 de cada media hora',
        priority: 9,
        cooldownMinutes: 5,
        conditions: {
          operator: 'AND',
          rules: [{
            type: 'TIME',
            timeStart: '00:30',
            timeEnd: '00:45'
          }]
        },
        actions: [{
          type: 'DEVICE_CONTROL',
          deviceId: '1',
          action: 'TURN_ON'
        }]
      },
      {
        name: 'CICLO: Bomba OFF (minutos 45-00)',
        description: 'Apaga bomba de agua durante los minutos 45-00 de cada media hora',
        priority: 9,
        cooldownMinutes: 5,
        conditions: {
          operator: 'AND',
          rules: [{
            type: 'TIME',
            timeStart: '00:45',
            timeEnd: '23:59'
          }]
        },
        actions: [{
          type: 'DEVICE_CONTROL',
          deviceId: '1',
          action: 'TURN_OFF'
        }]
      }
    ];

    console.log('📋 Creating pump cycle rules...');
    
    for (const rule of pumpCycleRules) {
      console.log(`   Creating rule: ${rule.name}`);
      
      const result = await query(`
        INSERT INTO rules (
          name, 
          description, 
          enabled, 
          priority, 
          cooldown_minutes, 
          conditions, 
          actions, 
          created_by, 
          created_at, 
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, name
      `, [
        rule.name,
        rule.description,
        true,
        rule.priority,
        rule.cooldownMinutes,
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.actions),
        1 // Admin user ID
      ]);
      
      console.log(`   ✅ Rule created with ID: ${result.rows[0].id}`);
    }
    
    // Verify the rules were created
    console.log('\n🔍 Verifying pump cycle rules...');
    const verifyResult = await query(`
      SELECT id, name, enabled, priority, cooldown_minutes, conditions, actions 
      FROM rules 
      WHERE name LIKE '%CICLO%' 
      AND name LIKE '%Bomba%'
      ORDER BY name
    `);
    
    console.log('\n📊 Pump Cycle Rules Summary:');
    console.log('   ID | Name                              | Enabled | Priority');
    console.log('   ---|-----------------------------------|---------|--------');
    
    verifyResult.rows.forEach(rule => {
      console.log(`   ${rule.id.toString().padEnd(2)} | ${rule.name.padEnd(33)} | ${rule.enabled ? 'Yes' : 'No'}.padEnd(7) | ${rule.priority}`);
    });
    
    console.log('\n🎉 Water Pump Cycling System Setup Complete!');
    console.log('\n📋 System Operation:');
    console.log('   • 15 minutes ON, 15 minutes OFF, repeating 24/7');
    console.log('   • High priority (9) ensures execution');
    console.log('   • 5-minute cooldown prevents spam');
    console.log('   • Automatic device control via MQTT');
    console.log('   • Rules engine evaluates every 30 seconds');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error setting up water pump cycles:', error);
    throw error;
  }
}

// Additional utility functions for water pump management
async function getWaterPumpStatus() {
  try {
    const result = await query(`
      SELECT id, name, status, last_seen, updated_at
      FROM devices 
      WHERE id = 1 OR device_id = 'bomba_agua_01'
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('⚠️  Water pump device not found');
      return null;
    }
    
    const pump = result.rows[0];
    console.log('\n💧 Water Pump Status:');
    console.log(`   Name: ${pump.name}`);
    console.log(`   Status: ${pump.status}`);
    console.log(`   Last Seen: ${pump.last_seen || 'Never'}`);
    console.log(`   Updated: ${pump.updated_at}`);
    
    return pump;
    
  } catch (error) {
    console.error('❌ Error getting water pump status:', error);
    return null;
  }
}

async function listActivePumpRules() {
  try {
    const result = await query(`
      SELECT id, name, enabled, priority, last_triggered, trigger_count
      FROM rules 
      WHERE name LIKE '%CICLO%' 
      AND name LIKE '%Bomba%'
      AND enabled = true
      ORDER BY priority DESC, name
    `);
    
    console.log('\n📋 Active Pump Cycle Rules:');
    console.log('   ID | Name                              | Triggered | Count');
    console.log('   ---|-----------------------------------|-----------|------');
    
    result.rows.forEach(rule => {
      const lastTriggered = rule.last_triggered ? 
        new Date(rule.last_triggered).toLocaleString() : 'Never';
      console.log(`   ${rule.id.toString().padEnd(2)} | ${rule.name.padEnd(33)} | ${lastTriggered.padEnd(9)} | ${rule.trigger_count}`);
    });
    
    return result.rows;
    
  } catch (error) {
    console.error('❌ Error listing pump rules:', error);
    return [];
  }
}

async function disableAllPumpCycles() {
  try {
    console.log('🚫 Disabling all pump cycle rules...');
    
    const result = await query(`
      UPDATE rules 
      SET enabled = false, updated_at = NOW()
      WHERE name LIKE '%CICLO%' 
      AND name LIKE '%Bomba%'
      RETURNING id, name
    `);
    
    console.log(`✅ Disabled ${result.rows.length} pump cycle rules`);
    return result.rows;
    
  } catch (error) {
    console.error('❌ Error disabling pump cycles:', error);
    throw error;
  }
}

async function enableAllPumpCycles() {
  try {
    console.log('✅ Enabling all pump cycle rules...');
    
    const result = await query(`
      UPDATE rules 
      SET enabled = true, updated_at = NOW()
      WHERE name LIKE '%CICLO%' 
      AND name LIKE '%Bomba%'
      RETURNING id, name
    `);
    
    console.log(`✅ Enabled ${result.rows.length} pump cycle rules`);
    return result.rows;
    
  } catch (error) {
    console.error('❌ Error enabling pump cycles:', error);
    throw error;
  }
}

// Export functions for use in other modules
module.exports = {
  setupWaterPumpCycles,
  getWaterPumpStatus,
  listActivePumpRules,
  disableAllPumpCycles,
  enableAllPumpCycles
};

// Run setup if this file is executed directly
if (require.main === module) {
  setupWaterPumpCycles()
    .then(() => {
      console.log('\n🎯 Setup completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}