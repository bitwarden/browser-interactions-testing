#!/usr/bin/env bash

ROOT_DIR=$(git rev-parse --show-toplevel)

# Load .env values into the environment
set -o allexport
. "$ROOT_DIR/.env"
set +o allexport

certificateCommonName="localhost"
certificateOrganization="Bitwarden Automated Testing"
systemKeychain="/Library/Keychains/System.keychain"

# Prints the SHA-256 hash of every trusted certificate sharing the new
# certificate's subject, excluding the new certificate itself.
findSupersededCertificateHashes() {
    local workingDirectory
    local certificateFile
    local certificateSubject
    local certificateHash

    workingDirectory="$(mktemp -d)"

    security find-certificate -a -c "$certificateCommonName" -p "$systemKeychain" 2>/dev/null \
      | awk -v outputDirectory="$workingDirectory" '
          /BEGIN CERTIFICATE/ { certificateCount++ }
          certificateCount > 0 { print > (outputDirectory "/" certificateCount ".pem") }
        '

    for certificateFile in "$workingDirectory"/*.pem; do
        if [ ! -f "$certificateFile" ]; then
            continue
        fi

        certificateSubject="$(openssl x509 -in "$certificateFile" -noout -subject -nameopt RFC2253 2>/dev/null)"

        # Only an exact subject match can collide during anchor lookup, so
        # other certificates sharing the common name are left in place
        if [ "$certificateSubject" != "$newCertificateSubject" ]; then
            continue
        fi

        certificateHash="$(openssl x509 -in "$certificateFile" -noout -fingerprint -sha256 2>/dev/null | sed 's/.*=//; s/://g')"

        if [ -z "$certificateHash" ] || [ "$certificateHash" = "$newCertificateHash" ]; then
            continue
        fi

        printf "%s\n" "$certificateHash"
    done

    rm -rf "$workingDirectory"
}

# The keychain holds one entry per certificate rather than per file, so every
# run adds another trust anchor sharing this subject. OpenSSL resolves anchors
# by subject name and stops at the first match, so superseded duplicates make
# it reject the certificate the server is actually serving.
removeSupersededTrustedCertificates() {
    local certificateHash
    local confirmation
    local remainingCount
    local supersededCertificateHashes=()

    # Without both identifiers there is no reliable way to tell the new
    # certificate apart from the superseded ones, so nothing is removed
    if [ -z "$newCertificateSubject" ] || [ -z "$newCertificateHash" ]; then
        return 0
    fi

    while read -r certificateHash; do
        if [ -n "$certificateHash" ]; then
            supersededCertificateHashes+=("$certificateHash")
        fi
    done < <(findSupersededCertificateHashes)

    if [ "${#supersededCertificateHashes[@]}" -eq 0 ]; then
        return 0
    fi

    if [[ "$CI" != "true" ]]; then
        printf "\nThe new certificate is installed and trusted. %s superseded certificate(s) with\n" \
          "${#supersededCertificateHashes[@]}"
        printf "the same subject remain in the system keychain:\n"
        printf "  %s\n\n" "$newCertificateSubject"
        printf "Trust anchors are looked up by subject, so leaving these in place can make TLS\n"
        printf "verification against the local vault fail even though the new certificate is trusted.\n\n"
        printf "Removal needs elevated privileges and the system authorizes each certificate\n"
        printf "separately, so expect up to %s password prompt(s).\n" \
          "${#supersededCertificateHashes[@]}"

        read -r -p "Remove the ${#supersededCertificateHashes[@]} superseded certificate(s)? [y/N] " confirmation || confirmation="n"

        case "$confirmation" in
            [yY] | [yY][eE][sS]) ;;
            *)
                printf "\nLeaving %s superseded certificate(s) in place. TLS verification against the local\n" \
                  "${#supersededCertificateHashes[@]}"
                printf "vault may fail until they are removed.\n\n"
                return 0
                ;;
        esac
    fi

    # Interactive mode runs the whole set inside one 'security' process rather
    # than spawning one per certificate. The Security Server still authorizes
    # each item separately, so one prompt per certificate is expected.
    #
    # '-t' removes each certificate's trust settings alongside it. Those
    # settings are keyed by certificate hash, so omitting it would leave
    # entries behind with no certificate to attach to.
    printf "delete-certificate -Z %s -t ${systemKeychain}\n" "${supersededCertificateHashes[@]}" \
      | sudo security -i >/dev/null

    # Counted again rather than trusting the batch exit status, which stays
    # zero even when individual commands inside interactive mode fail
    remainingCount="$(findSupersededCertificateHashes | grep -c . || true)"

    if [[ "$CI" != "true" ]]; then
        printf "\nRemoved %s of %s superseded certificate(s).\n\n" \
          "$((${#supersededCertificateHashes[@]} - remainingCount))" "${#supersededCertificateHashes[@]}"
    fi

    if [ "$remainingCount" -gt 0 ]; then
        printf "Warning: %s superseded certificate(s) could not be removed.\n\n" "$remainingCount"
    fi
}

openssl req -x509 -newkey rsa:4096 -keyout $BW_SSL_KEY -out $BW_SSL_CERT -sha256 -days 1826 -nodes \
  -subj "/CN=${certificateCommonName}/O=${certificateOrganization}" \
  -addext "subjectAltName=DNS:localhost,DNS:bitwarden.test,IP:127.0.0.1"

chmod +rw $BW_SSL_KEY
chmod +rw $BW_SSL_CERT

# Identifiers for the certificate just generated, used to leave it in place
# while removing others that share its subject
newCertificateSubject="$(openssl x509 -in "$BW_SSL_CERT" -noout -subject -nameopt RFC2253 2>/dev/null)"
newCertificateHash="$(openssl x509 -in "$BW_SSL_CERT" -noout -fingerprint -sha256 2>/dev/null | sed 's/.*=//; s/://g')"

if [[ "$CI" != "true" ]]; then
    printf "Certificate generated! When prompted, enter your password to update your system's secure store with the Certificate Authority.\n\n"
    printf "Alternatively, you can manually add it with:\n"
fi

# Mac OSX
if [[ "$OSTYPE" == "darwin"* ]]; then
    if [[ "$CI" != "true" ]]; then
        printf "\e[30m\e[44m sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $BW_SSL_CERT \e[0m\n"
    fi

    sudo security add-trusted-cert -d -r trustRoot -k "$systemKeychain" "$BW_SSL_CERT"

    # Runs only once the new certificate is installed and trusted, so a working
    # setup never depends on the outcome of this optional cleanup
    removeSupersededTrustedCertificates
# If not Mac OS, assume *nix
else
    if [[ "$CI" != "true" ]]; then
        printf "\e[30m\e[44m sudo cp $BW_SSL_CERT /usr/local/share/ca-certificates/ && sudo update-ca-certificates \e[0m\n\n"
        printf "Important Note! Chromium doesn't use 'ca-certificates' on *nix. Instead it uses nssdb for cert storage, and depending on your configuration, may be in the shared system store at '\$HOME/.pki/nssdb', in Chromium's local snap store (e.g. '\$HOME/snap/chromium/current/.pki/nssdb'), or elsewhere. You will need to install the appropriate binary for your distro to run 'certutil -d sql:\$CHROMIUM_SECURE_STORE -A -t \"CP,CP,\" -n TestAutomationSSL -i ./$BW_SSL_CERT' from the project root."
    fi

    sudo cp $BW_SSL_CERT /usr/local/share/ca-certificates/
    sudo update-ca-certificates
fi
