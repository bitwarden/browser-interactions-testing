#!/usr/bin/env bash

ROOT_DIR=$(git rev-parse --show-toplevel)

# shellcheck source=.env
set -o allexport
source $ROOT_DIR/.env
set +o allexport


export SSL_CERT=$BW_SSL_CERT
export SSL_KEY=$BW_SSL_KEY
export SERVE_PORT=$PAGES_HOST_PORT
export SERVE_INSECURE_PORT=$PAGES_HOST_INSECURE_PORT

cd $ROOT_DIR/test-site/api/
npm start
