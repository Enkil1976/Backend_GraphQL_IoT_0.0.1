# Backend GraphQL API Dockerfile
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    curl \
    tzdata \
    && cp /usr/share/zoneinfo/America/Santiago /etc/localtime \
    && echo "America/Santiago" > /etc/timezone

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 4001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:4001/health || exit 1

# Start the application
CMD ["npm", "start"]