# Dockerfile

# stage 1: builder
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# stage 2:

FROM node:20-alpine AS runtime

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/index.js ./index.js
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/jobs ./jobs
COPY --from=builder /app/services ./services
COPY --from=builder /app/routes ./routes

USER node

EXPOSE 3500

CMD ["node", "index.js"]