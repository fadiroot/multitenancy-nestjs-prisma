# Use the official Node.js image.
FROM node:20-alpine

# Create and change to the app directory.
WORKDIR /usr/src/app

# Install Docker CLI (if needed).
RUN apk add --no-cache docker-cli

# Copy application dependency manifests to the container image.
COPY package*.json ./

# Install dependencies.
RUN npm install

# Copy local code to the container image.
COPY . .

# Ensure the Prisma schema files are copied.
COPY prisma ./prisma

# Generate Prisma clients.
RUN npx prisma generate --schema=./prisma/schema.prisma

# Build the application.
RUN npm run build

# Run the web service on container startup.
CMD [ "npm", "start" ]