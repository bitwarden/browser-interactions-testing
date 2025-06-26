#!/usr/bin/env bash

ROOT_DIR=$(git rev-parse --show-toplevel)

# shellcheck source=.env
set -o allexport
. $ROOT_DIR/.env
set +o allexport

export NODE_EXTRA_CA_CERTS=$ROOT_DIR/$BW_SSL_CERT

BW_COMMAND() {
  bw "$@"
}

if [[ -z "${VAULT_IMPORT_FILE}" ]]; then
    printf "No vault import file was specified. Skipping vault import...\n\n"

    exit 0
fi

chmod +r $VAULT_IMPORT_FILE

export VAULT_HOST=$VAULT_HOST_URL:$VAULT_HOST_PORT

if [[ -z "${VAULT_HOST_URL:-}" ]]; then
    echo "VAULT_HOST_URL is not set, using local dev values"
    export VAULT_HOST='--api http://localhost:4000 --identity http://localhost:33656 --web-vault https://localhost:8080 --events http://localhost:46273'
fi

BW_COMMAND status

# Login to the vault
# shellcheck disable=SC2086 # we want to pass the server host url as a single argument
BW_COMMAND logout --quiet # In case there's an active outdated session (e.g. docker container was rebuilt)
BW_COMMAND config server $VAULT_HOST || true # no error if already configured

BW_COMMAND login "$VAULT_EMAIL" "$VAULT_PASSWORD" --nointeraction --quiet || true # no error if already logged in
BW_COMMAND sync || true # no error if already synced

# Unlock and set session token
export BW_SESSION=$(
    BW_COMMAND unlock --passwordenv VAULT_PASSWORD --raw --nointeraction
)

printf "Importing...\n"
BW_COMMAND import bitwardenjson "${VAULT_IMPORT_FILE}"

BW_COMMAND logout --quiet
