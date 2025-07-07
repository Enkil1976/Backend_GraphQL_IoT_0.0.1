const { query } = require('../config/database');
const { pubsub, NOTIFICATION_EVENTS } = require('../utils/pubsub');
const axios = require('axios');
const jwt = require('jsonwebtoken');

/**
 * Notification Service
 * Handles multi-channel notifications (email, telegram, webhook, push)
 */
class NotificationService {
  constructor() {
    this.webhookUrl = process.env.WEBHOOK_URL;
    this.webhookSecret = process.env.WEBHOOK_SECRET;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h';
    this.defaultChannel = 'webhook'; // Default to webhook for n8n integration
  }

  /**
   * Send notification through multiple channels
   * @param {Object} notificationData - Notification data
   * @returns {Object} Send results
   */
  async sendNotification(notificationData) {
    const {
      title,
      message,
      priority = 'medium',
      channels = [this.defaultChannel],
      metadata = {},
      templateId = null,
      variables = {}
    } = notificationData;

    // Process template if provided
    let processedTitle = title;
    let processedMessage = message;
    
    if (templateId) {
      const template = await this.getNotificationTemplate(templateId);
      if (template) {
        processedTitle = this.processTemplate(template.title, variables);
        processedMessage = this.processTemplate(template.content, variables);
      }
    } else {
      // Process variables in title and message
      processedTitle = this.processTemplate(title, variables);
      processedMessage = this.processTemplate(message, variables);
    }

    // Store notification in database
    const notificationRecord = await this.createNotificationRecord({
      title: processedTitle,
      message: processedMessage,
      priority,
      channels: channels.join(','),
      metadata,
      status: 'pending'
    });

    const sendResults = {};
    
    // Send through each channel
    for (const channel of channels) {
      try {
        let result;
        
        switch (channel) {
          case 'email':
            result = await this.sendEmail(processedTitle, processedMessage, metadata);
            break;
          case 'telegram':
            result = await this.sendTelegram(processedTitle, processedMessage, metadata);
            break;
          case 'whatsapp':
            result = await this.sendWhatsApp(processedTitle, processedMessage, metadata);
            break;
          case 'webhook':
            result = await this.sendWebhook(processedTitle, processedMessage, metadata, priority);
            break;
          case 'push':
            result = await this.sendPushNotification(processedTitle, processedMessage, metadata);
            break;
          default:
            result = { success: false, error: `Unknown channel: ${channel}` };
        }
        
        sendResults[channel] = result;
      } catch (error) {
        sendResults[channel] = { success: false, error: error.message };
      }
    }

    // Update notification status
    const success = Object.values(sendResults).some(result => result.success);
    await this.updateNotificationStatus(notificationRecord.id, success ? 'sent' : 'failed', sendResults);

    // Publish notification sent event
    await pubsub.publish(NOTIFICATION_EVENTS.NOTIFICATION_SENT, {
      notificationSent: {
        id: notificationRecord.id,
        title: processedTitle,
        message: processedMessage,
        channels,
        results: sendResults
      }
    });

    return {
      id: notificationRecord.id,
      success,
      results: sendResults
    };
  }

  /**
   * Send email notification
   * @param {string} title - Email subject
   * @param {string} message - Email body
   * @param {Object} metadata - Email metadata
   * @returns {Object} Send result
   */
  async sendEmail(title, message, metadata = {}) {
    // Email implementation would go here
    // For now, we'll simulate success
    console.log('📧 Email notification:', { title, message, metadata });
    
    return {
      success: true,
      provider: 'email',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Send Telegram notification
   * @param {string} title - Message title
   * @param {string} message - Message content
   * @param {Object} metadata - Telegram metadata
   * @returns {Object} Send result
   */
  async sendTelegram(title, message, metadata = {}) {
    // Telegram implementation would go here
    // For now, we'll simulate success
    console.log('📱 Telegram notification:', { title, message, metadata });
    
    return {
      success: true,
      provider: 'telegram',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Send WhatsApp notification
   * @param {string} title - Message title
   * @param {string} message - Message content
   * @param {Object} metadata - WhatsApp metadata
   * @returns {Object} Send result
   */
  async sendWhatsApp(title, message, metadata = {}) {
    // WhatsApp implementation would go here
    // For now, we'll simulate success
    console.log('📱 WhatsApp notification:', { title, message, metadata });
    
    return {
      success: true,
      provider: 'whatsapp',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Send webhook notification (n8n integration)
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} metadata - Additional metadata
   * @param {string} priority - Notification priority
   * @returns {Object} Send result
   */
  async sendWebhook(title, message, metadata = {}, priority = 'medium') {
    if (!this.webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    if (!this.webhookSecret) {
      throw new Error('Webhook secret not configured for JWT');
    }

    // Generar token JWT
    const token = jwt.sign(
      { 
        user: 'iot-greenhouse',
        timestamp: new Date().toISOString()
      }, 
      this.webhookSecret,
      { expiresIn: this.jwtExpiresIn }
    );

    const payload = {
      title,
      message,
      priority,
      timestamp: new Date().toISOString(),
      source: 'iot-greenhouse',
      metadata
    };

    try {
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'IoT-Greenhouse-System',
        'Authorization': `Bearer ${token}`
      };

      const response = await axios.post(this.webhookUrl, payload, {
        headers,
        timeout: 10000
      });

      console.log('🔗 Webhook notification sent with JWT:', response.status);
      
      return {
        success: true,
        provider: 'webhook',
        timestamp: new Date().toISOString(),
        response: {
          status: response.status,
          statusText: response.statusText,
          data: response.data
        }
      };
    } catch (error) {
      console.error('❌ Webhook notification failed:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      return {
        success: false,
        provider: 'webhook',
        timestamp: new Date().toISOString(),
        error: {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        }
      };
    }
  }

  /**
   * Send push notification
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} metadata - Push metadata
   * @returns {Object} Send result
   */
  async sendPushNotification(title, message, metadata = {}) {
    // Push notification implementation would go here
    // For now, we'll simulate success
    console.log('📱 Push notification:', { title, message, metadata });
    
    return {
      success: true,
      provider: 'push',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Process notification template with variables
   * @param {string} template - Template string
   * @param {Object} variables - Variables to substitute
   * @returns {string} Processed template
   */
  processTemplate(template, variables = {}) {
    if (!template) return '';
    
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  /**
   * Create notification record in database
   * @param {Object} notificationData - Notification data
   * @returns {Object} Created notification record
   */
  async createNotificationRecord(notificationData) {
    const {
      title,
      message,
      priority,
      channels,
      metadata,
      status
    } = notificationData;

    const result = await query(
      `INSERT INTO notifications (title, message, priority, channels, metadata, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [title, message, priority, channels, JSON.stringify(metadata), status]
    );

    return result.rows[0];
  }

  /**
   * Update notification status
   * @param {string} id - Notification ID
   * @param {string} status - New status
   * @param {Object} results - Send results
   */
  async updateNotificationStatus(id, status, results = {}) {
    await query(
      `UPDATE notifications 
       SET status = $1, sent_at = NOW(), results = $2 
       WHERE id = $3`,
      [status, JSON.stringify(results), id]
    );
  }

  /**
   * Get notification by ID
   * @param {string} id - Notification ID
   * @returns {Object} Notification data
   */
  async getNotificationById(id) {
    const result = await query(
      'SELECT * FROM notifications WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error('Notification not found');
    }

    return result.rows[0];
  }

  /**
   * Get notifications with pagination
   * @param {Object} options - Query options
   * @returns {Object} Notifications data
   */
  async getNotifications(options = {}) {
    const {
      limit = 50,
      offset = 0,
      status = null,
      priority = null,
      startDate = null,
      endDate = null
    } = options;

    let sql = 'SELECT * FROM notifications WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      sql += ` AND priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    if (startDate) {
      sql += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      sql += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM notifications WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;

    if (status) {
      countSql += ` AND status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    if (priority) {
      countSql += ` AND priority = $${countParamIndex}`;
      countParams.push(priority);
      countParamIndex++;
    }

    if (startDate) {
      countSql += ` AND created_at >= $${countParamIndex}`;
      countParams.push(startDate);
      countParamIndex++;
    }

    if (endDate) {
      countSql += ` AND created_at <= $${countParamIndex}`;
      countParams.push(endDate);
      countParamIndex++;
    }

    const countResult = await query(countSql, countParams);
    const totalCount = parseInt(countResult.rows[0].total);

    return {
      notifications: result.rows,
      totalCount,
      hasMore: offset + limit < totalCount
    };
  }

  /**
   * Get notification templates
   * @returns {Array} Notification templates
   */
  async getNotificationTemplates() {
    const result = await query(
      'SELECT * FROM notification_templates ORDER BY created_at DESC'
    );

    return result.rows;
  }

  /**
   * Get notification template by ID
   * @param {string} id - Template ID
   * @returns {Object} Template data
   */
  async getNotificationTemplate(id) {
    const result = await query(
      'SELECT * FROM notification_templates WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Create notification template
   * @param {Object} templateData - Template data
   * @returns {Object} Created template
   */
  async createNotificationTemplate(templateData) {
    const {
      name,
      title,
      content,
      variables = [],
      channels = ['webhook']
    } = templateData;

    const result = await query(
      `INSERT INTO notification_templates (name, title, content, variables, channels, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [name, title, content, JSON.stringify(variables), channels.join(',')]
    );

    return result.rows[0];
  }

  /**
   * Update notification template
   * @param {string} id - Template ID
   * @param {Object} updateData - Update data
   * @returns {Object} Updated template
   */
  async updateNotificationTemplate(id, updateData) {
    const {
      name,
      title,
      content,
      variables,
      channels
    } = updateData;

    const updateFields = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      params.push(name);
      paramIndex++;
    }

    if (title !== undefined) {
      updateFields.push(`title = $${paramIndex}`);
      params.push(title);
      paramIndex++;
    }

    if (content !== undefined) {
      updateFields.push(`content = $${paramIndex}`);
      params.push(content);
      paramIndex++;
    }

    if (variables !== undefined) {
      updateFields.push(`variables = $${paramIndex}`);
      params.push(JSON.stringify(variables));
      paramIndex++;
    }

    if (channels !== undefined) {
      updateFields.push(`channels = $${paramIndex}`);
      params.push(channels.join(','));
      paramIndex++;
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(id);

    const sql = `
      UPDATE notification_templates 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      throw new Error('Template not found');
    }

    return result.rows[0];
  }

  /**
   * Delete notification template
   * @param {string} id - Template ID
   * @returns {boolean} Success
   */
  async deleteNotificationTemplate(id) {
    const result = await query(
      'DELETE FROM notification_templates WHERE id = $1',
      [id]
    );

    return result.rowCount > 0;
  }

  /**
   * Test notification configuration
   * @param {Object} testData - Test configuration
   * @returns {Object} Test results
   */
  async testNotification(testData) {
    const {
      channels = ['webhook'],
      title = 'Test Notification',
      message = 'This is a test notification from the IoT Greenhouse System'
    } = testData;

    return await this.sendNotification({
      title,
      message,
      priority: 'low',
      channels,
      metadata: { test: true }
    });
  }
}

module.exports = new NotificationService();