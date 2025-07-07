# Use Node.js 18 LTS Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Install system dependencies for native modules
RUN apk add --no-cache     python3     make     g++     git     curl     postgresql-client     redis

# Copy package files
COPY package*.json ./

# Install production dependencies with exact versions
RUN npm ci --only=production

# Install missing WebSocket transport dependency
RUN npm install subscriptions-transport-ws@0.11.0

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Copy application source
COPY . .

# Make entrypoint script executable
RUN chmod +x docker-entrypoint.sh

# Create logs directory and set permissions
RUN mkdir -p logs backups && \
    chown -R nodeuser:nodejs /usr/src/app && \
    chmod -R 755 /usr/src/app

# Switch to non-root user
USER nodeuser

# Expose GraphQL port
EXPOSE 4001

# Health check
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=3 \
    CMD node healthcheck.js || exit 1

# Set entrypoint
ENTRYPOINT ["./docker-entrypoint.sh"]

# Default command
CMD ["start"]