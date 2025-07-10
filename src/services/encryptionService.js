const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

/**
 * Advanced Encryption Service
 * Handles encryption/decryption of sensitive data with key rotation
 */
class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
    this.saltLength = 32; // 256 bits

    // Initialize encryption keys
    this.initializeKeys();
  }

  /**
   * Initialize encryption keys from environment or generate new ones
   */
  async initializeKeys() {
    try {
      // Primary encryption key
      this.masterKey = process.env.ENCRYPTION_MASTER_KEY
        ? Buffer.from(process.env.ENCRYPTION_MASTER_KEY, 'hex')
        : await this.generateKey();

      // Database encryption key (separate from JWT secret)
      this.dbKey = process.env.DATABASE_ENCRYPTION_KEY
        ? Buffer.from(process.env.DATABASE_ENCRYPTION_KEY, 'hex')
        : await this.generateKey();

      // File encryption key
      this.fileKey = process.env.FILE_ENCRYPTION_KEY
        ? Buffer.from(process.env.FILE_ENCRYPTION_KEY, 'hex')
        : await this.generateKey();

      console.log('🔐 Encryption service initialized');

      // Warn if using generated keys (should be in environment)
      if (!process.env.ENCRYPTION_MASTER_KEY) {
        console.warn('⚠️ Using generated encryption key - set ENCRYPTION_MASTER_KEY in production');
      }
    } catch (error) {
      console.error('❌ Failed to initialize encryption keys:', error);
      throw error;
    }
  }

  /**
   * Generate a cryptographically secure key
   */
  async generateKey() {
    return crypto.randomBytes(this.keyLength);
  }

  /**
   * Derive key from password using PBKDF2
   */
  async deriveKey(password, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, 100000, this.keyLength, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  }

  /**
   * Encrypt data with AES-256-GCM
   */
  async encrypt(data, useKey = 'master') {
    try {
      const key = this.getKey(useKey);
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, key, { iv });

      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: this.algorithm
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data with AES-256-GCM
   */
  async decrypt(encryptedData, useKey = 'master') {
    try {
      const key = this.getKey(useKey);
      const { encrypted, iv, tag, algorithm } = encryptedData;

      if (algorithm !== this.algorithm) {
        throw new Error('Unsupported encryption algorithm');
      }

      const decipher = crypto.createDecipher(
        algorithm,
        key,
        { iv: Buffer.from(iv, 'hex') }
      );

      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt sensitive database fields
   */
  async encryptDBField(value) {
    if (!value) return null;

    try {
      const result = await this.encrypt(value, 'database');
      return `encrypted:${JSON.stringify(result)}`;
    } catch (error) {
      console.error('DB field encryption error:', error);
      throw error;
    }
  }

  /**
   * Decrypt sensitive database fields
   */
  async decryptDBField(encryptedValue) {
    if (!encryptedValue || !encryptedValue.startsWith('encrypted:')) {
      return encryptedValue; // Not encrypted
    }

    try {
      const encryptedData = JSON.parse(encryptedValue.replace('encrypted:', ''));
      return await this.decrypt(encryptedData, 'database');
    } catch (error) {
      console.error('DB field decryption error:', error);
      throw error;
    }
  }

  /**
   * Encrypt file contents
   */
  async encryptFile(filePath, outputPath = null) {
    try {
      const data = await fs.readFile(filePath);
      const encrypted = await this.encrypt(data.toString('base64'), 'file');

      const output = outputPath || `${filePath}.encrypted`;
      await fs.writeFile(output, JSON.stringify(encrypted));

      return output;
    } catch (error) {
      throw new Error(`File encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt file contents
   */
  async decryptFile(encryptedFilePath, outputPath = null) {
    try {
      const encryptedData = JSON.parse(await fs.readFile(encryptedFilePath, 'utf8'));
      const decryptedBase64 = await this.decrypt(encryptedData, 'file');
      const decryptedData = Buffer.from(decryptedBase64, 'base64');

      const output = outputPath || encryptedFilePath.replace('.encrypted', '');
      await fs.writeFile(output, decryptedData);

      return output;
    } catch (error) {
      throw new Error(`File decryption failed: ${error.message}`);
    }
  }

  /**
   * Hash data with salt (for passwords, etc.)
   */
  async hashWithSalt(data, providedSalt = null) {
    const salt = providedSalt || crypto.randomBytes(this.saltLength);
    const hash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512');

    return {
      hash: hash.toString('hex'),
      salt: salt.toString('hex')
    };
  }

  /**
   * Verify hashed data
   */
  async verifyHash(data, hash, salt) {
    const saltBuffer = Buffer.from(salt, 'hex');
    const computedHash = crypto.pbkdf2Sync(data, saltBuffer, 100000, 64, 'sha512');

    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      computedHash
    );
  }

  /**
   * Generate secure tokens
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate cryptographically secure random numbers
   */
  generateSecureRandom(min, max) {
    const range = max - min + 1;
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const maxValidValue = Math.floor(256 ** bytesNeeded / range) * range - 1;

    let randomValue;
    do {
      randomValue = crypto.randomBytes(bytesNeeded).readUIntBE(0, bytesNeeded);
    } while (randomValue > maxValidValue);

    return min + (randomValue % range);
  }

  /**
   * Create encrypted backup of sensitive configuration
   */
  async createSecureBackup(data, backupPassword) {
    try {
      const timestamp = new Date().toISOString();
      const backupData = {
        timestamp,
        version: '1.0',
        data
      };

      // Generate salt for backup password
      const salt = crypto.randomBytes(this.saltLength);
      const backupKey = await this.deriveKey(backupPassword, salt);

      // Encrypt backup data
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, backupKey, { iv });

      let encrypted = cipher.update(JSON.stringify(backupData), 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      return {
        encrypted,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: this.algorithm,
        created: timestamp
      };
    } catch (error) {
      throw new Error(`Backup creation failed: ${error.message}`);
    }
  }

  /**
   * Restore from encrypted backup
   */
  async restoreSecureBackup(encryptedBackup, backupPassword) {
    try {
      const { encrypted, salt, iv, tag, algorithm } = encryptedBackup;

      if (algorithm !== this.algorithm) {
        throw new Error('Unsupported backup algorithm');
      }

      // Derive key from backup password
      const saltBuffer = Buffer.from(salt, 'hex');
      const backupKey = await this.deriveKey(backupPassword, saltBuffer);

      // Decrypt backup
      const decipher = crypto.createDecipher(
        algorithm,
        backupKey,
        { iv: Buffer.from(iv, 'hex') }
      );

      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const backupData = JSON.parse(decrypted);

      // Validate backup age (optional security check)
      const backupDate = new Date(backupData.timestamp);
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

      if (Date.now() - backupDate.getTime() > maxAge) {
        console.warn('⚠️ Backup is older than 30 days');
      }

      return backupData.data;
    } catch (error) {
      throw new Error(`Backup restoration failed: ${error.message}`);
    }
  }

  /**
   * Rotate encryption keys (for enhanced security)
   */
  async rotateKeys() {
    try {
      console.log('🔄 Starting key rotation...');

      // Generate new keys
      const newMasterKey = await this.generateKey();
      const newDbKey = await this.generateKey();
      const newFileKey = await this.generateKey();

      // Store old keys for decryption of existing data
      this.oldKeys = {
        master: this.masterKey,
        database: this.dbKey,
        file: this.fileKey
      };

      // Update to new keys
      this.masterKey = newMasterKey;
      this.dbKey = newDbKey;
      this.fileKey = newFileKey;

      console.log('✅ Key rotation completed');
      console.log('⚠️ Update environment variables with new keys:');
      console.log(`ENCRYPTION_MASTER_KEY=${this.masterKey.toString('hex')}`);
      console.log(`DATABASE_ENCRYPTION_KEY=${this.dbKey.toString('hex')}`);
      console.log(`FILE_ENCRYPTION_KEY=${this.fileKey.toString('hex')}`);

      return {
        masterKey: this.masterKey.toString('hex'),
        databaseKey: this.dbKey.toString('hex'),
        fileKey: this.fileKey.toString('hex')
      };
    } catch (error) {
      throw new Error(`Key rotation failed: ${error.message}`);
    }
  }

  /**
   * Get encryption key by type
   */
  getKey(keyType) {
    switch (keyType) {
    case 'master':
      return this.masterKey;
    case 'database':
      return this.dbKey;
    case 'file':
      return this.fileKey;
    default:
      throw new Error(`Unknown key type: ${keyType}`);
    }
  }

  /**
   * Securely wipe sensitive data from memory
   */
  secureWipe(buffer) {
    if (Buffer.isBuffer(buffer)) {
      crypto.randomFillSync(buffer);
    }
  }

  /**
   * Get encryption status and health
   */
  getStatus() {
    return {
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      initialized: Boolean(this.masterKey && this.dbKey && this.fileKey),
      hasOldKeys: Boolean(this.oldKeys),
      secureRandomAvailable: Boolean(crypto.constants)
    };
  }
}

module.exports = new EncryptionService();
