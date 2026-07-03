FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY services/orchestrator/package.json services/orchestrator/package.json
COPY services/worker/package.json services/worker/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build --workspace @loopci/contracts
RUN npm run build --workspace @loopci/config
RUN npm run build --workspace @loopci/logger
RUN npm run build --workspace @loopci/worker

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/worker ./services/worker
RUN addgroup -S loopci && adduser -S loopci -G loopci && chown -R loopci:loopci /app
USER loopci
WORKDIR /app/services/worker
CMD ["node", "dist/index.js"]
