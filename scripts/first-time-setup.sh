#!/usr/bin/env bash

npm run setup:ssl

npm install -g @bitwarden/cli@2025.4.0
npm ci
npx playwright install --with-deps chromium

npm run setup:extension
npm run build:extension
npm run setup:install
npm run setup:crypto
docker compose up -d --build --remove-orphans --wait --wait-timeout 60
npm run seed:vault:account
npm run start:cli
npm run seed:vault:ciphers
npm run stop:cli
npm run seed:vault:import

npm run setup:test-site
