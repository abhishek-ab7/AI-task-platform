# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Runner Stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY src ./src

USER node

EXPOSE 5000

CMD ["node", "src/index.js"]
