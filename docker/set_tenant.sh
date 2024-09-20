#!/bin/bash

# Usage: ./setup_tenant.sh <container_id> <sql_file>

CONTAINER_ID=$1
SQL_FILE=$2

if [ -z "$CONTAINER_ID" ] || [ -z "$SQL_FILE" ]; then
  echo "Usage: $0 <container_id> <sql_file>"
  exit 1
fi

# Copy the SQL file into the container
docker cp "$SQL_FILE" "$CONTAINER_ID":/tmp/init.sql

# Run the SQL file inside the container
docker exec -it "$CONTAINER_ID" psql -U postgres -f /tmp/init.sql

# Clean up
docker exec -it "$CONTAINER_ID" rm /tmp/init.sql
