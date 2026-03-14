# =============================================================================
# THALES WEB SERVER — Node.js with PTY + WebSocket Support
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# Install build dependencies for node-pty and utilities
RUN apk add --no-cache \
    curl \
    bash \
    python3 \
    make \
    g++ \
    linux-headers

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install

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
