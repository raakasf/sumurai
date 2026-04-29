#!/bin/sh
set -euo pipefail

DOMAIN="${DOMAIN:-localhost}"
SSL_PORT="${SSL_PORT:-8443}"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
FULLCHAIN="${CERT_DIR}/fullchain.pem"
PRIVKEY="${CERT_DIR}/privkey.pem"

# Ensure tools present
if ! command -v openssl >/dev/null 2>&1 || ! command -v envsubst >/dev/null 2>&1; then
  apk add --no-cache openssl gettext >/dev/null
fi

mkdir -p "${CERT_DIR}"
mkdir -p /var/www/certbot

# Generate a self-signed cert if none exists (useful for first boot/local)
if [ ! -s "${FULLCHAIN}" ] || [ ! -s "${PRIVKEY}" ]; then
  echo "Generating self-signed certificate for ${DOMAIN}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "${PRIVKEY}" \
    -out "${FULLCHAIN}" \
    -subj "/CN=${DOMAIN}" >/dev/null 2>&1
fi

# Render nginx config from template with env vars
export DOMAIN SSL_PORT
envsubst '${DOMAIN} ${SSL_PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

if [ "${NGINX_EGRESS_LOCKDOWN:-true}" = "true" ]; then
  echo "Applying nginx egress lockdown"

  iptables -F OUTPUT
  iptables -P OUTPUT DROP

  iptables -A OUTPUT -o lo -j ACCEPT
  iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
  iptables -A OUTPUT -p tcp -m multiport --sports 80,443 -j ACCEPT

  # Private network ranges cover Docker Desktop's host-port forwarding path
  # and internal service traffic without opening public internet egress.
  iptables -A OUTPUT -d 10.0.0.0/8 -j ACCEPT
  iptables -A OUTPUT -d 172.16.0.0/12 -j ACCEPT
  iptables -A OUTPUT -d 192.168.0.0/16 -j ACCEPT

  # Docker embedded DNS resolver for upstream service name lookups.
  iptables -A OUTPUT -d 127.0.0.11/32 -p udp --dport 53 -j ACCEPT
  iptables -A OUTPUT -d 127.0.0.11/32 -p tcp --dport 53 -j ACCEPT

  # Permit the directly attached Docker network subnets explicitly too. This
  # keeps the rules readable if Docker allocates outside the common private
  # ranges in a future environment.
  ip -o -f inet addr show scope global | awk '{print $4}' | while read -r cidr; do
    iptables -A OUTPUT -d "${cidr}" -j ACCEPT
  done
fi

exec nginx -g "daemon off;"
