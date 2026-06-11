FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy only package.json and lock files first (for layer caching)
COPY ../../pnpm-lock.yaml ../../package.json ../../.npmrc* ./

# Copy the api-server source
COPY . ./api-server

# Copy database module
COPY ../../lib ./lib

# Install dependencies
WORKDIR /app
RUN pnpm install --frozen-lockfile

# Build
WORKDIR /app/api-server
RUN pnpm build

EXPOSE 5000

CMD ["pnpm", "start"]
