#!/usr/bin/env bash

ROOT_DIR=$(git rev-parse --show-toplevel)
ENV_FILE="$ROOT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "No .env file found."
  exit 1
fi

echo "Removing existing crypto values from .env..."

sed -i.bak \
  '/^# Generated crypto values/d;
   /^KDF_ITERATIONS=/d;
   /^MASTER_PASSWORD_HASH=/d;
   /^PROTECTED_SYMMETRIC_KEY=/d;
   /^GENERATED_RSA_KEY_PAIR_PUBLIC_KEY=/d;
   /^GENERATED_RSA_KEY_PAIR_PROTECTED_PRIVATE_KEY=/d' \
  "$ENV_FILE"

rm -f "${ENV_FILE}.bak"

echo "Regenerating crypto values..."
npm run setup:crypto
