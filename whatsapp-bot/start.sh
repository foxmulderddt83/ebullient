#!/bin/bash

# Ensure output directory exists
mkdir -p temp_outputs auth_info_baileys

# Start Python PDF Service in the background on port 8081
echo "🚀 Starting Python PDF Service on port 8081..."
gunicorn --workers 1 --threads 4 --timeout 120 --bind 0.0.0.0:8081 api_with_supabase:app &

# Wait for Python service to start (staggered startup to prevent OOM)
echo "⏳ Waiting for Python service to initialize..."
sleep 5

# Start Node.js WhatsApp Bot on port 8080
echo "🚀 Starting Node.js WhatsApp Bot on port 8080..."
node index.js
