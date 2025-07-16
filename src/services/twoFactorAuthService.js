const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { promisify } = require('util');
const argon2 = require('argon2');

/**
 * Two-Factor Authentication Service
 * Provides TOTP-based 2FA functionality with backup codes
 */
class TwoFactorAuthService {
  constructor() {
    this.serviceName = process.env.SERVICE_NAME || 'IoT Greenhouse';
    this.backupCodeLength = 8;
    this.backupCodeCount = 10;
  }

  /**
   * Generate a new 2FA secret for a user
   * @param {string} username - User's username
   * @param {string} email - User's email
   * @returns {Object} - Secret, QR code URL, and backup codes
   */
  async generateSecret(username, email) {
    try {
      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `${this.serviceName} (${username})`,
        account: email,
        issuer: this.serviceName,
        length: 32
      });

      // Generate QR code
      const qrCodeDataURL = await QRCode.toDataURL(secret.otpauth_url);

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();
      const hashedBackupCodes = await Promise.all(
        backupCodes.map(code => argon2.hash(code))
      );

      return {
        secret: secret.base32,
        qrCode: qrCodeDataURL,
        manualEntryKey: secret.base32,
        backupCodes: backupCodes,
        hashedBackupCodes: hashedBackupCodes
      };
    } catch (error) {
      throw new Error(`Failed to generate 2FA secret: ${error.message}`);
    }
  }

  /**
   * Generate secure backup codes
   * @returns {Array} - Array of backup codes
   */
  generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < this.backupCodeCount; i++) {
      const code = crypto.randomBytes(this.backupCodeLength / 2).toString('hex').toUpperCase();
      // Format as XXXX-XXXX for readability
      const formattedCode = code.match(/.{1,4}/g).join('-');
      codes.push(formattedCode);
    }
    return codes;
  }

  /**
   * Verify TOTP token
   * @param {string} token - 6-digit token from authenticator app
   * @param {string} secret - User's 2FA secret
   * @param {number} window - Time window tolerance (default 2 = ±60 seconds)
   * @returns {boolean} - Verification result
   */
  verifyToken(token, secret, window = 2) {
    try {
      if (!token || !secret) {
        return false;
      }

      // Remove any spaces or dashes from token
      const cleanToken = token.replace(/[\\s-]/g, '');

      // Verify token
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: cleanToken,
        window: window,
        time: Math.floor(Date.now() / 1000)
      });

      return verified;
    } catch (error) {
      console.error('2FA token verification error:', error);
      return false;
    }
  }

  /**
   * Verify backup code
   * @param {string} inputCode - Backup code provided by user
   * @param {Array} hashedCodes - Array of hashed backup codes
   * @returns {Object} - Verification result and used code index
   */
  async verifyBackupCode(inputCode, hashedCodes) {
    try {
      if (!inputCode || !hashedCodes || !Array.isArray(hashedCodes)) {
        return { valid: false, usedIndex: -1 };
      }

      // Clean input code
      const cleanCode = inputCode.replace(/[\\s-]/g, '').toUpperCase();

      // Check each hashed backup code
      for (let i = 0; i < hashedCodes.length; i++) {
        if (!hashedCodes[i]) continue; // Skip used codes (null/undefined)

        try {
          const isValid = await argon2.verify(hashedCodes[i], cleanCode);
          if (isValid) {
            return { valid: true, usedIndex: i };
          }
        } catch (error) {
          // Continue checking other codes if one fails
          continue;
        }
      }

      return { valid: false, usedIndex: -1 };
    } catch (error) {
      console.error('Backup code verification error:', error);
      return { valid: false, usedIndex: -1 };
    }
  }

  /**
   * Generate a time-limited setup token for 2FA enrollment
   * @param {string} userId - User ID
   * @returns {string} - Encrypted setup token
   */
  generateSetupToken(userId) {
    const payload = {
      userId,
      type: '2fa_setup',
      exp: Date.now() + (10 * 60 * 1000) // 10 minutes
    };

    const secret = process.env.JWT_SECRET || 'fallback-secret';
    const cipher = crypto.createCipher('aes-256-gcm', secret);
    let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return encrypted;
  }

  /**
   * Verify and decode setup token
   * @param {string} token - Encrypted setup token
   * @returns {Object} - Decoded payload or null if invalid
   */
  verifySetupToken(token) {
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret';
      const decipher = crypto.createDecipher('aes-256-gcm', secret);
      let decrypted = decipher.update(token, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const payload = JSON.parse(decrypted);

      // Check expiration
      if (payload.exp && Date.now() > payload.exp) {
        return null;
      }

      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if 2FA is required for user based on security policy
   * @param {Object} user - User object
   * @param {string} clientIP - Client IP address
   * @returns {boolean} - Whether 2FA is required
   */
  is2FARequired(user, clientIP) {
    // Always require 2FA for admin users
    if (user.role === 'admin') {
      return true;
    }

    // Require 2FA for users with elevated permissions
    if (user.permissions && user.permissions.includes('device_control')) {
      return true;
    }

    // Require 2FA for external IP addresses (not local network)
    if (clientIP && !this.isPrivateIP(clientIP)) {
      return true;
    }

    // Check if user has 2FA enabled
    return user.twoFactorEnabled || false;
  }

  /**
   * Check if IP is private/local
   * @param {string} ip - IP address
   * @returns {boolean} - Whether IP is private
   */
  isPrivateIP(ip) {
    const privateRanges = [
      /^10\\./,
      /^172\\.(1[6-9]|2[0-9]|3[0-1])\\./,
      /^192\\.168\\./,
      /^127\\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];
    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Generate recovery codes for account recovery
   * @returns {Array} - Array of recovery codes
   */
  generateRecoveryCodes() {
    const codes = [];
    for (let i = 0; i < 8; i++) {
      const code = crypto.randomBytes(16).toString('hex').toUpperCase();
      // Format as XXXX-XXXX-XXXX-XXXX
      const formattedCode = code.match(/.{1,4}/g).join('-');
      codes.push(formattedCode);
    }
    return codes;
  }

  /**
   * Create encrypted backup of 2FA settings
   * @param {Object} settings - 2FA settings to backup
   * @returns {string} - Encrypted backup string
   */
  createSecureBackup(settings) {
    try {
      const secret = process.env.BACKUP_ENCRYPTION_KEY || process.env.JWT_SECRET;
      const cipher = crypto.createCipher('aes-256-gcm', secret);

      const data = {
        ...settings,
        timestamp: Date.now(),
        version: '1.0'
      };

      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return encrypted;
    } catch (error) {
      throw new Error(`Failed to create secure backup: ${error.message}`);
    }
  }

  /**
   * Restore 2FA settings from encrypted backup
   * @param {string} backup - Encrypted backup string
   * @returns {Object} - Restored settings
   */
  restoreFromBackup(backup) {
    try {
      const secret = process.env.BACKUP_ENCRYPTION_KEY || process.env.JWT_SECRET;
      const decipher = crypto.createDecipher('aes-256-gcm', secret);

      let decrypted = decipher.update(backup, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const data = JSON.parse(decrypted);

      // Validate backup age (not older than 30 days)
      if (data.timestamp && (Date.now() - data.timestamp) > (30 * 24 * 60 * 60 * 1000)) {
        throw new Error('Backup is too old');
      }

      return data;
    } catch (error) {
      throw new Error(`Failed to restore from backup: ${error.message}`);
    }
  }
}

module.exports = new TwoFactorAuthService();
