require('dotenv').config();
console.log('Executing setup-database.js');
const { pool } = require('./src/config/database');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  console.log('🗄️  Setting up complete database schema for IoT GraphQL Backend...');
  
  const tables = [
    {
      name: 'users',
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'operator', 'viewer')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_login TIMESTAMP WITH TIME ZONE,
          is_active BOOLEAN DEFAULT true
        );
        
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        
        COMMENT ON TABLE users IS 'System users with role-based access control';
      `
    },
    {
      name: 'devices',
      sql: `
        CREATE TABLE IF NOT EXISTS devices (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          device_id VARCHAR(50) UNIQUE,
          type VARCHAR(50) NOT NULL,
          status VARCHAR(20) DEFAULT 'off' CHECK (status IN ('on', 'off', 'error', 'maintenance')),
          room VARCHAR(50),
          configuration JSONB DEFAULT '{}',
          owner_user_id INTEGER REFERENCES users(id),
          last_seen TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);
        CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
        CREATE INDEX IF NOT EXISTS idx_devices_room ON devices(room);
        CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner_user_id);
        CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
        
        COMMENT ON TABLE devices IS 'IoT devices and actuators in the greenhouse system';
      `
    },
    {
      name: 'temhum1',
      sql: `
        DROP TABLE IF EXISTS temhum1 CASCADE;
        CREATE TABLE IF NOT EXISTS temhum1 (
          id SERIAL PRIMARY KEY,
          temperatura DECIMAL(5,2) NOT NULL,
          humedad DECIMAL(5,2) NOT NULL CHECK (humedad >= 0 AND humedad <= 100),
          heatindex DECIMAL(5,2),
          dewpoint DECIMAL(5,2),
          rssi INTEGER,
          stats JSONB DEFAULT '{}',
          boot INTEGER DEFAULT 0,
          mem INTEGER,
          received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          -- Greenhouse specific fields
          tmin DECIMAL(5,2),
          tmax DECIMAL(5,2),
          tavg DECIMAL(5,2),
          hmin DECIMAL(5,2),
          hmax DECIMAL(5,2),
          havg DECIMAL(5,2),
          total INTEGER DEFAULT 0,
          errors INTEGER DEFAULT 0
        );
        
        CREATE INDEX IF NOT EXISTS idx_temhum1_received_at ON temhum1(received_at DESC);
        CREATE INDEX IF NOT EXISTS idx_temhum1_temp_hum ON temhum1(temperatura, humedad);
        
        COMMENT ON TABLE temhum1 IS 'Temperature and humidity sensor data from sensor 1';
      `
    },
    {
      name: 'temhum2',
      sql: `
        DROP TABLE IF EXISTS temhum2 CASCADE;
        CREATE TABLE IF NOT EXISTS temhum2 (
          id SERIAL PRIMARY KEY,
          temperatura DECIMAL(5,2) NOT NULL,
          humedad DECIMAL(5,2) NOT NULL CHECK (humedad >= 0 AND humedad <= 100),
          heatindex DECIMAL(5,2),
          dewpoint DECIMAL(5,2),
          rssi INTEGER,
          stats JSONB DEFAULT '{}',
          boot INTEGER DEFAULT 0,
          mem INTEGER,
          received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          -- Greenhouse specific fields
          tmin DECIMAL(5,2),
          tmax DECIMAL(5,2),
          tavg DECIMAL(5,2),
          hmin DECIMAL(5,2),
          hmax DECIMAL(5,2),
          havg DECIMAL(5,2),
          total INTEGER DEFAULT 0,
          errors INTEGER DEFAULT 0
        );
        
        CREATE INDEX IF NOT EXISTS idx_temhum2_received_at ON temhum2(received_at DESC);
        CREATE INDEX IF NOT EXISTS idx_temhum2_temp_hum ON temhum2(temperatura, humedad);
        
        COMMENT ON TABLE temhum2 IS 'Temperature and humidity sensor data from sensor 2';
      `
    },
    {
      name: 'calidad_agua',
      sql: `
        CREATE TABLE IF NOT EXISTS calidad_agua (
          id SERIAL PRIMARY KEY,
          ph DECIMAL(4,2) NOT NULL CHECK (ph >= 0 AND ph <= 14),
          ec DECIMAL(6,2) NOT NULL,
          ppm DECIMAL(8,2) NOT NULL,
          temperatura_agua DECIMAL(5,2),
          rssi INTEGER,
          stats JSONB DEFAULT '{}',
          boot INTEGER DEFAULT 0,
          mem INTEGER,
          received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_calidad_agua_received_at ON calidad_agua(received_at DESC);
        CREATE INDEX IF NOT EXISTS idx_calidad_agua_ph_ec ON calidad_agua(ph, ec);
        
        COMMENT ON TABLE calidad_agua IS 'Water quality sensor data (pH, EC, PPM, temperature)';
      `
    },
    {
      name: 'power_monitor_logs',
      sql: `
        CREATE TABLE IF NOT EXISTS power_monitor_logs (
          id SERIAL PRIMARY KEY,
          device_hardware_id VARCHAR(50) NOT NULL,
          watts DECIMAL(8,3) NOT NULL,
          voltage DECIMAL(6,2),
          current DECIMAL(6,3),
          frequency DECIMAL(4,1),
          power_factor DECIMAL(4,3),
          rssi INTEGER,
          mem INTEGER,
          boot INTEGER DEFAULT 0,
          received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          -- Link to devices table
          device_id INTEGER REFERENCES devices(id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_power_monitor_received_at ON power_monitor_logs(received_at DESC);
        CREATE INDEX IF NOT EXISTS idx_power_monitor_device_id ON power_monitor_logs(device_id);
        CREATE INDEX IF NOT EXISTS idx_power_monitor_hardware_id ON power_monitor_logs(device_hardware_id);
        
        COMMENT ON TABLE power_monitor_logs IS 'Power consumption monitoring data from smart plugs';
      `
    },
    {
      name: 'rules',
      sql: `
        CREATE TABLE IF NOT EXISTS rules (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          enabled BOOLEAN DEFAULT true,
          priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
          conditions JSONB NOT NULL DEFAULT '[]',
          actions JSONB NOT NULL DEFAULT '[]',
          cooldown_minutes INTEGER DEFAULT 0,
          last_triggered TIMESTAMP WITH TIME ZONE,
          trigger_count INTEGER DEFAULT 0,
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_rules_enabled ON rules(enabled);
        CREATE INDEX IF NOT EXISTS idx_rules_priority ON rules(priority);
        CREATE INDEX IF NOT EXISTS idx_rules_created_by ON rules(created_by);
        
        COMMENT ON TABLE rules IS 'Automation rules for IoT device control and notifications';
      `
    },
    {
      name: 'scheduled_operations',
      sql: `
        CREATE TABLE IF NOT EXISTS scheduled_operations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          device_id INTEGER REFERENCES devices(id),
          operation_type VARCHAR(50) NOT NULL,
          schedule_expression VARCHAR(100) NOT NULL,
          parameters JSONB DEFAULT '{}',
          enabled BOOLEAN DEFAULT true,
          last_executed TIMESTAMP WITH TIME ZONE,
          next_execution TIMESTAMP WITH TIME ZONE,
          execution_count INTEGER DEFAULT 0,
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_scheduled_operations_device_id ON scheduled_operations(device_id);
        CREATE INDEX IF NOT EXISTS idx_scheduled_operations_enabled ON scheduled_operations(enabled);
        CREATE INDEX IF NOT EXISTS idx_scheduled_operations_next_execution ON scheduled_operations(next_execution);
        
        COMMENT ON TABLE scheduled_operations IS 'Scheduled device operations and automation tasks';
      `
    },
    {
      name: 'notifications',
      sql: `
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
          priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
          channels JSONB DEFAULT '[]',
          metadata JSONB DEFAULT '{}',
          user_id INTEGER REFERENCES users(id),
          rule_id INTEGER REFERENCES rules(id),
          retry_count INTEGER DEFAULT 0,
          sent_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
        CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
        
        COMMENT ON TABLE notifications IS 'System notifications and alerts';
      `
    },
    {
      name: 'notification_templates',
      sql: `
        CREATE TABLE IF NOT EXISTS notification_templates (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          template_content TEXT NOT NULL,
          variables JSONB DEFAULT '[]',
          template_type VARCHAR(50) DEFAULT 'general',
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_notification_templates_name ON notification_templates(name);
        CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(template_type);
        
        COMMENT ON TABLE notification_templates IS 'Templates for notification messages';
      `
    },
    {
      name: 'user_configurations',
      sql: `
        CREATE TABLE IF NOT EXISTS user_configurations (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          config_key VARCHAR(100) NOT NULL,
          config_value JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          UNIQUE(user_id, config_key)
        );
        
        CREATE INDEX IF NOT EXISTS idx_user_configurations_user_id ON user_configurations(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_configurations_key ON user_configurations(config_key);
        
        COMMENT ON TABLE user_configurations IS 'User-specific configuration settings';
      `
    },
    {
      name: 'luxometro',
      sql: `
        CREATE TABLE IF NOT EXISTS luxometro (
          id SERIAL PRIMARY KEY,
          light DECIMAL(8,2) NOT NULL,
          white_light DECIMAL(8,2),
          raw_light DECIMAL(8,2),
          rssi INTEGER,
          stats JSONB DEFAULT '{}',
          boot INTEGER DEFAULT 0,
          mem INTEGER,
          received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          -- Greenhouse specific fields for light measurements
          lmin DECIMAL(8,2),
          lmax DECIMAL(8,2),
          lavg DECIMAL(8,2),
          wmin DECIMAL(8,2),
          wmax DECIMAL(8,2),
          wavg DECIMAL(8,2),
          total INTEGER DEFAULT 0,
          errors INTEGER DEFAULT 0
        );
        
        CREATE INDEX IF NOT EXISTS idx_luxometro_received_at ON luxometro(received_at DESC);
        CREATE INDEX IF NOT EXISTS idx_luxometro_light ON luxometro(light);
        
        COMMENT ON TABLE luxometro IS 'Light sensor data (ambient light, white light, raw values)';
      `
    },
    {
      name: 'rule_executions',
      sql: `
        CREATE TABLE IF NOT EXISTS rule_executions (
          id SERIAL PRIMARY KEY,
          rule_id INTEGER NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
          triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          success BOOLEAN NOT NULL DEFAULT false,
          execution_time_ms INTEGER DEFAULT 0,
          
          -- Context and evaluation data
          trigger_data JSONB,
          evaluation_result JSONB,
          actions_executed JSONB,
          
          -- Error information
          error_message TEXT,
          stack_trace TEXT,
          
          -- Metadata
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_rule_executions_rule_id ON rule_executions(rule_id);
        CREATE INDEX IF NOT EXISTS idx_rule_executions_triggered_at ON rule_executions(triggered_at);
        CREATE INDEX IF NOT EXISTS idx_rule_executions_success ON rule_executions(success);
        CREATE INDEX IF NOT EXISTS idx_rule_executions_rule_triggered ON rule_executions(rule_id, triggered_at DESC);
        
        COMMENT ON TABLE rule_executions IS 'Stores the execution history and results of automation rules';
      `
    },
    {
      name: 'operations_log',
      sql: `
        CREATE TABLE IF NOT EXISTS operations_log (
          id SERIAL PRIMARY KEY,
          operation_type VARCHAR(50) NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          entity_id INTEGER,
          operation_data JSONB DEFAULT '{}',
          user_id INTEGER REFERENCES users(id),
          success BOOLEAN DEFAULT true,
          error_message TEXT,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_operations_log_type ON operations_log(operation_type);
        CREATE INDEX IF NOT EXISTS idx_operations_log_entity ON operations_log(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_operations_log_user_id ON operations_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_operations_log_created_at ON operations_log(created_at DESC);
        
        COMMENT ON TABLE operations_log IS 'Audit log for all system operations and changes';
      `
    }
  ];

  try {
    console.log('📋 Creating tables...');
    
    for (const table of tables) {
      console.log(`   Creating table: ${table.name}`);
      await pool.query(table.sql);
      console.log(`   ✅ ${table.name} created successfully`);
    }

    // Insert default admin user
    console.log('\n👤 Creating default admin user...');
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await pool.query(`
      INSERT INTO users (username, email, password_hash, role) 
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO NOTHING
    `, ['admin', 'admin@iot-greenhouse.com', hashedPassword, 'admin']);
    
    console.log('   ✅ Default admin user created (username: admin, password: admin123)');

    // Insert some example devices
    console.log('\n🔌 Creating example devices...');
    const exampleDevices = [
      { name: 'Bomba de Agua Principal', device_id: 'bomba_agua_01', type: 'water_pump', room: 'invernadero_1' },
      { name: 'Ventilador de Circulación', device_id: 'ventilador_01', type: 'fan', room: 'invernadero_1' },
      { name: 'Lámpara LED Crecimiento', device_id: 'led_grow_01', type: 'lights', room: 'invernadero_1' },
      { name: 'Calefactor Nocturno', device_id: 'calefactor_01', type: 'heater', room: 'invernadero_1' },
      { name: 'Calefactor de Agua', device_id: 'calefactor_agua_01', type: 'water_heater', room: 'invernadero_1' }
    ];

    for (const device of exampleDevices) {
      await pool.query(`
        INSERT INTO devices (name, device_id, type, room, configuration) 
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [device.name, device.device_id, device.type, device.room, '{"auto_mode": false, "schedule": null}']);
    }
    
    console.log('   ✅ Example devices created');

    // Verify all tables
    console.log('\n🔍 Verifying database setup...');
    const tablesQuery = `
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const result = await pool.query(tablesQuery);
    console.log('\n📊 Database Tables Summary:');
    console.log('   Table Name                | Columns');
    console.log('   --------------------------|--------');
    
    result.rows.forEach(row => {
      console.log(`   ${row.table_name.padEnd(25)} | ${row.column_count}`);
    });

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - ${result.rows.length} tables created`);
    console.log('   - Default admin user: admin / admin123');
    console.log('   - Example devices added');
    console.log('   - All indexes and constraints applied');
    
    return true;

  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run database setup
if (require.main === module) {
  setupDatabase().catch(error => {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  });
}

module.exports = { setupDatabase };