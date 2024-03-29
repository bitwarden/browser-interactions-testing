#!/usr/bin/env bash

npm run setup:ssl

npm install -g @bitwarden/cli
npm ci
npx playwright install --with-deps chromium

npm run setup:extension
npm run build:extension

npm run setup:install
npm run setup:crypto
docker compose up -d --build --remove-orphans --wait --wait-timeout 60
npm run setup:vault

npm run setup:test-site
