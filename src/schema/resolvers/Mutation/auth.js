const authService = require('../../../services/authService');
const { AuthenticationError, UserInputError } = require('apollo-server-express');
const { validateStrongPassword, validateInput, sanitizeInput } = require('../../../middleware/security');

const authMutations = {
  /**
   * User login
   */
  login: async(parent, { username, password }, context) => {
    try {

      console.log('[AuthMutation] Login attempt:', { username });

      if (!username || !password) {
        throw new UserInputError('Username and password are required');
      }

      const result = await authService.login(username, password);

      console.log('[AuthMutation] Login successful:', { userId: result.user.id, username: result.user.username });

      return {
        success: true,
        message: 'Login successful',
        user: result.user,
        token: result.token,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn
      };
    } catch (error) {
      console.error('[AuthMutation] Login failed:', error.message);
      throw new AuthenticationError(error.message);
    }
  },

  /**
   * User registration
   */
  register: async(parent, { input }, context) => {
    try {
      // Security: Validate and sanitize input
      const sanitizedInput = sanitizeInput(input);
      const validatedInput = validateInput(sanitizedInput, 'userRegistration');

      const { username, email, password, role } = validatedInput;

      console.log('[AuthMutation] Registration attempt:', { username, email, role });

      // Security: Validate strong password
      validateStrongPassword(password);

      const result = await authService.register({ username, email, password, role });

      console.log('[AuthMutation] Registration successful:', { userId: result.user.id, username: result.user.username });

      return {
        success: true,
        message: 'Registration successful',
        user: result.user,
        token: result.token,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn
      };
    } catch (error) {
      console.error('[AuthMutation] Registration failed:', error.message);
      throw new UserInputError(error.message);
    }
  },

  /**
   * Refresh JWT token
   */
  refreshToken: async(parent, { refreshToken }, context) => {
    try {
      console.log('[AuthMutation] Token refresh attempt');

      if (!refreshToken) {
        throw new UserInputError('Refresh token is required');
      }

      const result = await authService.refreshToken(refreshToken);

      console.log('[AuthMutation] Token refresh successful:', { userId: result.user.id });

      return {
        success: true,
        message: 'Token refreshed successfully',
        user: result.user,
        token: result.token,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn
      };
    } catch (error) {
      console.error('[AuthMutation] Token refresh failed:', error.message);
      throw new AuthenticationError(error.message);
    }
  },

  /**
   * User logout
   */
  logout: async(parent, args, context) => {
    try {
      if (!context.user) {
        throw new AuthenticationError('You must be logged in to logout');
      }

      console.log('[AuthMutation] Logout attempt:', { userId: context.user.id });

      await authService.logout(context.user.id);

      console.log('[AuthMutation] Logout successful:', { userId: context.user.id });

      return {
        success: true,
        message: 'Logout successful'
      };
    } catch (error) {
      console.error('[AuthMutation] Logout failed:', error.message);
      throw new Error(error.message);
    }
  }
};

module.exports = authMutations;
