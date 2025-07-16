#!/usr/bin/env node

require('dotenv').config();
const { pool } = require('../config/database');
const databaseInitService = require('../services/databaseInitService');
const auditLogService = require('../services/auditLogService');
const encryptionService = require('../services/encryptionService');
const readline = require('readline');
const fs = require('fs').promises;

/**
 * Secure Database Administration CLI
 * Replaces pgAdmin with a secure command-line interface
 */
class DatabaseAdminCLI {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.adminUser = {
      id: 0,
      username: 'cli-admin',
      role: 'admin'
    };
  }

  /**
   * Main CLI menu
   */
  async showMenu() {
    console.log('\n🔒 Secure Database Administration CLI');
    console.log('=====================================');
    console.log('1. Database Status');
    console.log('2. Table Information');
    console.log('3. User Management');
    console.log('4. Security Audit');
    console.log('5. Database Backup');
    console.log('6. Schema Migration');
    console.log('7. Query Executor (Limited)');
    console.log('8. System Health Check');
    console.log('9. Exit');
    console.log('=====================================');

    const choice = await this.prompt('Select an option (1-9): ');

    switch (choice) {
    case '1':
      await this.showDatabaseStatus();
      break;
    case '2':
      await this.showTableInformation();
      break;
    case '3':
      await this.userManagement();
      break;
    case '4':
      await this.securityAudit();
      break;
    case '5':
      await this.createBackup();
      break;
    case '6':
      await this.schemaMigration();
      break;
    case '7':
      await this.queryExecutor();
      break;
    case '8':
      await this.systemHealthCheck();
      break;
    case '9':
      await this.exit();
      return;
    default:
      console.log('❌ Invalid option. Please try again.');
    }

    await this.showMenu();
  }

  /**
   * Show database status
   */
  async showDatabaseStatus() {
    try {
      console.log('\n📊 Database Status');
      console.log('==================');

      const status = await databaseInitService.getStatus();

      console.log(`🔗 Connected: ${status.connected ? '✅' : '❌'}`);
      console.log(`🔢 Schema Version: ${status.schema_version}`);
      console.log(`🔒 Security Tables: ${status.security_tables_ready ? '✅' : '❌'}`);

      if (status.tables) {
        const existing = status.tables.filter(t => t.exists).length;
        const total = status.tables.length;
        console.log(`📋 Tables: ${existing}/${total} ready`);

        if (existing < total) {
          console.log('\n⚠️ Missing tables:');
          status.tables.filter(t => !t.exists).forEach(t => {
            console.log(`   - ${t.table}`);
          });
        }
      }

      // Get connection info
      const connInfo = await pool.query(`
        SELECT 
          current_database() as database,
          current_user as user,
          version() as version,
          NOW() as current_time
      `);

      const info = connInfo.rows[0];
      console.log(`\n📄 Database: ${info.database}`);
      console.log(`👤 User: ${info.user}`);
      console.log(`⏰ Time: ${info.current_time}`);
      console.log(`🏷️ Version: ${info.version.split(' ')[0]} ${info.version.split(' ')[1]}`);

    } catch (error) {
      console.error('❌ Error getting database status:', error.message);
    }

    await this.prompt('\nPress Enter to continue...');
  }

  /**
   * Show table information
   */
  async showTableInformation() {
    try {
      console.log('\n📋 Table Information');
      console.log('====================');

      const tables = await pool.query(`
        SELECT 
          t.table_name,
          t.table_type,
          COALESCE(c.column_count, 0) as columns,
          COALESCE(s.row_count, 0) as estimated_rows
        FROM information_schema.tables t
        LEFT JOIN (
          SELECT table_name, COUNT(*) as column_count
          FROM information_schema.columns
          WHERE table_schema = 'public'
          GROUP BY table_name
        ) c ON t.table_name = c.table_name
        LEFT JOIN (
          SELECT 
            schemaname||'.'||tablename as full_name,
            n_tup_ins + n_tup_upd as row_count
          FROM pg_stat_user_tables
        ) s ON 'public.'||t.table_name = s.full_name
        WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name
      `);

      console.log('Table Name'.padEnd(25) + 'Columns'.padEnd(10) + 'Est. Rows');
      console.log('-'.repeat(50));

      tables.rows.forEach(row => {
        console.log(
          row.table_name.padEnd(25) +
          row.columns.toString().padEnd(10) +
          row.estimated_rows.toString()
        );
      });

      const tableName = await this.prompt('\nEnter table name for details (or Enter to skip): ');

      if (tableName.trim()) {
        await this.showTableDetails(tableName.trim());
      }

    } catch (error) {
      console.error('❌ Error getting table information:', error.message);
    }

    await this.prompt('\nPress Enter to continue...');
  }

  /**
   * Show detailed table information
   */
  async showTableDetails(tableName) {
    try {
      console.log(`\n📄 Table Details: ${tableName}`);
      console.log('='.repeat(30 + tableName.length));

      // Get columns
      const columns = await pool.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_name = $1
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `, [tableName]);

      if (columns.rows.length === 0) {
        console.log('❌ Table not found or no columns');
        return;
      }

      console.log('\nColumns:');
      console.log('Name'.padEnd(25) + 'Type'.padEnd(20) + 'Nullable'.padEnd(10) + 'Default');
      console.log('-'.repeat(80));

      columns.rows.forEach(col => {
        const type = col.character_maximum_length
          ? `${col.data_type}(${col.character_maximum_length})`
          : col.data_type;

        console.log(
          col.column_name.padEnd(25) +
          type.padEnd(20) +
          col.is_nullable.padEnd(10) +
          (col.column_default || 'NULL')
        );
      });

      // Get indexes
      const indexes = await pool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = $1
        AND schemaname = 'public'
      `, [tableName]);

      if (indexes.rows.length > 0) {
        console.log('\nIndexes:');
        indexes.rows.forEach(idx => {
          console.log(`- ${idx.indexname}`);
        });
      }

    } catch (error) {
      console.error('❌ Error getting table details:', error.message);
    }
  }

  /**
   * User management
   */
  async userManagement() {
    console.log('\n👥 User Management');
    console.log('==================');
    console.log('1. List Users');
    console.log('2. Create User');
    console.log('3. Reset Password');
    console.log('4. Deactivate User');
    console.log('5. Back to main menu');

    const choice = await this.prompt('Select an option (1-5): ');

    switch (choice) {
    case '1':
      await this.listUsers();
      break;
    case '2':
      await this.createUser();
      break;
    case '3':
      await this.resetPassword();
      break;
    case '4':
      await this.deactivateUser();
      break;
    case '5':
      return;
    default:
      console.log('❌ Invalid option');
    }

    await this.userManagement();
  }

  /**
   * List users
   */
  async listUsers() {
    try {
      const users = await pool.query(`
        SELECT 
          id,
          username,
          email,
          role,
          is_active,
          created_at,
          last_login,
          failed_login_attempts,
          two_factor_enabled
        FROM users
        ORDER BY created_at DESC
      `);

      console.log('\n👥 Users List');
      console.log('ID'.padEnd(5) + 'Username'.padEnd(20) + 'Role'.padEnd(10) + 'Active'.padEnd(8) + '2FA'.padEnd(5) + 'Failures');
      console.log('-'.repeat(70));

      users.rows.forEach(user => {
        console.log(
          user.id.toString().padEnd(5) +
          user.username.padEnd(20) +
          user.role.padEnd(10) +
          (user.is_active ? 'Yes' : 'No').padEnd(8) +
          (user.two_factor_enabled ? 'Yes' : 'No').padEnd(5) +
          (user.failed_login_attempts || 0).toString()
        );
      });

    } catch (error) {
      console.error('❌ Error listing users:', error.message);
    }
  }

  /**
   * Security audit
   */
  async securityAudit() {
    try {
      console.log('\n🔒 Security Audit');
      console.log('=================');

      // Recent security events
      const recentEvents = await pool.query(`
        SELECT 
          event_type,
          risk_level,
          COUNT(*) as count,
          MAX(timestamp) as last_occurrence
        FROM audit_logs
        WHERE timestamp > NOW() - INTERVAL '24 hours'
        GROUP BY event_type, risk_level
        ORDER BY risk_level DESC, count DESC
        LIMIT 10
      `);

      console.log('\n📊 Recent Security Events (24h):');
      console.log('Event Type'.padEnd(30) + 'Risk'.padEnd(10) + 'Count'.padEnd(8) + 'Last Seen');
      console.log('-'.repeat(70));

      recentEvents.rows.forEach(event => {
        console.log(
          event.event_type.padEnd(30) +
          event.risk_level.padEnd(10) +
          event.count.toString().padEnd(8) +
          new Date(event.last_occurrence).toLocaleString()
        );
      });

      // Failed login attempts
      const failedLogins = await pool.query(`
        SELECT 
          username,
          failed_login_attempts,
          account_locked_until,
          last_login_ip
        FROM users
        WHERE failed_login_attempts > 0
        ORDER BY failed_login_attempts DESC
      `);

      if (failedLogins.rows.length > 0) {
        console.log('\n⚠️ Users with Failed Login Attempts:');
        failedLogins.rows.forEach(user => {
          const locked = user.account_locked_until && new Date(user.account_locked_until) > new Date();
          console.log(`- ${user.username}: ${user.failed_login_attempts} attempts${locked ? ' (LOCKED)' : ''}`);
        });
      }

      // High-risk events
      const highRiskEvents = await pool.query(`
        SELECT 
          event_type,
          action,
          client_ip,
          timestamp
        FROM audit_logs
        WHERE risk_level = 'high'
        AND timestamp > NOW() - INTERVAL '7 days'
        ORDER BY timestamp DESC
        LIMIT 5
      `);

      if (highRiskEvents.rows.length > 0) {
        console.log('\n🚨 Recent High-Risk Events:');
        highRiskEvents.rows.forEach(event => {
          console.log(`- ${event.event_type}/${event.action} from ${event.client_ip} at ${new Date(event.timestamp).toLocaleString()}`);
        });
      }

    } catch (error) {
      console.error('❌ Error running security audit:', error.message);
    }

    await this.prompt('\nPress Enter to continue...');
  }

  /**
   * Create database backup
   */
  async createBackup() {
    try {
      console.log('\n💾 Creating Database Backup');
      console.log('===========================');

      const backupFile = await databaseInitService.createBackup();

      console.log('✅ Backup created successfully!');
      console.log(`📁 File: ${backupFile}`);

      // Log backup creation
      await auditLogService.logSystemEvent(
        'DATABASE_BACKUP_CREATED',
        { backup_file: backupFile },
        this.adminUser,
        'localhost'
      );

    } catch (error) {
      console.error('❌ Error creating backup:', error.message);
    }

    await this.prompt('\nPress Enter to continue...');
  }

  /**
   * Schema migration
   */
  async schemaMigration() {
    try {
      console.log('\n🔄 Schema Migration');
      console.log('===================');

      const currentVersion = await databaseInitService.getSchemaVersion();
      console.log(`Current schema version: ${currentVersion}`);

      console.log('\nAvailable actions:');
      console.log('1. Re-run initialization');
      console.log('2. Check integrity');
      console.log('3. Back to main menu');

      const choice = await this.prompt('Select an option (1-3): ');

      switch (choice) {
      case '1':
        console.log('🔄 Re-running database initialization...');
        await databaseInitService.initialize();
        console.log('✅ Initialization completed');
        break;
      case '2':
        console.log('🔍 Checking database integrity...');
        const isValid = await databaseInitService.verifyIntegrity();
        console.log(isValid ? '✅ Database integrity OK' : '❌ Integrity issues found');
        break;
      case '3':
        return;
      }

    } catch (error) {
      console.error('❌ Error in schema migration:', error.message);
    }

    await this.prompt('\nPress Enter to continue...');
  }

  /**
   * Limited query executor (read-only for safety)
   */
  async queryExecutor() {
    console.log('\n💻 Query Executor (Read-Only)');
    console.log('=============================');
    console.log('⚠️ Only SELECT queries are allowed for security');

    const query = await this.prompt('\nEnter your SELECT query: ');

    if (!query.trim()) {
      return;
    }

    // Security check - only allow SELECT queries
    const normalizedQuery = query.trim().toUpperCase();
    if (!normalizedQuery.startsWith('SELECT')) {
      console.log('❌ Only SELECT queries are allowed');
      return;
    }

    if (normalizedQuery.includes('DELETE') ||
        normalizedQuery.includes('UPDATE') ||
        normalizedQuery.includes('INSERT') ||
        normalizedQuery.includes('DROP') ||
        normalizedQuery.includes('ALTER') ||
        normalizedQuery.includes('CREATE')) {
      console.log('❌ Query contains prohibited keywords');
      return;
    }

    try {
      const result = await pool.query(query);

      console.log('\n✅ Query executed successfully');
      console.log(`📊 Rows returned: ${result.rows.length}`);

      if (result.rows.length > 0) {
        // Show first few rows
        const displayRows = result.rows.slice(0, 10);
        console.log('\nResults (first 10 rows):');
        console.table(displayRows);

        if (result.rows.length > 10) {
          console.log(`... and ${result.rows.length - 10} more rows`);
        }
      }

      // Log query execution
      await auditLogService.logSystemEvent(
        'QUERY_EXECUTED',
        {
          query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
          rows_returned: result.rows.length
        },
        this.adminUser,
        'localhost'
      );

    } catch (error) {
      console.error('❌ Query error:', error.message);
    }

    await this.prompt('\nPress Enter to continue...');
  }

  /**
   * System health check
   */
  async systemHealthCheck() {
    try {
      console.log('\n🏥 System Health Check');
      console.log('======================');

      // Database connection
      const startTime = Date.now();
      await pool.query('SELECT 1');
      const dbLatency = Date.now() - startTime;
      console.log(`🔗 Database latency: ${dbLatency}ms`);

      // Table counts
      const tables = ['users', 'devices', 'rules', 'notifications', 'audit_logs'];
      for (const table of tables) {
        try {
          const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
          console.log(`📋 ${table}: ${result.rows[0].count} records`);
        } catch (error) {
          console.log(`❌ ${table}: Error reading table`);
        }
      }

      // Recent activity
      const recentActivity = await pool.query(`
        SELECT COUNT(*) as count
        FROM audit_logs
        WHERE timestamp > NOW() - INTERVAL '1 hour'
      `);
      console.log(`📊 Recent activity (1h): ${recentActivity.rows[0].count} events`);

      // Security status
      const securityStatus = await pool.query(`
        SELECT 
          COUNT(CASE WHEN two_factor_enabled THEN 1 END) as users_with_2fa,
          COUNT(*) as total_users
        FROM users
        WHERE is_active = true
      `);

      const sec = securityStatus.rows[0];
      console.log(`🔒 Security: ${sec.users_with_2fa}/${sec.total_users} users have 2FA enabled`);

    } catch (error) {
      console.error('❌ Error running health check:', error.message);
    }

    await this.prompt('\nPress Enter to continue...');
  }

  /**
   * Helper method to prompt user input
   */
  prompt(question) {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }

  /**
   * Exit the CLI
   */
  async exit() {
    console.log('\n👋 Goodbye!');
    this.rl.close();
    process.exit(0);
  }

  /**
   * Placeholder methods for user management
   */
  async createUser() {
    console.log('⚠️ User creation should be done through the main application for security');
  }

  async resetPassword() {
    console.log('⚠️ Password reset should be done through the main application for security');
  }

  async deactivateUser() {
    console.log('⚠️ User deactivation should be done through the main application for security');
  }
}

// Main execution
async function main() {
  const cli = new DatabaseAdminCLI();

  try {
    // Check database connection
    await databaseInitService.waitForDatabase(5);
    await cli.showMenu();
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    process.exit(1);
  }
}

// Run CLI if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = DatabaseAdminCLI;
