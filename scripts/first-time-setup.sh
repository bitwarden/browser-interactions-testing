#!/usr/bin/env bash

ROOT_DIR=$(git rev-parse --show-toplevel)

npm run setup:ssl

# Mac OSX
if [[ "$OSTYPE" == "darwin"* ]]; then
    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ssl.crt
# If not Mac OS, assume *nix
else
    sudo cp ssl.crt /usr/local/share/ca-certificates/
    sudo update-ca-certificates
fi

npm install -g @bitwarden/cli
npm ci
npx playwright install

npm run setup:extension
npm run build:extension

docker compose up -d --build
npm run setup:vault

npm run setup:test-site
