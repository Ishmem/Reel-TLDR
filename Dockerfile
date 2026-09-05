# Use official Node.js 20 Debian Bookworm slim image
FROM node:20-bookworm-slim

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    PORT=3000 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Install Python 3, pip, venv, ffmpeg, curl and certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create isolated Python virtual environment and upgrade pip
RUN python3 -m venv /opt/venv && \
    pip install --no-cache-dir --upgrade pip

# Set application directory
WORKDIR /app

# Install Python dependencies first for caching layer efficiency
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy package manifests
COPY package*.json ./

# Install all Node dependencies (including devDependencies required for Vite/esbuild)
RUN npm install

# Copy application source code
COPY . .

# Build Vite frontend bundle and compile server.ts to dist/server.cjs
RUN npm run build

# Remove development dependencies to keep the image compact
RUN npm prune --omit=dev

# Ensure outputs directory exists with proper permissions
RUN mkdir -p /app/outputs && chmod -R 777 /app/outputs

# Expose server port
EXPOSE 3000

# Health check to ensure Express API server is active
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the full-stack server
CMD ["npm", "start"]
