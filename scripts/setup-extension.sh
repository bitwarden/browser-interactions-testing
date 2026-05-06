#!/usr/bin/env bash

set -e

projectRoot="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
clientsDir="${projectRoot}/clients"

rm -rf "${clientsDir}"
git clone https://github.com/bitwarden/clients.git "${clientsDir}"

cd "${clientsDir}"

# Install/use the Node version pinned in clients/.nvmrc, if nvm is installed
if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  . "${NVM_DIR}/nvm.sh"
  nvm install || echo "Warning: 'nvm install' command failed; continuing with the currently active Node version."
else
  echo "nvm not detected; skipping 'nvm install'. Ensure your active Node version matches ${clientsDir}/.nvmrc."
fi

npm ci
