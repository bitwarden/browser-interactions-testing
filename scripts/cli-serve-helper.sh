#!/usr/bin/env bash

ROOT_DIR=$(git rev-parse --show-toplevel)

# shellcheck source=.env
set -o allexport
. $ROOT_DIR/.env
set +o allexport

export NODE_EXTRA_CA_CERTS=$ROOT_DIR/$BW_SSL_CERT

# BITWARDENCLI_APPDATA_DIR is a special var. See:
# https://github.com/bitwarden/clients/blob/1a6573ba96613ebcfd19c1c90ee5523452b8903a/apps/cli/src/bw.ts#L149
export BITWARDENCLI_APPDATA_DIR="$ROOT_DIR/scripts/tmp-vault-seeder"
mkdir -p "$BITWARDENCLI_APPDATA_DIR"

BW_COMMAND() {
  bw "$@"
}

export VAULT_HOST=$VAULT_HOST_URL:$VAULT_HOST_PORT

if [[ -z "${VAULT_HOST_URL:-}" ]]; then
    echo "VAULT_HOST_URL is not set, using local dev values"
    export VAULT_HOST='--api http://localhost:4000 --identity http://localhost:33656 --web-vault https://localhost:8080 --events http://localhost:46273'
fi

# Ensure data file is created
export BITWARDENCLI_APPDATA_DIR=$HOME
BW_COMMAND status

# Login to the vault
# shellcheck disable=SC2086 # we want to pass the server host url as a single argument
BW_COMMAND logout --quiet # In case there's an active outdated session (e.g. docker container was rebuilt)
BW_COMMAND config server $VAULT_HOST || true # no error if already configured
BW_COMMAND login "$VAULT_EMAIL" "$VAULT_PASSWORD" --nointeraction --quiet || true # no error if already logged in
BW_COMMAND sync || true # no error if already synced

# Unlock and set session token
export BW_SESSION=$(
    VAULT_PASSWORD=${VAULT_PASSWORD} BW_COMMAND unlock --passwordenv VAULT_PASSWORD --raw --nointeraction
)

# Start Vault Management API
BW_COMMAND serve --hostname $CLI_SERVE_HOST --port $CLI_SERVE_PORT &
