FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY gateway/package.json gateway/package-lock.json gateway/tsconfig.json ./
RUN npm ci --omit=optional

FROM deps AS compile
COPY gateway/src ./src
RUN npm run compile

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=compile /app/compiled ./compiled
COPY gateway/package.json ./package.json
CMD ["node", "compiled/server.js"]
