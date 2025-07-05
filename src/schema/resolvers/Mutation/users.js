const authService = require('../../../services/authService');
const { query } = require('../../../config/database');
const { AuthenticationError, ForbiddenError } = require('apollo-server-express');
const bcrypt = require('bcryptjs');
const { pubsub, SENSOR_EVENTS } = require('../../../utils/pubsub');
const { validateStrongPassword, validateInput, sanitizeInput } = require('../../../middleware/security');

/**
 * User Mutation Resolvers
 * Handles user management operations
 */
const userMutations = {
  /**
   * Update user profile
   */
  updateProfile: async (parent, { input }, context) => {
    try {
      console.log('[UserMutation] Updating profile', { input, user: context.user?.username });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to update your profile');
      }

      const {
        firstName,
        lastName,
        email,
        timezone,
        language,
        notifications
      } = input;

      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      if (firstName !== undefined) {
        updateFields.push(`first_name = $${paramIndex}`);
        params.push(firstName);
        paramIndex++;
      }

      if (lastName !== undefined) {
        updateFields.push(`last_name = $${paramIndex}`);
        params.push(lastName);
        paramIndex++;
      }

      if (email !== undefined) {
        // Check if email is already in use
        const existingUser = await query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [email, context.user.id]
        );
        
        if (existingUser.rows.length > 0) {
          throw new Error('Email is already in use');
        }
        
        updateFields.push(`email = $${paramIndex}`);
        params.push(email);
        paramIndex++;
      }

      if (timezone !== undefined) {
        updateFields.push(`timezone = $${paramIndex}`);
        params.push(timezone);
        paramIndex++;
      }

      if (language !== undefined) {
        updateFields.push(`language = $${paramIndex}`);
        params.push(language);
        paramIndex++;
      }

      if (notifications !== undefined) {
        updateFields.push(`notification_preferences = $${paramIndex}`);
        params.push(JSON.stringify(notifications));
        paramIndex++;
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      updateFields.push(`updated_at = NOW()`);
      params.push(context.user.id);

      const result = await query(
        `UPDATE users 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, username, email, first_name, last_name, role, timezone, language, 
                  notification_preferences, created_at, updated_at, last_login, is_active`,
        params
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const updatedUser = result.rows[0];
      
      console.log(`[UserMutation] Updated profile for user: ${updatedUser.username}`);
      
      return {
        ...updatedUser,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        isActive: updatedUser.is_active,
        lastLogin: updatedUser.last_login,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at,
        notifications: updatedUser.notification_preferences 
          ? JSON.parse(updatedUser.notification_preferences)
          : {
              email: true,
              sms: false,
              push: true,
              webhook: false,
              deviceAlerts: true,
              systemAlerts: true,
              maintenanceReminders: true,
              ruleExecutions: false
            }
      };
    } catch (error) {
      console.error('[UserMutation] Error updating profile:', error);
      throw error;
    }
  },

  /**
   * Change password
   */
  changePassword: async (parent, { currentPassword, newPassword }, context) => {
    try {
      console.log('[UserMutation] Changing password', { user: context.user?.username });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to change your password');
      }

      // Security: Validate input and strong password
      const sanitizedInput = sanitizeInput({ currentPassword, newPassword });
      validateInput(sanitizedInput, 'passwordChange');
      validateStrongPassword(newPassword);

      // Get current user with password
      const result = await query(
        'SELECT password FROM users WHERE id = $1',
        [context.user.id]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = result.rows[0];
      
      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await query(
        'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, context.user.id]
      );

      console.log(`[UserMutation] Changed password for user: ${context.user.username}`);
      
      return true;
    } catch (error) {
      console.error('[UserMutation] Error changing password:', error);
      throw error;
    }
  },

  /**
   * Save user configuration
   */
  saveUserConfiguration: async (parent, { config, configName }, context) => {
    try {
      console.log('[UserMutation] Saving user configuration', { 
        configName, 
        user: context.user?.username 
      });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to save configuration');
      }

      const result = await query(
        `INSERT INTO user_configurations (user_id, config_name, config, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING *`,
        [context.user.id, configName || 'Default', JSON.stringify(config), true]
      );

      const configuration = result.rows[0];
      
      console.log(`[UserMutation] Saved configuration: ${configuration.config_name}`);
      
      return {
        ...configuration,
        configName: configuration.config_name,
        isActive: configuration.is_active,
        createdAt: configuration.created_at,
        updatedAt: configuration.updated_at,
        user: { id: context.user.id }
      };
    } catch (error) {
      console.error('[UserMutation] Error saving user configuration:', error);
      throw error;
    }
  },

  /**
   * Update user configuration
   */
  updateUserConfiguration: async (parent, { id, config, configName }, context) => {
    try {
      console.log(`[UserMutation] Updating user configuration ${id}`, { 
        configName, 
        user: context.user?.username 
      });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to update configuration');
      }

      // Check if configuration belongs to user
      const existingConfig = await query(
        'SELECT user_id FROM user_configurations WHERE id = $1',
        [id]
      );

      if (existingConfig.rows.length === 0) {
        throw new Error('Configuration not found');
      }

      if (existingConfig.rows[0].user_id !== context.user.id) {
        throw new ForbiddenError('You can only update your own configurations');
      }

      const updateFields = [];
      const params = [];
      let paramIndex = 1;

      if (config !== undefined) {
        updateFields.push(`config = $${paramIndex}`);
        params.push(JSON.stringify(config));
        paramIndex++;
      }

      if (configName !== undefined) {
        updateFields.push(`config_name = $${paramIndex}`);
        params.push(configName);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      updateFields.push(`updated_at = NOW()`);
      params.push(id);

      const result = await query(
        `UPDATE user_configurations 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        throw new Error('Configuration not found');
      }

      const configuration = result.rows[0];
      
      console.log(`[UserMutation] Updated configuration: ${configuration.config_name}`);
      
      return {
        ...configuration,
        configName: configuration.config_name,
        isActive: configuration.is_active,
        createdAt: configuration.created_at,
        updatedAt: configuration.updated_at,
        user: { id: context.user.id }
      };
    } catch (error) {
      console.error(`[UserMutation] Error updating user configuration ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete user configuration
   */
  deleteUserConfiguration: async (parent, { id }, context) => {
    try {
      console.log(`[UserMutation] Deleting user configuration ${id}`, { 
        user: context.user?.username 
      });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to delete configuration');
      }

      // Check if configuration belongs to user
      const existingConfig = await query(
        'SELECT user_id FROM user_configurations WHERE id = $1',
        [id]
      );

      if (existingConfig.rows.length === 0) {
        throw new Error('Configuration not found');
      }

      if (existingConfig.rows[0].user_id !== context.user.id) {
        throw new ForbiddenError('You can only delete your own configurations');
      }

      const result = await query(
        'DELETE FROM user_configurations WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Configuration not found or already deleted');
      }

      console.log(`[UserMutation] Deleted configuration ${id}`);
      
      return true;
    } catch (error) {
      console.error(`[UserMutation] Error deleting user configuration ${id}:`, error);
      throw error;
    }
  },

  /**
   * Activate user configuration
   */
  activateUserConfiguration: async (parent, { id }, context) => {
    try {
      console.log(`[UserMutation] Activating user configuration ${id}`, { 
        user: context.user?.username 
      });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to activate configuration');
      }

      // Check if configuration belongs to user
      const existingConfig = await query(
        'SELECT user_id FROM user_configurations WHERE id = $1',
        [id]
      );

      if (existingConfig.rows.length === 0) {
        throw new Error('Configuration not found');
      }

      if (existingConfig.rows[0].user_id !== context.user.id) {
        throw new ForbiddenError('You can only activate your own configurations');
      }

      // Deactivate all other configurations for this user
      await query(
        'UPDATE user_configurations SET is_active = false WHERE user_id = $1',
        [context.user.id]
      );

      // Activate the selected configuration
      const result = await query(
        `UPDATE user_configurations 
         SET is_active = true, updated_at = NOW() 
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error('Configuration not found');
      }

      const configuration = result.rows[0];
      
      console.log(`[UserMutation] Activated configuration: ${configuration.config_name}`);
      
      return {
        ...configuration,
        configName: configuration.config_name,
        isActive: configuration.is_active,
        createdAt: configuration.created_at,
        updatedAt: configuration.updated_at,
        user: { id: context.user.id }
      };
    } catch (error) {
      console.error(`[UserMutation] Error activating user configuration ${id}:`, error);
      throw error;
    }
  },

  /**
   * Update user role (Admin only)
   */
  updateUserRole: async (parent, { userId, role }, context) => {
    try {
      console.log(`[UserMutation] Updating user role`, { 
        userId, 
        role, 
        requestedBy: context.user?.username 
      });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to update user roles');
      }

      // Admin permission required
      if (!context.user.role || context.user.role !== 'admin') {
        throw new ForbiddenError('Only administrators can update user roles');
      }

      // Can't change own role
      if (context.user.id.toString() === userId.toString()) {
        throw new ForbiddenError('You cannot change your own role');
      }

      const result = await query(
        `UPDATE users 
         SET role = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, username, email, first_name, last_name, role, timezone, language, 
                  notification_preferences, created_at, updated_at, last_login, is_active`,
        [role.toLowerCase(), userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const updatedUser = result.rows[0];
      
      console.log(`[UserMutation] Updated role for user: ${updatedUser.username} to ${role}`);
      
      return {
        ...updatedUser,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        isActive: updatedUser.is_active,
        lastLogin: updatedUser.last_login,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at,
        notifications: updatedUser.notification_preferences 
          ? JSON.parse(updatedUser.notification_preferences)
          : {
              email: true,
              sms: false,
              push: true,
              webhook: false,
              deviceAlerts: true,
              systemAlerts: true,
              maintenanceReminders: true,
              ruleExecutions: false
            }
      };
    } catch (error) {
      console.error(`[UserMutation] Error updating user role:`, error);
      throw error;
    }
  },

  /**
   * Delete user (Admin only)
   */
  deleteUser: async (parent, { id }, context) => {
    try {
      console.log(`[UserMutation] Deleting user ${id}`, { 
        requestedBy: context.user?.username 
      });
      
      // Authentication required
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to delete users');
      }

      // Admin permission required
      if (!context.user.role || context.user.role !== 'admin') {
        throw new ForbiddenError('Only administrators can delete users');
      }

      // Can't delete own account
      if (context.user.id.toString() === id.toString()) {
        throw new ForbiddenError('You cannot delete your own account');
      }

      // Delete user configurations first
      await query(
        'DELETE FROM user_configurations WHERE user_id = $1',
        [id]
      );

      // Delete user notifications
      await query(
        'DELETE FROM notifications WHERE user_id = $1',
        [id]
      );

      // Delete the user
      const result = await query(
        'DELETE FROM users WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('User not found or already deleted');
      }

      console.log(`[UserMutation] Deleted user ${id}`);
      
      return true;
    } catch (error) {
      console.error(`[UserMutation] Error deleting user ${id}:`, error);
      throw error;
    }
  }
};

module.exports = userMutations;