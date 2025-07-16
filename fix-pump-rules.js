#!/usr/bin/env node

/**
 * Fix pump rules that are referencing non-existent device ID 6
 * Update them to reference device ID 1 (the legitimate water pump)
 */

const { query } = require('./src/config/database');

async function fixPumpRules() {
  try {
    console.log('🔧 Fixing pump rules...');
    
    // First, let's see what rules have device actions pointing to device ID 6
    const checkRulesQuery = `
      SELECT id, name, actions, enabled 
      FROM rules 
      WHERE actions::text LIKE '%"deviceId":"6"%'
    `;
    
    const rulesResult = await query(checkRulesQuery);
    console.log(`Found ${rulesResult.rows.length} rules referencing device ID 6:`);
    
    for (const rule of rulesResult.rows) {
      console.log(`  - Rule ${rule.id}: ${rule.name} (enabled: ${rule.enabled})`);
      console.log(`    Actions:`, JSON.stringify(rule.actions, null, 2));
      
      // Update the actions to reference device ID 1 instead of 6
      const updatedActions = JSON.stringify(rule.actions).replace(/"deviceId":"6"/g, '"deviceId":"1"');
      
      const updateQuery = `
        UPDATE rules 
        SET actions = $1::jsonb, 
            enabled = true,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;
      
      await query(updateQuery, [updatedActions, rule.id]);
      console.log(`  ✅ Updated rule ${rule.id} to reference device ID 1`);
    }
    
    // Verify the changes
    console.log('\n🔍 Verifying fixes...');
    const verifyQuery = `
      SELECT id, name, actions, enabled 
      FROM rules 
      WHERE actions::text LIKE '%"deviceId":"1"%' 
      AND name LIKE '%BOMBA%'
    `;
    
    const verifyResult = await query(verifyQuery);
    console.log(`Found ${verifyResult.rows.length} rules now correctly referencing device ID 1:`);
    
    for (const rule of verifyResult.rows) {
      console.log(`  ✅ Rule ${rule.id}: ${rule.name} (enabled: ${rule.enabled})`);
    }
    
    console.log('\n✅ Pump rules fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing pump rules:', error);
    process.exit(1);
  }
}

// Run the fix
fixPumpRules()
  .then(() => {
    console.log('🎉 Fix completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  });