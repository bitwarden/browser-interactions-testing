#!/usr/bin/env bash

openssl req -x509 -newkey rsa:4096 -keyout ssl.key -out ssl.crt -sha256 -days 1826 -nodes \
  -subj "/CN=localhost/O=Bitwarden Autofill Testing" \
  -addext "subjectAltName=DNS:localhost,DNS:bitwarden.test,IP:127.0.0.1"

printf "Certificate generated! Don't forget to update your system's secure store with the Certificate Authority:\n\n"
printf "on Mac OS: \e[30m\e[44m sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ssl.crt \e[0m\n"
printf "on Linux: \e[30m\e[44m sudo cp ssl.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates \e[0m\n"
