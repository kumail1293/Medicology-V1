FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy root files
COPY pnpm-lock.yaml .npmrc ./
COPY package.json ./

# Copy monorepo structure
COPY artifacts/api-server ./artifacts/api-server
COPY lib ./lib

# Install dependencies
RUN pnpm install --frozen-lockfile

WORKDIR /app/artifacts/api-server

# Build
RUN pnpm build

EXPOSE 5000

# Start
CMD ["pnpm", "start"]
