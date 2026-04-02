#!/bin/bash

# Start Python PDF Service in the background on port 8081 with limited workers to save memory
echo "Starting Python PDF Service on port 8081..."
gunicorn --workers 1 --threads 2 --timeout 120 --bind 0.0.0.0:8081 api_with_supabase:app &

# Start Node.js WhatsApp Bot on port 8080
echo "Starting Node.js WhatsApp Bot on port 8080..."
npm start
