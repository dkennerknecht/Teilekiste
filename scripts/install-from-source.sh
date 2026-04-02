#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/dkennerknecht/Teilekiste.git}"
GIT_REF="${GIT_REF:-main}"
INSTALL_DIR="${INSTALL_DIR:-/opt/teilekiste}"
APP_PORT="${APP_PORT:-3000}"
APP_USER="${APP_USER:-teilekiste}"
PUBLIC_URL="${PUBLIC_URL:-}"
NEXTAUTH_SECRET_VALUE="${NEXTAUTH_SECRET_VALUE:-}"
RUN_SEED_ON_STARTUP_VALUE="${RUN_SEED_ON_STARTUP_VALUE:-0}"
BOOTSTRAP_SYSTEM="${BOOTSTRAP_SYSTEM:-1}"
PUBLIC_URL_EXPLICIT=0

usage() {
  cat <<'EOF'
Install Teilekiste from source on a fresh Debian/Ubuntu-style server.

Usage:
  bash scripts/install-from-source.sh [options]

Options:
  --repo URL                Git repository URL
  --ref REF                 Git ref to install, e.g. main or v2.3.0
  --install-dir PATH        Target directory, default: /opt/teilekiste
  --app-user USER           Dedicated host user when run as root, default: teilekiste
  --public-url URL          Public app URL override, default: auto-detect
  --port PORT               Exposed app port, default: 3000
  --nextauth-secret SECRET  Explicit NEXTAUTH_SECRET value
  --seed                    Enable demo seed on startup
  --no-bootstrap            Skip bootstrap:system after startup
  --help                    Show this help

Examples:
  bash scripts/install-from-source.sh
  sudo bash scripts/install-from-source.sh
  bash scripts/install-from-source.sh --ref v2.3.0 --public-url https://inventar.example.com
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_URL="$2"
      shift 2
      ;;
    --ref)
      GIT_REF="$2"
      shift 2
      ;;
    --install-dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --app-user)
      APP_USER="$2"
      shift 2
      ;;
    --public-url)
      PUBLIC_URL="$2"
      PUBLIC_URL_EXPLICIT=1
      shift 2
      ;;
    --port)
      APP_PORT="$2"
      shift 2
      ;;
    --nextauth-secret)
      NEXTAUTH_SECRET_VALUE="$2"
      shift 2
      ;;
    --seed)
      RUN_SEED_ON_STARTUP_VALUE="1"
      shift
      ;;
    --no-bootstrap)
      BOOTSTRAP_SYSTEM="0"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! [[ "$APP_PORT" =~ ^[0-9]+$ ]]; then
  echo "Invalid port: $APP_PORT" >&2
  exit 1
fi

detect_public_url() {
  local detected_host
  detected_host="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [[ -z "$detected_host" ]]; then
    detected_host="$(hostname 2>/dev/null || true)"
  fi
  if [[ -z "$detected_host" ]]; then
    detected_host="localhost"
  fi
  printf 'http://%s:%s\n' "$detected_host" "$APP_PORT"
}

if [[ -z "$PUBLIC_URL" ]]; then
  PUBLIC_URL="$(detect_public_url)"
fi

if [[ "$PUBLIC_URL_EXPLICIT" != "1" && -t 0 && -t 1 ]]; then
  echo "Detected public URL: $PUBLIC_URL"
  read -r -p "Use detected URL? [Y/n/custom] " public_url_answer || true
  case "${public_url_answer:-y}" in
    n|N)
      read -r -p "Enter public URL: " custom_public_url
      if [[ -n "${custom_public_url:-}" ]]; then
        PUBLIC_URL="$custom_public_url"
      fi
      ;;
    y|Y|"")
      ;;
    *)
      PUBLIC_URL="$public_url_answer"
      ;;
  esac
fi

if [[ -z "$NEXTAUTH_SECRET_VALUE" ]]; then
  NEXTAUTH_SECRET_VALUE="$(openssl rand -base64 32 | tr -d '\n')"
fi

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=""
  RUN_AS_USER="$APP_USER"
else
  if ! command -v sudo >/dev/null 2>&1; then
    echo "sudo is required when not running as root." >&2
    exit 1
  fi
  SUDO="sudo"
  RUN_AS_USER="$(id -un)"
fi

run_root() {
  if [[ -n "$SUDO" ]]; then
    sudo "$@"
  else
    "$@"
  fi
}

run_docker() {
  if [[ -n "$SUDO" ]]; then
    sudo docker "$@"
  else
    docker "$@"
  fi
}

run_compose() {
  if [[ -n "$SUDO" ]]; then
    sudo docker compose "$@"
  else
    docker compose "$@"
  fi
}

run_owner() {
  if [[ "$(id -u)" -eq 0 && "$RUN_AS_USER" != "root" ]]; then
    runuser -u "$RUN_AS_USER" -- "$@"
  else
    "$@"
  fi
}

set_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  local escaped_value
  escaped_value="${value//\\/\\\\}"
  escaped_value="${escaped_value//&/\\&}"
  escaped_value="${escaped_value//|/\\|}"

  if grep -q "^${key}=" "$file"; then
    sed -i.bak "s|^${key}=.*|${key}=${escaped_value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

echo "Installing system dependencies..."
run_root apt-get update -y
run_root apt-get install -y ca-certificates curl git openssl

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | run_root sh
fi

run_root systemctl enable docker
run_root systemctl start docker

if ! run_docker compose version >/dev/null 2>&1; then
  echo "docker compose is not available after Docker installation." >&2
  exit 1
fi

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Preparing dedicated host user: $APP_USER"
  if ! getent group "$APP_USER" >/dev/null 2>&1; then
    run_root groupadd --system "$APP_USER"
  fi
  if ! id -u "$APP_USER" >/dev/null 2>&1; then
    run_root useradd --system --create-home --home-dir "/home/$APP_USER" --shell /bin/bash --gid "$APP_USER" "$APP_USER"
  fi
  if getent group docker >/dev/null 2>&1; then
    run_root usermod -aG docker "$APP_USER"
  fi
fi

OWNER_UID="$(id -u "$RUN_AS_USER")"
OWNER_GID="$(id -g "$RUN_AS_USER")"

echo "Preparing install directory at $INSTALL_DIR..."
run_root mkdir -p "$INSTALL_DIR"
run_root chown -R "$OWNER_UID:$OWNER_GID" "$INSTALL_DIR"

if [[ -d "$INSTALL_DIR/.git" ]]; then
  echo "Updating existing checkout..."
  run_owner git -C "$INSTALL_DIR" fetch --tags origin
else
  if [[ -n "$(find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
    echo "Existing non-git directory found, initializing repository in place..."
    run_owner git -C "$INSTALL_DIR" init
    if run_owner git -C "$INSTALL_DIR" remote get-url origin >/dev/null 2>&1; then
      run_owner git -C "$INSTALL_DIR" remote set-url origin "$REPO_URL"
    else
      run_owner git -C "$INSTALL_DIR" remote add origin "$REPO_URL"
    fi
  else
    echo "Cloning repository..."
    run_owner git clone "$REPO_URL" "$INSTALL_DIR"
  fi
  run_owner git -C "$INSTALL_DIR" fetch --tags origin
fi

echo "Checking out $GIT_REF..."
run_owner git -C "$INSTALL_DIR" checkout "$GIT_REF"
if run_owner git -C "$INSTALL_DIR" show-ref --verify --quiet "refs/remotes/origin/$GIT_REF"; then
  run_owner git -C "$INSTALL_DIR" reset --hard "origin/$GIT_REF"
else
  run_owner git -C "$INSTALL_DIR" reset --hard "$GIT_REF"
fi

cd "$INSTALL_DIR"

run_root mkdir -p "$INSTALL_DIR/data"
run_root chown -R "$OWNER_UID:$OWNER_GID" "$INSTALL_DIR"

if [[ ! -f ".env" ]]; then
  run_owner cp .env.example .env
fi

set_env_value ".env" "APP_BASE_URL" "$PUBLIC_URL"
set_env_value ".env" "NEXTAUTH_URL" "$PUBLIC_URL"
set_env_value ".env" "NEXTAUTH_URL_INTERNAL" "http://127.0.0.1:${APP_PORT}"
set_env_value ".env" "AUTH_TRUST_HOST" "true"
set_env_value ".env" "HOST_PORT" "$APP_PORT"
set_env_value ".env" "NEXTAUTH_SECRET" "$NEXTAUTH_SECRET_VALUE"
set_env_value ".env" "RUN_SEED_ON_STARTUP" "$RUN_SEED_ON_STARTUP_VALUE"
run_root rm -f .env.bak
run_root chown "$OWNER_UID:$OWNER_GID" .env

echo "Building and starting containers from source..."
run_compose up -d --build

echo "Waiting for app startup..."
echo "Using public URL fallback: $PUBLIC_URL"
for _ in $(seq 1 60); do
  if curl -fsS "${PUBLIC_URL}/api/runtime-version" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if [[ "$RUN_SEED_ON_STARTUP_VALUE" == "1" ]]; then
  echo "Seed mode enabled, skipping explicit bootstrap."
elif [[ "$BOOTSTRAP_SYSTEM" == "1" ]]; then
  echo "Running bootstrap:system..."
  run_docker exec teilekiste npm run bootstrap:system
fi

cat <<EOF

Teilekiste installed from source.

Source ref:   $GIT_REF
Install dir:  $INSTALL_DIR
Host user:    $RUN_AS_USER
Public URL:   $PUBLIC_URL

Default login after bootstrap:
  admin@local
  admin123

Useful update command:
  cd $INSTALL_DIR && git fetch --tags origin && git checkout $GIT_REF && git reset --hard ${GIT_REF} && docker compose up -d --build
EOF
