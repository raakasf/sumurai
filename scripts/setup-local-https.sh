#!/usr/bin/env sh
set -eu

CERT_DIR="${LOCAL_HTTPS_CERT_DIR:-.certs/mkcert}"
DOMAIN="${DOMAIN:-localhost}"
HOSTS="${DOMAIN} localhost 127.0.0.1 ::1 ${LOCAL_HTTPS_HOSTS:-}"

mkdir -p "${CERT_DIR}"

if ! command -v mkcert >/dev/null 2>&1; then
  cat >&2 <<'EOF'
mkcert is required for trusted local HTTPS certificates.

Install it first:
  macOS:   brew install mkcert nss
  Linux:   see https://github.com/FiloSottile/mkcert#installation
  Windows: choco install mkcert
EOF
  exit 1
fi

mkcert -install
# LOCAL_HTTPS_HOSTS is intentionally split on spaces so callers can pass
# LAN IPs or hostnames, for example: LOCAL_HTTPS_HOSTS="192.168.1.25 sumurai.local"
# shellcheck disable=SC2086
mkcert \
  -cert-file "${CERT_DIR}/fullchain.pem" \
  -key-file "${CERT_DIR}/privkey.pem" \
  ${HOSTS}

echo "Local HTTPS certificates written to ${CERT_DIR}"
echo "Restart nginx with: docker compose restart nginx"
