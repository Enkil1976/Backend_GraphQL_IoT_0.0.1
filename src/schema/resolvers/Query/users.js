const authService = require('../../../services/authService');
const { query } = require('../../../config/database');
const { AuthenticationError, ForbiddenError } = require('apollo-server-express');

const userQueries = {
  /**
   * Get current user (me)
   */
  me: async (parent, args, context) => {
    try {
      if (!context.user) {
        return null;
      }
      
      console.log('[UserQuery] Getting current user:', { userId: context.user.id });
      
      // Get fresh user data from database
      const user = await authService.getUserById(context.user.id);
      return user;
    } catch (error) {
      console.error('[UserQuery] Error getting current user:', error.message);
      return null;
    }
  },

  /**
   * Get all users (admin only)
   */
  users: async (parent, { role, active }, context) => {
    try {
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view users');
      }
      
      if (!authService.hasRole(context.user.role, 'admin')) {
        throw new ForbiddenError('Only admins can view all users');
      }
      
      console.log('[UserQuery] Getting all users', { role, active, requestedBy: context.user.username });
      
      let whereClause = 'WHERE 1=1';
      const queryParams = [];
      let paramCount = 0;
      
      if (role) {
        paramCount++;
        whereClause += ` AND role = $${paramCount}`;
        queryParams.push(role);
      }
      
      if (typeof active === 'boolean') {
        paramCount++;
        whereClause += ` AND is_active = $${paramCount}`;
        queryParams.push(active);
      }
      
      const result = await query(
        `SELECT id, username, email, role, created_at, updated_at, last_login, is_active 
         FROM users ${whereClause} 
         ORDER BY created_at DESC`,
        queryParams
      );
      
      console.log('[UserQuery] Found users:', result.rows.length);
      return result.rows;
    } catch (error) {
      console.error('[UserQuery] Error getting users:', error.message);
      throw error;
    }
  },

  /**
   * Get user by ID
   */
  user: async (parent, { id }, context) => {
    try {
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view user details');
      }
      
      // Users can only view their own profile unless they're admin/editor
      if (context.user.id.toString() !== id.toString() && 
          !authService.hasRole(context.user.role, 'editor')) {
        throw new ForbiddenError('You can only view your own profile');
      }
      
      console.log('[UserQuery] Getting user by ID:', { id, requestedBy: context.user.username });
      
      const result = await query(
        'SELECT id, username, email, role, created_at, updated_at, last_login, is_active FROM users WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('[UserQuery] Error getting user:', error.message);
      throw error;
    }
  },

  /**
   * Get user configuration
   */
  userConfiguration: async (parent, { key }, context) => {
    try {
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to view configuration');
      }
      
      console.log('[UserQuery] Getting user configuration:', { userId: context.user.id, key });
      
      let whereClause = 'WHERE user_id = $1';
      const queryParams = [context.user.id];
      
      if (key) {
        whereClause += ' AND config_key = $2';
        queryParams.push(key);
      }
      
      const result = await query(
        `SELECT id, config_key, config_value, created_at, updated_at 
         FROM user_configurations ${whereClause}
         ORDER BY config_key`,
        queryParams
      );
      
      return result.rows;
    } catch (error) {
      console.error('[UserQuery] Error getting user configuration:', error.message);
      throw error;
    }
  }
};

module.exports = userQueries;