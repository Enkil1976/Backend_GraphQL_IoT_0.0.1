# Use Node.js 20 LTS Alpine for smaller image size
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Update package index and install system dependencies for native modules
RUN apk update && apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    postgresql-client \
    redis

# Copy package files
COPY package*.json .npmrc ./

# Install all dependencies (production + security packages)
RUN npm ci --silent

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Copy application source
COPY . .

# Make entrypoint script executable
RUN chmod +x docker-entrypoint.sh

# Create logs directory with simple permissions
RUN mkdir -p logs backups && \
    chown nodeuser:nodejs logs backups && \
    chmod 755 logs backups

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