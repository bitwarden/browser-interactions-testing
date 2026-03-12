#!/usr/bin/env bash

ROOT_DIR=$(git rev-parse --show-toplevel)
cd "$ROOT_DIR"

# ── Formatting ────────────────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
DIM='\033[2m'
RESET='\033[0m'

OK="${GREEN}✓${RESET}"
WARN="${YELLOW}!${RESET}"
ERR="${RED}✗${RESET}"

errors=0
warnings=0

row() {
  printf "  [%b]  %-22s %b\n" "$1" "$2" "$3"
}

hint() {
  printf "         %-22s ${DIM}→  %s${RESET}\n" "" "$1"
}

printf "\n${BOLD}BIT Environment Status${RESET}\n"
echo "──────────────────────────────────────────────"

# ── .env ──────────────────────────────────────────────────────────────────────
if [ ! -f "$ROOT_DIR/.env" ]; then
  row "$ERR" ".env" "missing"
  hint "cp .env.example .env  and fill in required values"
  errors=$((errors + 1))
else
  set -o allexport; source "$ROOT_DIR/.env"; set +o allexport

  missing=()
  for var in \
    VAULT_EMAIL VAULT_PASSWORD \
    PAGES_HOST VAULT_HOST_URL VAULT_HOST_PORT \
    CLI_SERVE_HOST CLI_SERVE_PORT \
    EXTENSION_BUILD_PATH \
    BW_DOMAIN \
    BW_DB_PROVIDER BW_DB_SERVER BW_DB_DATABASE \
    BW_DB_USERNAME BW_DB_PASSWORD BW_DB_PORT \
    BW_ENABLE_SSL BW_SSL_CERT BW_SSL_KEY; do
    val=$(eval "echo \"\${${var}:-}\"")
    if [ -z "$val" ] || [[ "$val" == *"<"* ]]; then
      missing+=("$var")
    fi
  done

  if [ ${#missing[@]} -gt 0 ]; then
    row "$ERR" ".env" "missing required vars: ${missing[*]}"
    errors=$((errors + 1))
  else
    row "$OK" ".env" "configured"
  fi
fi

# ── Vault import file (optional) ──────────────────────────────────────────────
if [ -n "${VAULT_IMPORT_FILE:-}" ]; then
  if [ -f "$ROOT_DIR/$VAULT_IMPORT_FILE" ]; then
    row "$OK" "Vault import file" "$VAULT_IMPORT_FILE"
  else
    row "$ERR" "Vault import file" "not found  ($VAULT_IMPORT_FILE)"
    errors=$((errors + 1))
  fi
else
  row "$WARN" "Vault import file" "not set  (optional)"
  warnings=$((warnings + 1))
fi

# ── SSL certificates ──────────────────────────────────────────────────────────
if [ -f "$ROOT_DIR/ssl.crt" ] && [ -f "$ROOT_DIR/ssl.key" ]; then
  row "$OK" "SSL certificates" "ssl.crt / ssl.key"
else
  row "$ERR" "SSL certificates" "missing"
  hint "npm run setup:ssl"
  errors=$((errors + 1))
fi

# ── node_modules ──────────────────────────────────────────────────────────────
if [ -d "$ROOT_DIR/node_modules/.bin" ]; then
  row "$OK" "node_modules" "installed"
else
  row "$ERR" "node_modules" "missing"
  hint "npm ci"
  errors=$((errors + 1))
fi

# ── Extension build ───────────────────────────────────────────────────────────
BUILD_PATH="${EXTENSION_BUILD_PATH:-clients/apps/browser/build}"
MANIFEST="$ROOT_DIR/$BUILD_PATH/manifest.json"

if [ -f "$MANIFEST" ]; then
  MV=$(grep -o '"manifest_version":[[:space:]]*[0-9]*' "$MANIFEST" | grep -o '[0-9]*$')
  VER=$(grep -o '"version":[[:space:]]*"[^"]*"' "$MANIFEST" | head -1 | grep -o '"[^"]*"$' | tr -d '"')
  row "$OK" "Extension" "built  (manifest v${MV:-?}, v${VER:-?})"
else
  row "$ERR" "Extension" "not built"
  hint "npm run build:extension"
  errors=$((errors + 1))
fi

# ── Docker containers ─────────────────────────────────────────────────────────
if ! docker info > /dev/null 2>&1; then
  row "$ERR" "Docker" "Docker Desktop not running"
  errors=$((errors + 1))
else
  EXPECTED_IMAGE=$(grep "image:.*bitwarden" "$ROOT_DIR/docker-compose.yml" | awk '{print $2}')
  CURRENT_PROJECT=$(grep "^name:" "$ROOT_DIR/docker-compose.yml" | awk '{print $2}')

  # List orphaned BIT volumes from other compose projects (pattern: v20YY-MM-DD_*)
  orphaned_volumes() {
    docker volume ls --format "{{.Name}}" 2>/dev/null \
      | grep -E '^v20[0-9]{2}-[0-9]{2}-[0-9]{2}_' \
      | grep -v "^${CURRENT_PROJECT}_" \
      || true
  }

  show_orphaned_volumes() {
    local vols
    vols=$(orphaned_volumes)
    if [ -n "$vols" ]; then
      printf "         %-22s ${DIM}Orphaned BIT volumes from old stacks:${RESET}\n" ""
      while IFS= read -r vol; do
        printf "         %-22s ${DIM}  docker volume rm %s${RESET}\n" "" "$vol"
      done <<< "$vols"
    fi
  }

  # Find any running bitwarden container regardless of compose project
  BW_ID=$(docker ps --filter "label=com.docker.compose.service=bitwarden" \
    --format "{{.ID}}" 2>/dev/null | head -1)

  if [ -n "$BW_ID" ]; then
    BW_HEALTH=$(docker inspect --format "{{.State.Health.Status}}" "$BW_ID" 2>/dev/null || true)
    ACTUAL_IMAGE=$(docker inspect --format "{{.Config.Image}}" "$BW_ID" 2>/dev/null || true)
    BW_PROJECT=$(docker inspect --format \
      "{{index .Config.Labels \"com.docker.compose.project\"}}" "$BW_ID" 2>/dev/null || true)
    BW_NAME=$(docker inspect --format "{{.Name}}" "$BW_ID" 2>/dev/null | sed 's|^/||' || true)
    BW_PORTS=$(docker ps --filter "id=$BW_ID" --format "{{.Ports}}" 2>/dev/null || true)
    DB_IMAGE=$(docker ps \
      --filter "label=com.docker.compose.project=${BW_PROJECT}" \
      --filter "label=com.docker.compose.service=db" \
      --format "{{.Image}}" 2>/dev/null | head -1 || true)

    show_container_details() {
      hint "name: ${BW_NAME}${DB_IMAGE:+  |  db: ${DB_IMAGE}}${BW_PORTS:+  |  ports: ${BW_PORTS}}"
    }

    if [ "$BW_HEALTH" = "unhealthy" ]; then
      row "$ERR" "Docker" "bitwarden unhealthy  (${ACTUAL_IMAGE})"
      show_container_details
      hint "docker compose logs bitwarden"
      errors=$((errors + 1))
    elif [ "$BW_HEALTH" = "starting" ]; then
      row "$WARN" "Docker" "bitwarden still starting up...  (${ACTUAL_IMAGE})"
      show_container_details
      warnings=$((warnings + 1))
    elif [ "$ACTUAL_IMAGE" = "$EXPECTED_IMAGE" ]; then
      row "$OK" "Docker" "running  (${ACTUAL_IMAGE})"
      show_container_details
    else
      row "$WARN" "Docker" "running wrong version  (got: ${ACTUAL_IMAGE}, want: ${EXPECTED_IMAGE})"
      show_container_details
      if [ -n "$BW_PROJECT" ]; then
        hint "docker compose -p ${BW_PROJECT} down && docker compose up -d --build --wait"
      else
        hint "docker stop ${BW_ID:0:12} && docker compose up -d --build --wait"
      fi
      show_orphaned_volumes
      warnings=$((warnings + 1))
    fi
  else
    # No bitwarden container running — check what's blocking the ports
    DB_PORT="${BW_DB_PORT:-3306}"
    BW_PORT="${VAULT_HOST_PORT:-8443}"

    port_owner() {
      local port="$1"
      local cid
      cid=$(docker ps -a --format "{{.ID}}\t{{.Ports}}" 2>/dev/null \
        | grep ":${port}->" | awk '{print $1}' | head -1)
      if [ -n "$cid" ]; then
        local proj
        proj=$(docker inspect --format \
          "{{index .Config.Labels \"com.docker.compose.project\"}}" "$cid" 2>/dev/null)
        [ -n "$proj" ] && echo "docker project: ${proj}" || echo "docker container ${cid:0:12}"
      else
        lsof -i ":${port}" -sTCP:LISTEN 2>/dev/null \
          | grep -v "^COMMAND" | awk '{print $1, $2}' | head -1
      fi
    }

    conflict_db=$(port_owner "$DB_PORT")
    conflict_bw=$(port_owner "$BW_PORT")

    if [ -n "$conflict_db" ]; then
      row "$ERR" "Docker" "not running  (port ${DB_PORT} blocked by: ${conflict_db})"
      if [[ "$conflict_db" == "docker project: "* ]]; then
        blocking="${conflict_db#docker project: }"
        hint "docker compose -p ${blocking} down"
      else
        hint "stop the conflicting process, then: docker compose up -d --wait"
      fi
    elif [ -n "$conflict_bw" ]; then
      row "$ERR" "Docker" "not running  (port ${BW_PORT} blocked by: ${conflict_bw})"
      hint "stop the conflicting process, then: docker compose up -d --wait"
    else
      row "$ERR" "Docker" "not running"
      hint "docker compose up -d --wait"
    fi
    show_orphaned_volumes
    errors=$((errors + 1))
  fi
fi

# ── Vault reachability ────────────────────────────────────────────────────────
VAULT_URL="${VAULT_HOST_URL:-https://localhost}:${VAULT_HOST_PORT:-8443}"
CACERT_OPT=""
[ -f "$ROOT_DIR/ssl.crt" ] && CACERT_OPT="--cacert $ROOT_DIR/ssl.crt"

if curl -sf $CACERT_OPT --max-time 3 "${VAULT_URL}/alive" > /dev/null 2>&1; then
  row "$OK" "Vault" "reachable  (${VAULT_URL})"

  # Check that the test account exists in this vault's DB.
  # A fresh DB (e.g. after switching image versions) requires re-seeding even
  # though the crypto values in .env are still valid.
  PRELOGIN_STATUS=$(curl -s $CACERT_OPT --max-time 5 -o /dev/null -w "%{http_code}" \
    -X POST "${VAULT_URL}/identity/accounts/prelogin" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${VAULT_EMAIL}\"}" 2>/dev/null || true)

  if [ "$PRELOGIN_STATUS" = "200" ]; then
    row "$OK" "Vault account" "${VAULT_EMAIL}"
  else
    row "$ERR" "Vault account" "not found  (DB may be fresh after a version switch)"
    hint "npm run setup:vault"
    errors=$((errors + 1))
  fi

  # Check feature flags
  if [ -n "${REMOTE_VAULT_CONFIG_MATCH:-}" ]; then
    row "$OK" "Feature flags" "synced from remote  (${REMOTE_VAULT_CONFIG_MATCH})"
  else
    CONFIG_JSON=$(curl -s $CACERT_OPT --max-time 5 "${VAULT_URL}/api/config" 2>/dev/null || true)
    FLAG_COUNT=$(python3 -c "
import json, sys
try:
    d = json.loads(sys.argv[1])
    print(len(d.get('featureStates', {})))
except:
    print(-1)
" "$CONFIG_JSON" 2>/dev/null || echo -1)

    if [ "$FLAG_COUNT" -gt 0 ] 2>/dev/null; then
      row "$OK" "Feature flags" "${FLAG_COUNT} flags loaded"
    elif [ "$FLAG_COUNT" -eq 0 ] 2>/dev/null; then
      row "$WARN" "Feature flags" "featureStates is empty — flags may not be configured"
      hint "npm run setup:flags  # sync from a remote config source"
      warnings=$((warnings + 1))
    else
      row "$WARN" "Feature flags" "could not read /api/config"
      warnings=$((warnings + 1))
    fi
  fi
else
  row "$WARN" "Vault" "not reachable  (${VAULT_URL})"
  warnings=$((warnings + 1))
fi

# ── Test site ─────────────────────────────────────────────────────────────────
# Playwright's webServer starts/stops the test site automatically.
# Probe that it's serveable: start in background, hit the endpoint, then stop.
PAGES_URL="${PAGES_HOST:-https://127.0.0.1}${PAGES_HOST_PORT:+:${PAGES_HOST_PORT}}"

_probe_test_site() {
  local pid log i ok=0
  log=$(mktemp)

  # If something is already serving on this port, the server is clearly up
  if curl -sf $CACERT_OPT --max-time 2 "${PAGES_URL}" > /dev/null 2>&1; then
    rm -f "$log"; return 0
  fi

  # exec replaces the subshell with node directly, so $pid == node PID
  (
    export SSL_CERT=${BW_SSL_CERT:-ssl.crt}
    export SSL_KEY=${BW_SSL_KEY:-ssl.key}
    export SERVE_PORT=$PAGES_HOST_PORT
    export SERVE_INSECURE_PORT=$PAGES_HOST_INSECURE_PORT
    cd "$ROOT_DIR/test-site/api"
    exec node build/app.js
  ) > "$log" 2>&1 &
  pid=$!

  for i in $(seq 1 15); do
    sleep 0.5
    if ! kill -0 "$pid" 2>/dev/null; then break; fi
    if curl -sf $CACERT_OPT --max-time 2 "${PAGES_URL}" > /dev/null 2>&1; then
      ok=1; break
    fi
  done

  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
  rm -f "$log"
  return $((1 - ok))
}

if _probe_test_site; then
  row "$OK" "Test site" "serveable  (${PAGES_URL})"
else
  row "$ERR" "Test site" "failed to serve"
  hint "cd test-site && npm run build:client  # rebuild if not yet built"
  hint "cd test-site/api && npm run build     # rebuild API if needed"
  errors=$((errors + 1))
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo "──────────────────────────────────────────────"
if [ $errors -eq 0 ] && [ $warnings -eq 0 ]; then
  printf "  ${GREEN}${BOLD}Ready to run tests.${RESET}\n"
elif [ $errors -eq 0 ]; then
  printf "  ${YELLOW}${BOLD}Start the above service(s) before running tests.${RESET}\n"
else
  printf "  ${RED}${BOLD}Fix the above before running tests.${RESET}\n"
fi
printf "\n"
