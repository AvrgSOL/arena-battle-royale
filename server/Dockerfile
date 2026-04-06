FROM node:20-alpine

WORKDIR /app

# Install ALL deps (including devDeps needed for TypeScript build)
COPY package*.json ./
RUN npm ci

# Compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune devDeps after compile
RUN npm prune --omit=dev

# Create data directory for persistent JSON files
RUN mkdir -p /data

ENV DATA_DIR=/data
ENV NODE_ENV=production

EXPOSE 3002

CMD ["node", "dist/index.js"]
