FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

RUN mkdir -p /data

ENV DATA_DIR=/data
ENV NODE_ENV=production

EXPOSE 3002
CMD ["node", "dist/index.js"]
