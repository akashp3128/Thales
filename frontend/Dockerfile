# =============================================================================
# THALES WEB SERVER — Node.js with WebSocket Support
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# Install dependencies for health checks and utilities
RUN apk add --no-cache curl bash

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY src/ ./src/
COPY public/ ./public/

# Expose port
EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=5s --timeout=3s --retries=5 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start server
CMD ["node", "src/server.js"]
