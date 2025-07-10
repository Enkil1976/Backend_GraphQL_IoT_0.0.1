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
      'power_monitor_logs', 'rule_executions', 'weather_current',
      'audit_logs', 'scheduled_operations', 'operations_log',
      // Dynamic sensor tables
      'sensors', 'sensor_data_generic', 'sensor_statistics', 'sensor_alerts',
      'temp_pressure_data', 'soil_moisture_data', 'co2_data', 'motion_data',
      'custom_sensor_data'
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
        console.log(`⏳ Database not ready (attempt ${attempt}/${maxRetries}). Retrying in ${delay / 1000}s...`);

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

    // Missing sensor tables (addresses API issues with LUXOMETRO and POWER_MONITOR)
    await this.applyMigration(1004, 'Create missing sensor tables', [`
      -- Create luxometro table (light sensor data)
      CREATE TABLE IF NOT EXISTS luxometro (
        id SERIAL PRIMARY KEY,
        light DECIMAL(10,2),
        white_light DECIMAL(10,2),
        raw_light DECIMAL(10,2),
        rssi INTEGER,
        boot INTEGER DEFAULT 0,
        mem INTEGER DEFAULT 0,
        lmin DECIMAL(10,2),
        lmax DECIMAL(10,2),
        lavg DECIMAL(10,2),
        wmin DECIMAL(10,2),
        wmax DECIMAL(10,2),
        wavg DECIMAL(10,2),
        total INTEGER DEFAULT 0,
        errors INTEGER DEFAULT 0,
        received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,
    `-- Create power_monitor_logs table (power consumption data)
      CREATE TABLE IF NOT EXISTS power_monitor_logs (
        id SERIAL PRIMARY KEY,
        device_hardware_id VARCHAR(50) NOT NULL,
        device_id INTEGER REFERENCES devices(id),
        watts DECIMAL(8,2),
        voltage DECIMAL(6,2),
        current DECIMAL(6,2),
        frequency DECIMAL(4,1),
        power_factor DECIMAL(4,3),
        rssi INTEGER,
        mem INTEGER DEFAULT 0,
        boot INTEGER DEFAULT 0,
        received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,
    `-- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_luxometro_received_at ON luxometro(received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_luxometro_light ON luxometro(light);
      CREATE INDEX IF NOT EXISTS idx_power_monitor_logs_device_hardware_id ON power_monitor_logs(device_hardware_id);
      CREATE INDEX IF NOT EXISTS idx_power_monitor_logs_device_id ON power_monitor_logs(device_id);
      CREATE INDEX IF NOT EXISTS idx_power_monitor_logs_received_at ON power_monitor_logs(received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_power_monitor_logs_watts ON power_monitor_logs(watts);`
    ]);

    // Fix notifications table structure (addresses notification query issues)
    await this.applyMigration(1005, 'Fix notifications table structure', [`
      -- Ensure notifications table exists with proper structure
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'INFO_MESSAGE',
        priority VARCHAR(20) DEFAULT 'medium',
        channels TEXT DEFAULT 'webhook',
        status VARCHAR(20) DEFAULT 'pending',
        user_id INTEGER REFERENCES users(id),
        source VARCHAR(50) DEFAULT 'SYSTEM',
        source_id VARCHAR(100),
        metadata JSONB DEFAULT '{}',
        read_at TIMESTAMP WITH TIME ZONE,
        sent_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`
    ]);

    // Add missing columns to existing notifications table
    await this.applyMigration(1006, 'Add missing columns to notifications table', [`
      -- Add missing columns if they don't exist
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'SYSTEM';
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source_id VARCHAR(100);
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'INFO_MESSAGE';
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`
    ]);

    // Create indexes for notifications (after columns exist)
    await this.applyMigration(1007, 'Create notifications table indexes', [`
      -- Create indexes for notifications
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
      CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);`
    ]);

    // Create dynamic sensor tables (for BMP280 and other dynamic sensors)
    await this.applyMigration(1008, 'Create dynamic sensor tables', [`
      -- Main sensors registry table
      CREATE TABLE IF NOT EXISTS sensors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        sensor_type VARCHAR(50) NOT NULL,
        hardware_id VARCHAR(100) UNIQUE NOT NULL,
        mqtt_topic VARCHAR(200) NOT NULL,
        location VARCHAR(200),
        description TEXT,
        configuration JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );`,
    `-- Generic sensor data table for flexible storage
      CREATE TABLE IF NOT EXISTS sensor_data_generic (
        id SERIAL PRIMARY KEY,
        sensor_id INTEGER REFERENCES sensors(id) ON DELETE CASCADE,
        payload JSONB NOT NULL,
        received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );`,
    `-- Sensor statistics table
      CREATE TABLE IF NOT EXISTS sensor_statistics (
        id SERIAL PRIMARY KEY,
        sensor_id INTEGER REFERENCES sensors(id) ON DELETE CASCADE,
        metric_name VARCHAR(50) NOT NULL,
        min_value DECIMAL(15,6),
        max_value DECIMAL(15,6),
        avg_value DECIMAL(15,6),
        count INTEGER DEFAULT 0,
        last_calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        period_start TIMESTAMPTZ,
        period_end TIMESTAMPTZ,
        UNIQUE(sensor_id, metric_name, period_start)
      );`,
    `-- Sensor alerts table
      CREATE TABLE IF NOT EXISTS sensor_alerts (
        id SERIAL PRIMARY KEY,
        sensor_id INTEGER REFERENCES sensors(id) ON DELETE CASCADE,
        alert_type VARCHAR(50) NOT NULL,
        condition_field VARCHAR(50) NOT NULL,
        condition_operator VARCHAR(10) NOT NULL,
        condition_value DECIMAL(15,6) NOT NULL,
        message_template TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );`,
    `-- Temperature and pressure data table (for BMP280 and similar sensors)
      CREATE TABLE IF NOT EXISTS temp_pressure_data (
        id SERIAL PRIMARY KEY,
        sensor_id INTEGER REFERENCES sensors(id) ON DELETE CASCADE,
        temperatura DECIMAL(5,2) NOT NULL,
        presion DECIMAL(10,2) NOT NULL,
        altitude DECIMAL(8,2),
        rssi INTEGER,
        boot INTEGER DEFAULT 0,
        mem INTEGER,
        received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );`,
    `-- Soil moisture data table
      CREATE TABLE IF NOT EXISTS soil_moisture_data (
        id SERIAL PRIMARY KEY,
        sensor_id INTEGER REFERENCES sensors(id) ON DELETE CASCADE,
        humedad_suelo DECIMAL(5,2) NOT NULL,
        temperatura_suelo DECIMAL(5,2),
        conductividad DECIMAL(8,2),
        nitrogeno DECIMAL(6,2),
        fosforo DECIMAL(6,2),
        potasio DECIMAL(6,2),
        rssi INTEGER,
        boot INTEGER DEFAULT 0,
        mem INTEGER,
        received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );`,
    `-- CO2 data table
      CREATE TABLE IF NOT EXISTS co2_data (
        id SERIAL PRIMARY KEY,
        sensor_id INTEGER REFERENCES sensors(id) ON DELETE CASCADE,
        co2 DECIMAL(8,2) NOT NULL,
        tvoc DECIMAL(8,2),
        temperatura DECIMAL(5,2),
        humedad DECIMAL(5,2),
        rssi INTEGER,
        boot INTEGER DEFAULT 0,
        mem INTEGER,
        received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );`,
    `-- Motion detection data table
      CREATE TABLE IF NOT EXISTS motion_data (
        id SERIAL PRIMARY KEY,
        sensor_id INTEGER REFERENCES sensors(id) ON DELETE CASCADE,
        motion_detected BOOLEAN NOT NULL,
        confidence DECIMAL(5,2),
        distance DECIMAL(6,2),
        rssi INTEGER,
        boot INTEGER DEFAULT 0,
        mem INTEGER,
        received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );`,
    `-- Custom sensor data table for flexible sensor types
      CREATE TABLE IF NOT EXISTS custom_sensor_data (
        id SERIAL PRIMARY KEY,
        sensor_id INTEGER REFERENCES sensors(id) ON DELETE CASCADE,
        value DECIMAL(15,6) NOT NULL,
        unit VARCHAR(20),
        rssi INTEGER,
        boot INTEGER DEFAULT 0,
        mem INTEGER,
        received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );`
    ]);

    // Create indexes for dynamic sensor tables
    await this.applyMigration(1009, 'Create dynamic sensor table indexes', [`
      -- Sensors table indexes
      CREATE INDEX IF NOT EXISTS idx_sensors_sensor_type ON sensors(sensor_type);
      CREATE INDEX IF NOT EXISTS idx_sensors_hardware_id ON sensors(hardware_id);
      CREATE INDEX IF NOT EXISTS idx_sensors_is_active ON sensors(is_active);
      CREATE INDEX IF NOT EXISTS idx_sensors_created_at ON sensors(created_at DESC);
      
      -- Sensor data generic indexes
      CREATE INDEX IF NOT EXISTS idx_sensor_data_generic_sensor_id ON sensor_data_generic(sensor_id);
      CREATE INDEX IF NOT EXISTS idx_sensor_data_generic_received_at ON sensor_data_generic(received_at DESC);
      
      -- Sensor statistics indexes
      CREATE INDEX IF NOT EXISTS idx_sensor_statistics_sensor_id ON sensor_statistics(sensor_id);
      CREATE INDEX IF NOT EXISTS idx_sensor_statistics_metric ON sensor_statistics(metric_name);
      CREATE INDEX IF NOT EXISTS idx_sensor_statistics_period ON sensor_statistics(period_start, period_end);
      
      -- Sensor alerts indexes
      CREATE INDEX IF NOT EXISTS idx_sensor_alerts_sensor_id ON sensor_alerts(sensor_id);
      CREATE INDEX IF NOT EXISTS idx_sensor_alerts_active ON sensor_alerts(is_active);
      
      -- Temperature and pressure data indexes
      CREATE INDEX IF NOT EXISTS idx_temp_pressure_data_sensor_id ON temp_pressure_data(sensor_id);
      CREATE INDEX IF NOT EXISTS idx_temp_pressure_data_received_at ON temp_pressure_data(received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_temp_pressure_data_temperatura ON temp_pressure_data(temperatura);
      CREATE INDEX IF NOT EXISTS idx_temp_pressure_data_presion ON temp_pressure_data(presion);
      
      -- Soil moisture data indexes
      CREATE INDEX IF NOT EXISTS idx_soil_moisture_data_sensor_id ON soil_moisture_data(sensor_id);
      CREATE INDEX IF NOT EXISTS idx_soil_moisture_data_received_at ON soil_moisture_data(received_at DESC);
      
      -- CO2 data indexes
      CREATE INDEX IF NOT EXISTS idx_co2_data_sensor_id ON co2_data(sensor_id);
      CREATE INDEX IF NOT EXISTS idx_co2_data_received_at ON co2_data(received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_co2_data_co2 ON co2_data(co2);
      
      -- Motion data indexes
      CREATE INDEX IF NOT EXISTS idx_motion_data_sensor_id ON motion_data(sensor_id);
      CREATE INDEX IF NOT EXISTS idx_motion_data_received_at ON motion_data(received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_motion_data_motion_detected ON motion_data(motion_detected);
      
      -- Custom sensor data indexes
      CREATE INDEX IF NOT EXISTS idx_custom_sensor_data_sensor_id ON custom_sensor_data(sensor_id);
      CREATE INDEX IF NOT EXISTS idx_custom_sensor_data_received_at ON custom_sensor_data(received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_custom_sensor_data_value ON custom_sensor_data(value);`
    ]);

    // Create triggers for automatic timestamp updates
    await this.applyMigration(1010, 'Create sensor update triggers', [`
      -- Function to update timestamp
      CREATE OR REPLACE FUNCTION update_sensor_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      -- Trigger for sensors table
      DROP TRIGGER IF EXISTS trigger_update_sensor_timestamp ON sensors;
      CREATE TRIGGER trigger_update_sensor_timestamp
        BEFORE UPDATE ON sensors
        FOR EACH ROW
        EXECUTE FUNCTION update_sensor_timestamp();`
    ]);

    // Insert initial sensor type configurations
    await this.applyMigration(1011, 'Insert sensor type configurations', [`
      -- Insert sensor type metadata (if not exists)
      INSERT INTO sensors (name, sensor_type, hardware_id, mqtt_topic, location, description, configuration, is_active)
      SELECT 
        'Sistema de Tipos de Sensores',
        'SYSTEM',
        'SENSOR_TYPES_SYSTEM',
        'system/sensor-types',
        'Sistema',
        'Configuración del sistema de tipos de sensores dinámicos',
        '{
          "sensor_types": {
            "TEMP_PRESSURE": {
              "name": "Temperatura y Presión",
              "description": "Sensor de temperatura y presión atmosférica (BMP280)",
              "table_name": "temp_pressure_data",
              "payload_fields": ["temperatura", "presion", "altitude", "rssi", "boot", "mem"]
            },
            "SOIL_MOISTURE": {
              "name": "Humedad del Suelo",
              "description": "Sensor de humedad del suelo y nutrientes",
              "table_name": "soil_moisture_data",
              "payload_fields": ["humedad_suelo", "temperatura_suelo", "conductividad", "nitrogeno", "fosforo", "potasio"]
            },
            "CO2": {
              "name": "Dióxido de Carbono",
              "description": "Sensor de CO2 y calidad del aire",
              "table_name": "co2_data",
              "payload_fields": ["co2", "tvoc", "temperatura", "humedad"]
            },
            "MOTION": {
              "name": "Sensor de Movimiento",
              "description": "Sensor de movimiento y presencia",
              "table_name": "motion_data",
              "payload_fields": ["motion_detected", "confidence", "distance"]
            },
            "CUSTOM": {
              "name": "Sensor Personalizado",
              "description": "Sensor con campos personalizables",
              "table_name": "custom_sensor_data",
              "payload_fields": ["value", "unit"]
            }
          }
        }',
        false
      WHERE NOT EXISTS (
        SELECT 1 FROM sensors WHERE hardware_id = 'SENSOR_TYPES_SYSTEM'
      );`
    ]);

    console.log('✅ Dynamic sensor tables initialized');
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
        await fs.mkdir(backupDir, { recursive: true, mode: 0o755 });
      } catch (error) {
        if (error.code !== 'EEXIST') {
          console.warn('Warning: Could not create backups directory:', error.message);
          // Try to save in current directory as fallback
          const fallbackFile = `db-backup-${Date.now()}.json`;
          await fs.writeFile(fallbackFile, JSON.stringify(encryptedBackup, null, 2));
          console.log(`✅ Database backup created (fallback): ${fallbackFile}`);
          return fallbackFile;
        }
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
          const { setupDatabase } = require('../../setup-database.js');
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
