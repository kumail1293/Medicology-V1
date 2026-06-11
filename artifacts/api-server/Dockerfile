FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy api-server files
COPY . .

# Install only production dependencies (assuming lock file is in api-server or parent)
RUN pnpm install --prod 2>/dev/null || pnpm install

# Build
RUN pnpm build

EXPOSE 5000

CMD ["pnpm", "start"]
