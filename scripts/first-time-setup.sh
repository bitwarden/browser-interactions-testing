#!/usr/bin/env bash

set -e

# Check for script requirements
if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required but was not found on PATH. Please install Node.js (which includes npm) and re-run this script."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: docker compose is required but was not found. Please install Docker Desktop (or the Docker Compose v2 plugin) and re-run this script."
  exit 1
fi

projectRoot="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -f "${projectRoot}/.env" ]; then
  if [ ! -f "${projectRoot}/.env.example" ]; then
    echo "Error: neither .env nor .env.example was found in ${projectRoot}. Cannot bootstrap environment file."
    exit 1
  fi
  echo "No .env file found; copying .env.example to .env for subsequent setup scripts to populate."
  cp "${projectRoot}/.env.example" "${projectRoot}/.env"
fi

npm run setup:ssl

# Install/use the Node version pinned in .nvmrc, if nvm is installed
if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  . "${NVM_DIR}/nvm.sh"
  cd "${projectRoot}"
  nvm install || echo "Warning: 'nvm install' command failed; continuing with the currently active Node version."
else
  echo "nvm not detected; skipping 'nvm install'. Ensure your active Node version matches ${projectRoot}/.nvmrc."
fi

npm install -g @bitwarden/cli@2026.2.0

npm ci
npx playwright install --with-deps chromium

npm run setup:extension
npm run build:extension
npm run setup:install
npm run setup:crypto
docker compose up -d --build --remove-orphans --wait --wait-timeout 60
npm run seed:vault:account
npm run seed:vault:ciphers
npm run seed:vault:import

npm run setup:test-site
