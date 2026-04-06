FROM node:20-alpine

WORKDIR /app

# Install deps first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy source and compile
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# Create data directory for persistent JSON files
RUN mkdir -p /data && chown node:node /data

ENV DATA_DIR=/data
ENV NODE_ENV=production

USER node
EXPOSE 3002

CMD ["node", "dist/index.js"]
