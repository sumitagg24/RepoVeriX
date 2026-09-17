#!/usr/bin/env bash
# RepoVeriX — VPS provisioning (Hetzner Cloud or DigitalOcean Ubuntu 24.04).
#
# Usage (after creating the droplet and pointing DNS A record api.<domain>
# at its IP):
#
#   REPOVERIX_VPS_HOST=203.0.113.10 \
#   REPOVERIX_VPS_USER=root \
#   REPOVERIX_VPS_KEY=~/.ssh/id_ed25519 \
#   bash scripts/provision-vps.sh
#
# The script:
#   1. installs Docker + firewall rules (idempotent),
#   2. copies .env (from .env.prod.example, filled in by you) to the server,
#   3. pulls the GHCR images and starts the stack (migrations run first),
#   4. smoke-tests /health over the public domain.
set -euo pipefail

: "${REPOVERIX_VPS_HOST:?set REPOVERIX_VPS_HOST}"
: "${REPOVERIX_VPS_USER:=root}"
: "${REPOVERIX_VPS_KEY:?set REPOVERIX_VPS_KEY}"

SSH_OPTS=(-i "$REPOVERIX_VPS_KEY" -o StrictHostKeyChecking=accept-new)
SSH_CMD=(ssh "${SSH_OPTS[@]}" "$REPOVERIX_VPS_USER@$REPOVERIX_VPS_HOST")

echo "==> [1/4] Installing Docker"
"${SSH_CMD[@]}" bash -s <<'REMOTE'
if command -v docker >/dev/null 2>&1; then
  echo "docker already present: $(docker --version)"
else
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 80/tcp  >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
yes | ufw enable >/dev/null 2>&1 || true
REMOTE

echo "==> [2/4] Syncing stack files"
rsync -avz -e "ssh ${SSH_OPTS[*]}" \
  docker-compose.vps.yml Caddyfile .env.prod.example \
  "$REPOVERIX_VPS_USER@$REPOVERIX_VPS_HOST:/opt/repoverix/"
if [[ ! -f .env ]]; then
  echo "!! No .env found — copy .env.prod.example to .env and fill it in."
  exit 1
fi
rsync -avz -e "ssh ${SSH_OPTS[*]}" .env "$REPOVERIX_VPS_USER@$REPOVERIX_VPS_HOST:/opt/repoverix/.env"

echo "==> [3/4] Starting stack"
"${SSH_CMD[@]}" "cd /opt/repoverix && docker compose -f docker-compose.vps.yml pull && \
  docker compose -f docker-compose.vps.yml up -d --remove-orphans && \
  docker compose -f docker-compose.vps.yml ps"

echo "==> [4/4] Smoke test (may need a minute for TLS issuance)"
for i in $(seq 1 12); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://$API_DOMAIN/health" || true)
  [[ "$code" == "200" ]] && { echo "API healthy (200)"; exit 0; }
  echo "  attempt $i: /health -> ${code:-unreachable}; retrying in 10s"
  sleep 10
done
echo "!! /health not reachable yet — check: docker compose -f docker-compose.vps.yml logs caddy backend"
exit 1
