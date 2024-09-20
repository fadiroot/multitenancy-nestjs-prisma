# Use the official Node.js image as the base image
FROM node:20-alpine

# Install Docker CLI
RUN apk add --no-cache docker-cli

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock) to the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Build the NestJS application
RUN npm run build

# Expose the port on which the NestJS app will run
EXPOSE 3000

# Create a startup script
RUN echo '#!/bin/sh' > /usr/local/bin/startup.sh && \
    echo 'docker network create tenant-network || true' >> /usr/local/bin/startup.sh && \
    echo 'npm run start:dev' >> /usr/local/bin/startup.sh && \
    chmod +x /usr/local/bin/startup.sh

# Command to run the startup script
CMD ["/usr/local/bin/startup.sh"]