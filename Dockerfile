FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:css && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# No curl/wget in node:alpine by default — use node itself so this doesn't
# need an extra installed package just for the healthcheck.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', res => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Run node directly (not `npm start`): npm runs as PID 1 in a container and
# does not forward SIGTERM to the node child process it spawns, so the
# graceful-shutdown handler in server.js would never actually receive the
# signal docker stop/compose down sends. Invoking node directly makes it PID
# 1, so it gets SIGTERM itself.
CMD ["node", "server.js"]
