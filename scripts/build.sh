#!/bin/bash
set -e
cd client && npm ci --include=dev && VITE_API_URL=/api npm run build
mkdir -p ../server/static
cp -r dist/* ../server/static/
