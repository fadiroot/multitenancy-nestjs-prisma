#!/bin/bash

# Wait for the database to be ready
echo "Waiting for database to be ready..."
until docker exec postgres pg_isready -U myUser -d myDb
do
  echo "Database is unavailable - sleeping"
  sleep 1
done

echo "Database is ready!"

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate --schema=./prisma/schema.prisma

# Run Prisma migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "Master schema deployment completed!"