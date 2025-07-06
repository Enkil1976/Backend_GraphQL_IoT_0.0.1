require('dotenv').config();
const { pool } = require('./src/config/database');
const fs = require('fs');
const path = require('path');

async function fixProductionDatabase() {
  console.log('🔧 Fixing production database - Creating missing rule_executions table...');
  
  try {
    // Read the SQL script
    const sqlScript = fs.readFileSync(path.join(__dirname, 'sql', 'fix_production_database.sql'), 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = sqlScript.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      const trimmedStatement = statement.trim();
      if (trimmedStatement && !trimmedStatement.startsWith('--')) {
        console.log(`Executing: ${trimmedStatement.substring(0, 50)}...`);
        try {
          const result = await pool.query(trimmedStatement);
          if (result.rows && result.rows.length > 0) {
            console.log('Result:', result.rows);
          }
        } catch (error) {
          if (error.code === '42P07') {
            console.log('✅ Table already exists, skipping...');
          } else if (error.code === '42701') {
            console.log('✅ Column already exists, skipping...');
          } else {
            console.error(`❌ Error executing statement: ${error.message}`);
          }
        }
      }
    }
    
    // Verify rule_executions table exists
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'rule_executions'
      );
    `);
    
    if (checkTable.rows[0].exists) {
      console.log('✅ rule_executions table exists and is ready');
    } else {
      console.log('❌ rule_executions table was not created');
    }
    
    // Check devices table structure
    const deviceColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'devices' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Devices table structure:');
    deviceColumns.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    console.log('\n🎉 Production database fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing production database:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run database fix
if (require.main === module) {
  fixProductionDatabase().catch(error => {
    console.error('❌ Database fix failed:', error);
    process.exit(1);
  });
}

module.exports = { fixProductionDatabase };