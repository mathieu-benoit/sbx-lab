#!/usr/bin/env bash
# Starts the lab as a Labspace whose terminal runs on this machine:
#   - the bridge (bridge/) on http://localhost:8085, natively, with your shell
#   - the Labspace interface in a container on http://localhost:3030
# Ctrl-C stops both. Needs Docker only: the bridge is a binary downloaded from the repository's
# releases, and checked against bridge/release.lock (or, without a release, built in a container). On Windows without Git Bash, use start.ps1.
#
# Running it again while the Labspace runs is safe: it reuses the running bridge, makes sure the
# interface is up, opens the browser and returns.
#
# Environment: LABSPACE_BRIDGE (a bridge binary to use instead, e.g. one you built),
# LABSPACE_NO_OPEN (don't open the browser), LABSPACE_INTERFACE_IMAGE, BRIDGE_PORT.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
export BRIDGE_PORT="${BRIDGE_PORT:-8085}"
url="http://localhost:3030"
export LABSPACE_INTERFACE_IMAGE="${LABSPACE_INTERFACE_IMAGE:-dockersamples/labspace-interface:latest}"
compose=(docker compose -f "$here/compose.yaml")
# The image that builds the bridge when bridge/release.lock names no release
go_image="golang:1.25-alpine"

command -v docker >/dev/null || { echo "Docker is required for the Labspace interface." >&2; exit 1; }

# The token the interface sends to the bridge with every Run and Save. It is kept in a file
# (readable by you only), so that the bridge and the interface of every start agree on it.
token_file="$here/.token"
if [ ! -s "$token_file" ]; then
  (umask 077 && od -An -tx1 -N24 /dev/urandom | tr -d ' \n' > "$token_file")
fi
LABSPACE_TOKEN="$(tr -d ' \r\n' < "$token_file")"
export LABSPACE_TOKEN

# On Linux, the content containers write .content and .ui as you
if [ "$(uname -s)" = Linux ]; then
  LABSPACE_USER="$(id -u):$(id -g)"
  export LABSPACE_USER
fi
# Created here, so that Docker doesn't create them (as root, and index.html as a folder)
mkdir -p "$here/.content" "$here/.ui"
[ -e "$here/.ui/index.html" ] || : > "$here/.ui/index.html"

open_browser() {
  if [ -n "${LABSPACE_NO_OPEN:-}" ]; then :
  elif command -v open >/dev/null; then open "$url"
  elif command -v xdg-open >/dev/null; then xdg-open "$url" >/dev/null 2>&1
  elif command -v cmd.exe >/dev/null; then cmd.exe //c start "" "$url" # Windows (Git Bash)
  fi
}

# Already running? Then the bridge answers its health check: keep it and its shells, make sure the
# interface is up (Compose leaves it alone when nothing changed), and leave the running start in
# charge of stopping everything.
if curl -fsS --max-time 2 "http://127.0.0.1:$BRIDGE_PORT/healthz" -H "Host: localhost:$BRIDGE_PORT" >/dev/null 2>&1; then
  "${compose[@]}" up -d --pull missing --wait interface content
  echo
  echo "Labspace already running: $url"
  echo "Stop it with Ctrl-C where it was started."
  open_browser
  exit 0
fi
if (exec 3<>"/dev/tcp/127.0.0.1/$BRIDGE_PORT") 2>/dev/null; then
  echo "Port $BRIDGE_PORT is used by another program: stop it, or start with BRIDGE_PORT set to a free port." >&2
  exit 1
fi

# ---------------------------------------------------------------- the bridge binary

sha256() {
  if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

bridge_binary() {
  if [ -n "${LABSPACE_BRIDGE:-}" ]; then
    echo "$LABSPACE_BRIDGE"
    return
  fi
  local os arch ext="" name repo version expected bin
  case "$(uname -s)" in
    Darwin) os=darwin ;;
    Linux) os=linux ;;
    MINGW* | MSYS* | CYGWIN*) os=windows ext=.exe ;;
    *) echo "No bridge for $(uname -s)." >&2; return 1 ;;
  esac
  case "$(uname -m)" in
    x86_64 | amd64) arch=amd64 ;;
    arm64 | aarch64) arch=arm64 ;;
    *) echo "No bridge for $(uname -m)." >&2; return 1 ;;
  esac
  name="labspace-bridge-$os-$arch$ext"
  repo="$(awk '$1 == "repo" { print $2 }' "$here/bridge/release.lock")"
  version="$(awk '$1 == "version" { print $2 }' "$here/bridge/release.lock")"
  expected="$(awk -v n="$name" '$2 == n { print $1 }' "$here/bridge/release.lock")"

  if [ -z "$version" ]; then
    # No release yet: build it from source, in the Go image (Go isn't needed on your machine).
    # The Go caches are kept in a volume, so later builds take seconds.
    echo "Building the bridge..." >&2
    mkdir -p "$here/.bin"
    # Host paths as Windows paths in Git Bash, and no conversion of the container paths
    local src out
    src="$(cd "$here/bridge" && { pwd -W 2>/dev/null || pwd; })"
    out="$(cd "$here/.bin" && { pwd -W 2>/dev/null || pwd; })"
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*" docker run --rm \
      -v "$src:/src" -v "$out:/out" -v labspace-bridge-go-cache:/cache -w /src \
      -e GOCACHE=/cache/build -e GOMODCACHE=/cache/mod -e CGO_ENABLED=0 -e TARGET="$os/$arch" \
      -e OWNER="$(id -u):$(id -g)" -e BIN="labspace-bridge-dev$ext" \
      "$go_image" sh -c 'go generate ./... &&
        GOOS="${TARGET%/*}" GOARCH="${TARGET#*/}" go build -trimpath -o "/out/$BIN" . &&
        chown -R "$OWNER" "/out/$BIN" public/vendor' >&2
    echo "$here/.bin/labspace-bridge-dev$ext"
    return
  fi
  [ -n "$expected" ] || { echo "bridge/release.lock has no checksum for $name." >&2; return 1; }

  bin="$here/.bin/$version/$name"
  if [ ! -x "$bin" ] || [ "$(sha256 "$bin")" != "$expected" ]; then
    echo "Downloading the bridge $version ($name)..." >&2
    mkdir -p "$(dirname "$bin")"
    curl -fsSL --retry 2 -o "$bin.part" "https://github.com/$repo/releases/download/$version/$name"
    if [ "$(sha256 "$bin.part")" != "$expected" ]; then
      rm -f "$bin.part"
      echo "The downloaded bridge doesn't match its checksum in bridge/release.lock: not using it." >&2
      return 1
    fi
    chmod +x "$bin.part"
    mv -f "$bin.part" "$bin"
  fi
  echo "$bin"
}

bridge="$(bridge_binary)"

cleanup() {
  trap - EXIT INT TERM
  echo
  echo "Stopping..."
  "${compose[@]}" down --remove-orphans >/dev/null 2>&1 || true
  [ -n "${bridge_pid:-}" ] && kill "$bridge_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# The shells start in the root of the repository
# (as a Windows path in Git Bash, for the Windows binary)
LABSPACE_WORKSPACE="${LABSPACE_WORKSPACE:-$(cd "$here/.." && { pwd -W 2>/dev/null || pwd; })}" "$bridge" &
bridge_pid=$!

"${compose[@]}" up -d --pull missing --wait interface content

echo
echo "Labspace ready: $url"
echo "The right panel is a terminal on this machine. Ctrl-C to stop."
open_browser

wait "$bridge_pid"
