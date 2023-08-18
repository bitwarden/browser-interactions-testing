#!/usr/bin/env bash

ROOT_DIR=$(git rev-parse --show-toplevel)

# Load .env values into the environment
set -o allexport
. $ROOT_DIR/.env
set +o allexport

curl "$SERVER_HOST_URL/identity/accounts/register" \
  -sX POST \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/109.0' \
  -H 'Accept: application/json' \
  -H 'Accept-Language: en-US,en;q=0.5' \
  -H 'Accept-Encoding: gzip, deflate, br' \
  -H "Referer: $SERVER_HOST_URL/" \
  -H 'content-type: application/json; charset=utf-8' \
  -H 'device-type: 10' \
  -H 'Bitwarden-Client-Name: web' \
  -H 'Bitwarden-Client-Version: 2023.1.1' \
  -H "Origin: $SERVER_HOST_URL" \
  -H 'DNT: 1' \
  -H 'Connection: keep-alive' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-origin' \
  -H 'Pragma: no-cache' \
  -H 'Cache-Control: no-cache' \
  --insecure \
  --compressed \
  --data-raw """
    {\"email\":\"$VAULT_EMAIL\",
    \"name\":null,
    \"masterPasswordHash\":\"$MASTER_PASSWORD_HASH\",
    \"key\":\"$PROTECTED_SYMMETRIC_KEY\",
    \"kdf\":0,
    \"kdfIterations\":\"$KDF_ITERATIONS\",
    \"referenceData\":{\"id\":null},
    \"captchaResponse\":null,
    \"masterPasswordHint\":null,
    \"keys\":{
      \"publicKey\":\"$GENERATED_RSA_KEY_PAIR_PUBLIC_KEY\",
      \"encryptedPrivateKey\":\"$GENERATED_RSA_KEY_PAIR_PROTECTED_PRIVATE_KEY\"
      }
    }
  """ | jq
