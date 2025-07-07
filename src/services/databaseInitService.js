const { pool } = require('../config/database');
const auditLogService = require('./auditLogService');
const encryptionService = require('./encryptionService');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Secure Database Initialization Service
 * Handles automated database setup with security considerations
 */
class DatabaseInitService {
  constructor() {
    this.initializationLock = false;
    this.maxRetries = 30;
    this.retryDelay = 2000;
    this.requiredTables = [
      'users', 'devices', 'rules', 'notifications', 
      'temhum1', 'temhum2', 'calidad_agua', 'luxometro',
      'power_monitor_logs', 'rule_executions', 'weather_current',
      'audit_logs', 'scheduled_operations', 'operations_log'
    ];
    this.securityTables = [
      'audit_logs', 'user_sessions', 'security_events'
    ];
  }

  /**
   * Wait for database to be ready with exponential backoff
   */
  async waitForDatabase(maxRetries = this.maxRetries) {
    console.log('🔄 Waiting for database connection...');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Test connection with a simple query
        await pool.query('SELECT NOW() as current_time');
        console.log('✅ Database connection established');
        return true;
      } catch (error) {
        const delay = Math.min(this.retryDelay * Math.pow(1.5, attempt - 1), 30000);
        console.log(`⏳ Database not ready (attempt ${attempt}/${maxRetries}). Retrying in ${delay/1000}s...`);
        
        if (attempt === maxRetries) {
          throw new Error(`❌ Database failed to connect after ${maxRetries} attempts: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Check if a table exists
   */
  async tableExists(tableName) {
    try {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [tableName]);
      return result.rows[0].exists;
    } catch (error) {
      console.error(`Error checking table ${tableName}:`, error);
      return false;
    }
  }

  /**
   * Check if a column exists in a table
   */
  async columnExists(tableName, columnName) {
    try {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = $1 
          AND column_name = $2
          AND table_schema = 'public'
        );
      `, [tableName, columnName]);
      return result.rows[0].exists;
    } catch (error) {
      console.error(`Error checking column ${columnName} in table ${tableName}:`, error);
      return false;
    }
  }

  /**
   * Get database schema version
   */
  async getSchemaVersion() {
    try {
      const versionExists = await this.tableExists('schema_version');
      if (!versionExists) {
        return 0;
      }
      
      const result = await pool.query('SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1');
      return result.rows.length > 0 ? result.rows[0].version : 0;
    } catch (error) {
      console.error('Error getting schema version:', error);
      return 0;
    }
  }

  /**
   * Create schema version table
   */
  async createSchemaVersionTable() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_version (
          id SERIAL PRIMARY KEY,
          version INTEGER NOT NULL,
          description TEXT,
          applied_at TIMESTAMPTZ DEFAULT NOW(),
          checksum VARCHAR(64)
        );
      `);
      console.log('✅ Schema version table created');
    } catch (error) {
      console.error('Error creating schema version table:', error);
      throw error;
    }
  }

  /**
   * Apply database migration
   */
  async applyMigration(version, description, sqlCommands) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Calculate checksum for integrity
      const checksum = crypto.createHash('sha256')
        .update(sqlCommands.join('\n'))
        .digest('hex');
      
      // Check if migration already applied
      const existing = await client.query(
        'SELECT version FROM schema_version WHERE version = $1',
        [version]
      );
      
      if (existing.rows.length > 0) {
        console.log(`⏩ Migration v${version} already applied, skipping`);
        await client.query('ROLLBACK');
        return;
      }
      
      console.log(`🔄 Applying migration v${version}: ${description}`);
      
      // Execute migration commands
      for (const command of sqlCommands) {
        if (command.trim()) {
          await client.query(command);
        }
      }
      
      // Record migration
      await client.query(`
        INSERT INTO schema_version (version, description, checksum)
        VALUES ($1, $2, $3)
      `, [version, description, checksum]);
      
      await client.query('COMMIT');
      console.log(`✅ Migration v${version} applied successfully`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Migration v${version} failed:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Initialize security tables
   */
  async initializeSecurityTables() {
    console.log('🔒 Initializing security tables...');
    
    // Audit logs table (enhanced)
    await this.applyMigration(1001, 'Create audit logs table', [`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        event_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        event_type VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        user_id INTEGER,
        username VARCHAR(100),
        client_ip INET,
        user_agent TEXT,
        resource_type VARCHAR(100),
        resource_id VARCHAR(100),
        old_values JSONB,
        new_values JSONB,
        metadata JSONB,
        risk_level VARCHAR(20) DEFAULT 'low',
        success BOOLEAN DEFAULT true,
        error_message TEXT,
        session_id VARCHAR(255),
        checksum VARCHAR(64) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_level ON audit_logs(risk_level);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_client_ip ON audit_logs(client_ip);
    `]);

    // User sessions table
    await this.applyMigration(1002, 'Create user sessions table', [`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_activity TIMESTAMPTZ DEFAULT NOW(),
        client_ip INET,
        user_agent TEXT,
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}'
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, expires_at);
    `]);

    // Security events table
    await this.applyMigration(1003, 'Create security events table', [`
      CREATE TABLE IF NOT EXISTS security_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        severity VARCHAR(20) DEFAULT 'low',
        client_ip INET,
        user_agent TEXT,
        details JSONB,
        resolved BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        resolved_by INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
      CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(resolved);
      CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);
    `]);
  }

  /**
   * Add security columns to existing tables
   */
  async enhanceExistingTables() {
    console.log('🔧 Enhancing existing tables with security features...');
    
    // Enhance users table
    const userSecurityColumns = [
      'two_factor_enabled BOOLEAN DEFAULT false',
      'two_factor_secret TEXT',
      'backup_codes JSONB',
      'failed_login_attempts INTEGER DEFAULT 0',
      'account_locked_until TIMESTAMPTZ',
      'last_login_ip INET',
      'password_changed_at TIMESTAMPTZ DEFAULT NOW()',
      'security_questions JSONB'
    ];

    for (const column of userSecurityColumns) {
      const [columnName] = column.split(' ');
      const hasColumn = await this.columnExists('users', columnName);
      
      if (!hasColumn) {
        try {
          await pool.query(`ALTER TABLE users ADD COLUMN ${column}`);
          console.log(`✅ Added column ${columnName} to users table`);
        } catch (error) {
          console.warn(`⚠️ Could not add column ${columnName}:`, error.message);
        }
      }
    }

    // Enhance devices table
    const deviceSecurityColumns = [
      'enable_notifications BOOLEAN DEFAULT true',
      'last_controlled_by INTEGER',
      'last_controlled_at TIMESTAMPTZ',
      'security_level VARCHAR(20) DEFAULT \'standard\''
    ];

    for (const column of deviceSecurityColumns) {
      const [columnName] = column.split(' ');
      const hasColumn = await this.columnExists('devices', columnName);
      
      if (!hasColumn) {
        try {
          await pool.query(`ALTER TABLE devices ADD COLUMN ${column}`);
          console.log(`✅ Added column ${columnName} to devices table`);
        } catch (error) {
          console.warn(`⚠️ Could not add column ${columnName}:`, error.message);
        }
      }
    }
  }

  /**
   * Create database backup
   */
  async createBackup() {
    try {
      console.log('💾 Creating database backup...');
      
      // Get database structure
      const tables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const backupData = {
        timestamp: new Date().toISOString(),
        tables: tables.rows.map(row => row.table_name),
        schema_version: await this.getSchemaVersion()
      };

      // Create encrypted backup
      const backupPassword = process.env.BACKUP_PASSWORD || 'default-backup-password';
      const encryptedBackup = await encryptionService.createSecureBackup(backupData, backupPassword);
      
      // Save to file
      const backupDir = './backups';
      try {
        await fs.mkdir(backupDir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
      
      const backupFile = path.join(backupDir, `db-backup-${Date.now()}.json`);
      await fs.writeFile(backupFile, JSON.stringify(encryptedBackup, null, 2));
      
      console.log(`✅ Database backup created: ${backupFile}`);
      return backupFile;
      
    } catch (error) {
      console.error('❌ Backup creation failed:', error);
      throw error;
    }
  }

  /**
   * Verify database integrity
   */
  async verifyIntegrity() {
    console.log('🔍 Verifying database integrity...');
    
    const issues = [];
    
    // Check required tables
    for (const table of this.requiredTables) {
      const exists = await this.tableExists(table);
      if (!exists) {
        issues.push(`Missing required table: ${table}`);
      }
    }

    // Check critical indexes
    const criticalIndexes = [
      'idx_audit_logs_timestamp',
      'idx_user_sessions_user_id',
      'idx_security_events_type'
    ];

    for (const index of criticalIndexes) {
      try {
        const result = await pool.query(`
          SELECT indexname FROM pg_indexes 
          WHERE schemaname = 'public' AND indexname = $1
        `, [index]);
        
        if (result.rows.length === 0) {
          issues.push(`Missing critical index: ${index}`);
        }
      } catch (error) {
        issues.push(`Error checking index ${index}: ${error.message}`);
      }
    }

    // Check data consistency
    try {
      const userCount = await pool.query('SELECT COUNT(*) FROM users');
      const deviceCount = await pool.query('SELECT COUNT(*) FROM devices');
      
      console.log(`📊 Database statistics: ${userCount.rows[0].count} users, ${deviceCount.rows[0].count} devices`);
    } catch (error) {
      issues.push(`Error getting database statistics: ${error.message}`);
    }

    if (issues.length > 0) {
      console.warn('⚠️ Database integrity issues found:');
      issues.forEach(issue => console.warn(`   - ${issue}`));
      return false;
    }

    console.log('✅ Database integrity verified');
    return true;
  }

  /**
   * Main initialization function
   */
  async initialize() {
    if (this.initializationLock) {
      console.log('⏳ Database initialization already in progress...');
      return;
    }

    this.initializationLock = true;
    
    try {
      console.log('🚀 Starting secure database initialization...');
      
      // Step 1: Wait for database
      await this.waitForDatabase();
      
      // Step 2: Create schema version table
      await this.createSchemaVersionTable();
      
      // Step 3: Run existing setup if needed
      const currentVersion = await this.getSchemaVersion();
      
      if (currentVersion === 0) {
        console.log('📋 Running initial database setup...');
        
        // Check if we need to run the main setup
        const usersExists = await this.tableExists('users');
        if (!usersExists) {
          const { setupDatabase } = require('../../setup-database');
          await setupDatabase();
          
          // Mark initial setup as applied
          await this.applyMigration(1000, 'Initial database setup', ['-- Initial setup completed']);
        }
      }
      
      // Step 4: Initialize security tables
      await this.initializeSecurityTables();
      
      // Step 5: Enhance existing tables
      await this.enhanceExistingTables();
      
      // Step 6: Create backup
      if (process.env.AUTO_BACKUP === 'true') {
        await this.createBackup();
      }
      
      // Step 7: Verify integrity
      const integrityOk = await this.verifyIntegrity();
      
      if (!integrityOk) {
        throw new Error('Database integrity verification failed');
      }
      
      // Step 8: Log initialization
      await auditLogService.logSystemEvent(
        'DATABASE_INITIALIZED',
        {
          schema_version: await this.getSchemaVersion(),
          tables_count: this.requiredTables.length,
          security_features_enabled: true
        },
        null,
        null
      );
      
      console.log('🎉 Secure database initialization completed successfully!');
      return true;
      
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    } finally {
      this.initializationLock = false;
    }
  }

  /**
   * Get initialization status
   */
  async getStatus() {
    try {
      const isConnected = await this.waitForDatabase(1);
      const schemaVersion = await this.getSchemaVersion();
      const tablesExist = [];
      
      for (const table of this.requiredTables) {
        const exists = await this.tableExists(table);
        tablesExist.push({ table, exists });
      }
      
      return {
        connected: isConnected,
        schema_version: schemaVersion,
        tables: tablesExist,
        security_tables_ready: await this.tableExists('audit_logs'),
        initialization_lock: this.initializationLock
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        initialization_lock: this.initializationLock
      };
    }
  }
}

module.exports = new DatabaseInitService();