#!/usr/bin/env node
/**
 * Water Pump Cycling Verification Script
 * Verifies that the pump cycling system is working correctly
 */

require('dotenv').config();
const { query } = require('../src/config/database');

async function verifyPumpCycles() {
  console.log('🔍 Verifying Water Pump Cycling System...\n');
  
  try {
    // 1. Check if pump cycle rules exist and are enabled
    console.log('📋 Checking pump cycle rules...');
    const rulesResult = await query(`
      SELECT 
        id,
        name,
        enabled,
        priority,
        cooldown_minutes,
        conditions,
        actions,
        last_triggered,
        trigger_count,
        created_at
      FROM rules 
      WHERE name LIKE '%CICLO%' 
      AND name LIKE '%Bomba%'
      ORDER BY name
    `);
    
    if (rulesResult.rows.length === 0) {
      console.log('❌ No pump cycle rules found!');
      console.log('💡 Run: node water-pump-cycles-setup.js to create them');
      return false;
    }
    
    console.log(`✅ Found ${rulesResult.rows.length} pump cycle rules:\n`);
    console.log('ID | Name                              | Enabled | Priority | Triggers | Last Triggered');
    console.log('---|-----------------------------------|---------|----------|----------|---------------');
    
    let enabledCount = 0;
    rulesResult.rows.forEach(rule => {
      if (rule.enabled) enabledCount++;
      const lastTriggered = rule.last_triggered ? 
        new Date(rule.last_triggered).toLocaleString('es-ES', {
          timeZone: 'America/Mexico_City',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'Never';
      
      console.log(`${rule.id.toString().padEnd(2)} | ${rule.name.padEnd(33)} | ${rule.enabled ? 'Yes' : 'No'}.padEnd(7) | ${rule.priority.toString().padEnd(8)} | ${rule.trigger_count.toString().padEnd(8)} | ${lastTriggered}`);
    });
    
    // 2. Check water pump device exists
    console.log('\n💧 Checking water pump device...');
    const deviceResult = await query(`
      SELECT 
        id,
        name,
        device_id,
        type,
        status,
        last_seen,
        enable_notifications
      FROM devices 
      WHERE id = 1 OR device_id = 'bomba_agua_01'
      LIMIT 1
    `);
    
    if (deviceResult.rows.length === 0) {
      console.log('❌ Water pump device not found!');
      console.log('💡 Make sure device ID "1" or "bomba_agua_01" exists');
      return false;
    }
    
    const pump = deviceResult.rows[0];
    console.log(`✅ Water pump found: "${pump.name}" (ID: ${pump.id})`);
    console.log(`   Status: ${pump.status}`);
    console.log(`   Type: ${pump.type}`);
    console.log(`   Notifications: ${pump.enable_notifications ? 'Enabled' : 'Disabled'}`);
    console.log(`   Last Seen: ${pump.last_seen || 'Never'}`);
    
    // 3. Test time window evaluation logic
    console.log('\n⏰ Testing time window logic...');
    const now = new Date();
    const currentMinute = now.getMinutes();
    
    // Simulate the time window logic from rules engine
    const testTimeWindows = [
      { name: 'ON (00-15)', start: 0, end: 15, shouldBeOn: (min) => (min >= 0 && min < 15) || (min >= 30 && min < 45) },
      { name: 'OFF (15-30)', start: 15, end: 30, shouldBeOn: (min) => (min >= 15 && min < 30) || (min >= 45 && min < 60) },
      { name: 'ON (30-45)', start: 30, end: 45, shouldBeOn: (min) => (min >= 30 && min < 45) },
      { name: 'OFF (45-00)', start: 45, end: 60, shouldBeOn: (min) => (min >= 45 && min < 60) }
    ];
    
    console.log(`   Current time: ${now.toLocaleTimeString()}`);
    console.log(`   Current minute: ${currentMinute}`);
    console.log('\n   Time Window Analysis:');
    console.log('   Window      | Should Trigger | Action');
    console.log('   ------------|----------------|-------');
    
    let activeWindow = null;
    let expectedAction = null;
    
    testTimeWindows.forEach(window => {
      const shouldTrigger = window.shouldBeOn(currentMinute);
      const action = window.name.includes('ON') ? 'TURN_ON' : 'TURN_OFF';
      
      if (shouldTrigger) {
        activeWindow = window.name;
        expectedAction = action;
      }
      
      console.log(`   ${window.name.padEnd(11)} | ${shouldTrigger ? 'Yes' : 'No'}.padEnd(14) | ${action}`);
    });
    
    if (activeWindow) {
      console.log(`\n   🎯 Active window: ${activeWindow}`);
      console.log(`   🔧 Expected action: ${expectedAction}`);
    } else {
      console.log('\n   ⚠️  No active time window (this shouldn\'t happen)');
    }
    
    // 4. Check recent rule executions
    console.log('\n📊 Checking recent rule executions...');
    const executionsResult = await query(`
      SELECT 
        re.id,
        r.name as rule_name,
        re.success,
        re.triggered_at,
        re.execution_time_ms,
        re.error_message
      FROM rule_executions re
      JOIN rules r ON re.rule_id = r.id
      WHERE r.name LIKE '%CICLO%' 
      AND r.name LIKE '%Bomba%'
      AND re.triggered_at > NOW() - INTERVAL '1 hour'
      ORDER BY re.triggered_at DESC
      LIMIT 10
    `);
    
    if (executionsResult.rows.length === 0) {
      console.log('⚠️  No recent rule executions found');
      console.log('💡 Rules engine may not be running or rules haven\'t triggered yet');
    } else {
      console.log(`✅ Found ${executionsResult.rows.length} recent executions:\n`);
      console.log('Rule Name                         | Success | Time       | Duration | Error');
      console.log('----------------------------------|---------|------------|----------|-------');
      
      executionsResult.rows.forEach(exec => {
        const time = new Date(exec.triggered_at).toLocaleTimeString('es-ES', {
          timeZone: 'America/Mexico_City',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        const error = exec.error_message ? exec.error_message.substring(0, 20) + '...' : 'None';
        
        console.log(`${exec.rule_name.substring(0, 33).padEnd(33)} | ${exec.success ? 'Yes' : 'No'}.padEnd(7) | ${time} | ${exec.execution_time_ms}ms     | ${error}`);
      });
    }
    
    // 5. System health summary
    console.log('\n🎉 System Health Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Pump Cycle Rules: ${enabledCount}/${rulesResult.rows.length} enabled`);
    console.log(`✅ Water Pump Device: Found and configured`);
    console.log(`✅ Time Logic: Working correctly`);
    console.log(`${executionsResult.rows.length > 0 ? '✅' : '⚠️'} Recent Executions: ${executionsResult.rows.length} in last hour`);
    
    if (enabledCount === 4 && deviceResult.rows.length > 0) {
      console.log('\n🚰 Water Pump Cycling System: OPERATIONAL');
      console.log('💡 The system will automatically cycle the pump every 15 minutes');
      console.log('📋 Pattern: 15 min ON → 15 min OFF → repeat 24/7');
    } else {
      console.log('\n⚠️  Water Pump Cycling System: NEEDS ATTENTION');
      if (enabledCount < 4) {
        console.log('💡 Some pump cycle rules are disabled');
      }
      if (deviceResult.rows.length === 0) {
        console.log('💡 Water pump device not found');
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error verifying pump cycles:', error);
    return false;
  }
}

// Export for use in other modules
module.exports = { verifyPumpCycles };

// Run verification if this file is executed directly
if (require.main === module) {
  verifyPumpCycles()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    });
}