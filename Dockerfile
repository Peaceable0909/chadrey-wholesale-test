FROM node:22-slim

WORKDIR /app

# The image owns the complete build: frontend assets and Express/tRPC server.
COPY . .

RUN npm install -g corepack@latest \
  && corepack pnpm install \
  && corepack pnpm run build

ENV NODE_ENV=production

# Cloud Run supplies PORT at runtime; the application reads it from process.env.PORT.
CMD ["node", "dist/index.js"]
