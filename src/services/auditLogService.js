const { pool } = require('../config/database');
const winston = require('winston');
const crypto = require('crypto');

/**
 * Comprehensive Audit Logging Service
 * Tracks all security-relevant events with tamper-proof logs
 */
class AuditLogService {
  constructor() {
    this.logger = this.setupWinstonLogger();
    this.initializeDatabase();
  }

  /**
   * Setup Winston logger for structured logging
   */
  setupWinstonLogger() {
    const fs = require('fs');
    const path = require('path');

    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    try {
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true, mode: 0o755 });
      }
    } catch (error) {
      console.warn('Warning: Could not create logs directory, using console only:', error.message);
    }

    const transports = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ];

    // Only add file transports if we can write to logs directory
    try {
      fs.accessSync(logsDir, fs.constants.W_OK);
      transports.push(
        new winston.transports.File({
          filename: 'logs/audit-error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 10,
          tailable: true
        }),
        new winston.transports.File({
          filename: 'logs/audit-combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 20,
          tailable: true
        })
      );
    } catch (error) {
      console.warn('Warning: Cannot write to logs directory, using console logging only:', error.message);
    }

    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'iot-audit' },
      transports
    });
  }

  /**
   * Initialize audit log database table
   */
  async initializeDatabase() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          event_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
          timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          event_type VARCHAR(100) NOT NULL,
          action VARCHAR(100) NOT NULL,
          user_id INTEGER REFERENCES users(id),
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
      `);

      // Create indexes for performance
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_level ON audit_logs(risk_level);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_client_ip ON audit_logs(client_ip);
      `);

      console.log('✅ Audit log database initialized');
    } catch (error) {
      console.error('❌ Failed to initialize audit log database:', error);
    }
  }

  /**
   * Generate tamper-proof checksum for log entry
   */
  generateChecksum(logData) {
    const payload = JSON.stringify({
      timestamp: logData.timestamp,
      event_type: logData.event_type,
      action: logData.action,
      user_id: logData.user_id,
      resource_type: logData.resource_type,
      resource_id: logData.resource_id
    });

    const secret = process.env.AUDIT_SECRET || process.env.JWT_SECRET || 'audit-secret';
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Log security event with complete audit trail
   */
  async logEvent({
    eventType,
    action,
    user = null,
    clientIP = null,
    userAgent = null,
    resourceType = null,
    resourceId = null,
    oldValues = null,
    newValues = null,
    metadata = {},
    riskLevel = 'low',
    success = true,
    errorMessage = null,
    sessionId = null
  }) {
    try {
      const logData = {
        timestamp: new Date().toISOString(),
        event_type: eventType,
        action,
        user_id: user?.id || null,
        username: user?.username || null,
        client_ip: clientIP,
        user_agent: userAgent,
        resource_type: resourceType,
        resource_id: resourceId,
        old_values: oldValues,
        new_values: newValues,
        metadata: {
          ...metadata,
          server_time: Date.now(),
          process_id: process.pid
        },
        risk_level: riskLevel,
        success,
        error_message: errorMessage,
        session_id: sessionId
      };

      // Generate checksum for integrity
      const checksum = this.generateChecksum(logData);
      logData.checksum = checksum;

      // Store in database
      await pool.query(`
        INSERT INTO audit_logs (
          event_type, action, user_id, username, client_ip, user_agent,
          resource_type, resource_id, old_values, new_values, metadata,
          risk_level, success, error_message, session_id, checksum
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        logData.event_type, logData.action, logData.user_id, logData.username,
        logData.client_ip, logData.user_agent, logData.resource_type, logData.resource_id,
        logData.old_values, logData.new_values, logData.metadata, logData.risk_level,
        logData.success, logData.error_message, logData.session_id, logData.checksum
      ]);

      // Log to Winston for additional storage/analysis
      this.logger.info('Audit Event', logData);

      return true;
    } catch (error) {
      console.error('❌ Failed to log audit event:', error);
      // Always try to log failures to Winston even if DB fails
      this.logger.error('Audit Log Failure', {
        original_event: { eventType, action, user: user?.username },
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }

  /**
   * Specific audit log methods for common events
   */

  async logAuthentication(username, success, clientIP, userAgent, method = 'password') {
    return this.logEvent({
      eventType: 'AUTHENTICATION',
      action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
      user: success ? { username } : null,
      clientIP,
      userAgent,
      metadata: { auth_method: method },
      riskLevel: success ? 'low' : 'medium',
      success,
      errorMessage: success ? null : 'Invalid credentials'
    });
  }

  async logDeviceControl(action, deviceId, device, user, clientIP) {
    return this.logEvent({
      eventType: 'DEVICE_CONTROL',
      action: action.toUpperCase(),
      user,
      clientIP,
      resourceType: 'device',
      resourceId: deviceId,
      oldValues: { status: device.previous_status },
      newValues: { status: device.status },
      metadata: {
        device_name: device.name,
        device_type: device.type,
        location: device.location
      },
      riskLevel: 'medium'
    });
  }

  async logRuleModification(action, ruleId, rule, user, clientIP, oldData = null) {
    return this.logEvent({
      eventType: 'RULE_MANAGEMENT',
      action: action.toUpperCase(),
      user,
      clientIP,
      resourceType: 'rule',
      resourceId: ruleId,
      oldValues: oldData,
      newValues: {
        name: rule.name,
        enabled: rule.enabled,
        priority: rule.priority,
        conditions: rule.conditions,
        actions: rule.actions
      },
      metadata: {
        rule_name: rule.name,
        rule_type: rule.conditions?.rules?.[0]?.type
      },
      riskLevel: 'high'
    });
  }

  async logUserManagement(action, targetUserId, targetUser, adminUser, clientIP, changes = {}) {
    return this.logEvent({
      eventType: 'USER_MANAGEMENT',
      action: action.toUpperCase(),
      user: adminUser,
      clientIP,
      resourceType: 'user',
      resourceId: targetUserId,
      oldValues: changes.old || null,
      newValues: changes.new || null,
      metadata: {
        target_username: targetUser.username,
        target_role: targetUser.role,
        admin_username: adminUser.username
      },
      riskLevel: 'high'
    });
  }

  async logSystemEvent(action, details, user = null, clientIP = null) {
    return this.logEvent({
      eventType: 'SYSTEM',
      action: action.toUpperCase(),
      user,
      clientIP,
      metadata: details,
      riskLevel: 'medium'
    });
  }

  async logSecurityViolation(violationType, details, user, clientIP) {
    return this.logEvent({
      eventType: 'SECURITY_VIOLATION',
      action: violationType.toUpperCase(),
      user,
      clientIP,
      metadata: details,
      riskLevel: 'high',
      success: false
    });
  }

  async logDataAccess(action, dataType, recordId, user, clientIP, sensitive = false) {
    return this.logEvent({
      eventType: 'DATA_ACCESS',
      action: action.toUpperCase(),
      user,
      clientIP,
      resourceType: dataType,
      resourceId: recordId,
      metadata: { sensitive_data: sensitive },
      riskLevel: sensitive ? 'medium' : 'low'
    });
  }

  /**
   * Query audit logs with advanced filtering
   */
  async queryLogs({
    startDate = null,
    endDate = null,
    eventType = null,
    userId = null,
    riskLevel = null,
    clientIP = null,
    limit = 100,
    offset = 0
  } = {}) {
    try {
      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params = [];
      let paramCount = 0;

      if (startDate) {
        paramCount++;
        query += ` AND timestamp >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND timestamp <= $${paramCount}`;
        params.push(endDate);
      }

      if (eventType) {
        paramCount++;
        query += ` AND event_type = $${paramCount}`;
        params.push(eventType);
      }

      if (userId) {
        paramCount++;
        query += ` AND user_id = $${paramCount}`;
        params.push(userId);
      }

      if (riskLevel) {
        paramCount++;
        query += ` AND risk_level = $${paramCount}`;
        params.push(riskLevel);
      }

      if (clientIP) {
        paramCount++;
        query += ` AND client_ip = $${paramCount}`;
        params.push(clientIP);
      }

      query += ` ORDER BY timestamp DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('❌ Failed to query audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(days = 30) {
    try {
      const result = await pool.query(`
        SELECT 
          event_type,
          risk_level,
          COUNT(*) as count,
          COUNT(CASE WHEN success = false THEN 1 END) as failures
        FROM audit_logs 
        WHERE timestamp >= NOW() - INTERVAL '${days} days'
        GROUP BY event_type, risk_level
        ORDER BY count DESC
      `);

      return result.rows;
    } catch (error) {
      console.error('❌ Failed to get audit statistics:', error);
      return [];
    }
  }

  /**
   * Verify log integrity using checksums
   */
  async verifyLogIntegrity(eventId) {
    try {
      const result = await pool.query(
        'SELECT * FROM audit_logs WHERE event_id = $1',
        [eventId]
      );

      if (result.rows.length === 0) {
        return { valid: false, error: 'Log entry not found' };
      }

      const log = result.rows[0];
      const expectedChecksum = this.generateChecksum(log);

      return {
        valid: log.checksum === expectedChecksum,
        stored_checksum: log.checksum,
        calculated_checksum: expectedChecksum
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Clean up old audit logs (retention policy)
   */
  async cleanupOldLogs(retentionDays = 365) {
    try {
      const result = await pool.query(`
        DELETE FROM audit_logs 
        WHERE timestamp < NOW() - INTERVAL '${retentionDays} days'
        RETURNING count(*)
      `);

      const deletedCount = result.rowCount;
      console.log(`🧹 Cleaned up ${deletedCount} old audit log entries`);

      return deletedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup old audit logs:', error);
      return 0;
    }
  }
}

module.exports = new AuditLogService();
