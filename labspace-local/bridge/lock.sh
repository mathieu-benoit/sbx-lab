#!/usr/bin/env bash
# Writes release.lock from a published bridge release: its tag, and the checksums of its binaries,
# which start.sh and start.ps1 check every download against.
#   labspace-local/bridge/lock.sh <tag> [<owner/repo>]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tag="${1:?usage: lock.sh <tag> [<owner/repo>]}"
repo="${2:-$(awk '$1 == "repo" { print $2 }' "$here/release.lock")}"
sums="$(curl -fsSL "https://github.com/$repo/releases/download/$tag/SHA256SUMS")"
[ "$(grep -c labspace-bridge- <<<"$sums")" -eq 6 ] || { echo "SHA256SUMS of $tag doesn't list the 6 binaries" >&2; exit 1; }
{
  sed -n '/^#/p' "$here/release.lock"
  echo "repo $repo"
  echo "version $tag"
  echo "$sums"
} > "$here/release.lock.new"
mv "$here/release.lock.new" "$here/release.lock"
cat "$here/release.lock"
