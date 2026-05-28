#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

: "${SSH_IP:?SSH_IP is required}"
: "${SSH_USER:=base-ubuntu}"
: "${DATABASE_URL:?DATABASE_URL is required}"

REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/${SSH_USER}/messenger-gpt}"
REMOTE_REPO="${REMOTE_REPO:-https://github.com/Asagiry/messenger-gpt.git}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-http://gpt-messenger.voimaxgm.online}"
JWT_SECRET="${JWT_SECRET:-gpt-messenger-production-secret-change-me}"

ssh -o StrictHostKeyChecking=no -i "$ROOT_DIR/id_ed25519" "${SSH_USER}@${SSH_IP}" bash -s -- "$REMOTE_APP_DIR" "$REMOTE_REPO" "$DATABASE_URL" "$PUBLIC_ORIGIN" "$JWT_SECRET" <<'REMOTE'
set -euo pipefail

APP_DIR="$1"
REPO="$2"
DATABASE_URL="$3"
PUBLIC_ORIGIN="$4"
JWT_SECRET="$5"

if [ ! -d "$APP_DIR/.git" ]; then
  rm -rf "$APP_DIR"
  git clone "$REPO" "$APP_DIR"
fi

cd "$APP_DIR"
git fetch origin main
git reset --hard origin/main

cat > .env <<ENV
DATABASE_URL=${DATABASE_URL}
PUBLIC_ORIGIN=${PUBLIC_ORIGIN}
JWT_SECRET=${JWT_SECRET}
PORT=80
ENV

npm ci
npm run db:migrate
npm run db:seed
npm run build

sudo env \
  PATH="$PATH" \
  DATABASE_URL="$DATABASE_URL" \
  PUBLIC_ORIGIN="$PUBLIC_ORIGIN" \
  JWT_SECRET="$JWT_SECRET" \
  PORT=80 \
  pm2 delete gpt-messenger >/dev/null 2>&1 || true

sudo env \
  PATH="$PATH" \
  DATABASE_URL="$DATABASE_URL" \
  PUBLIC_ORIGIN="$PUBLIC_ORIGIN" \
  JWT_SECRET="$JWT_SECRET" \
  PORT=80 \
  pm2 start npm --name gpt-messenger -- start

sudo pm2 save
sudo pm2 startup systemd -u root --hp /root >/dev/null
sudo pm2 status gpt-messenger
REMOTE
