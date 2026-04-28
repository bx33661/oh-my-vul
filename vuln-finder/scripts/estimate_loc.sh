#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: scripts/estimate_loc.sh <github-url-or-local-path>" >&2
  exit 2
fi

target="$1"
workdir=""

cleanup() {
  if [[ -n "$workdir" && -d "$workdir" ]]; then
    rm -rf "$workdir"
  fi
}
trap cleanup EXIT

if [[ "$target" =~ ^https?:// ]] || [[ "$target" =~ ^git@ ]]; then
  workdir="$(mktemp -d)"
  git clone --depth 1 --quiet "$target" "$workdir/repo"
  scan_dir="$workdir/repo"
else
  scan_dir="$target"
fi

if [[ ! -d "$scan_dir" ]]; then
  echo "not a directory: $scan_dir" >&2
  exit 1
fi

if command -v tokei >/dev/null 2>&1; then
  tokei "$scan_dir"
  exit 0
fi

if command -v cloc >/dev/null 2>&1; then
  cloc "$scan_dir"
  exit 0
fi

find "$scan_dir" \
  -type d \( -name .git -o -name node_modules -o -name vendor -o -name target -o -name dist -o -name build \) -prune -o \
  -type f \( \
    -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' -o \
    -name '*.py' -o -name '*.go' -o -name '*.rs' -o -name '*.java' -o \
    -name '*.rb' -o -name '*.php' -o -name '*.cs' -o -name '*.swift' -o \
    -name '*.dart' -o -name '*.ex' -o -name '*.exs' -o -name '*.pl' -o \
    -name '*.pm' -o -name '*.r' -o -name '*.R' -o -name '*.lua' \
  \) -print0 | xargs -0 wc -l | tail -1
