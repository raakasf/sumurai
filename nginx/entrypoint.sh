#!/bin/sh
set -euo pipefail

DOMAIN="${DOMAIN:-localhost}"
SSL_PORT="${SSL_PORT:-8443}"
LE_CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
LE_FULLCHAIN="${LE_CERT_DIR}/fullchain.pem"
LE_PRIVKEY="${LE_CERT_DIR}/privkey.pem"
LOCAL_CERT_DIR="${LOCAL_HTTPS_CERT_DIR:-/etc/nginx/local-certs}"
LOCAL_FULLCHAIN="${LOCAL_CERT_DIR}/fullchain.pem"
LOCAL_PRIVKEY="${LOCAL_CERT_DIR}/privkey.pem"

# Ensure tools present
if ! command -v openssl >/dev/null 2>&1 || ! command -v envsubst >/dev/null 2>&1; then
  apk add --no-cache openssl gettext >/dev/null
fi

mkdir -p "${LE_CERT_DIR}"
mkdir -p /var/www/certbot

# Prefer host-generated mkcert certs for local development when mounted.
if [ -s "${LOCAL_FULLCHAIN}" ] && [ -s "${LOCAL_PRIVKEY}" ]; then
  echo "Using local mkcert certificate from ${LOCAL_CERT_DIR}"
  SSL_CERTIFICATE="${LOCAL_FULLCHAIN}"
  SSL_CERTIFICATE_KEY="${LOCAL_PRIVKEY}"
else
  SSL_CERTIFICATE="${LE_FULLCHAIN}"
  SSL_CERTIFICATE_KEY="${LE_PRIVKEY}"
fi

# Generate a self-signed cert if none exists (useful for first boot/local).
if [ ! -s "${SSL_CERTIFICATE}" ] || [ ! -s "${SSL_CERTIFICATE_KEY}" ]; then
  echo "Generating self-signed certificate for ${DOMAIN}"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "${LE_PRIVKEY}" \
    -out "${LE_FULLCHAIN}" \
    -subj "/CN=${DOMAIN}" >/dev/null 2>&1
  SSL_CERTIFICATE="${LE_FULLCHAIN}"
  SSL_CERTIFICATE_KEY="${LE_PRIVKEY}"
fi

# Render nginx config from template with env vars
export DOMAIN SSL_PORT SSL_CERTIFICATE SSL_CERTIFICATE_KEY
envsubst '${DOMAIN} ${SSL_PORT} ${SSL_CERTIFICATE} ${SSL_CERTIFICATE_KEY}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

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
