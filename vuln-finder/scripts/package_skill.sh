#!/usr/bin/env bash
set -euo pipefail

skill_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${1:-"$skill_dir/../vuln-finder.skill"}"

rm -f "$out"

(
  cd "$skill_dir"
  zip -qr "$out" SKILL.md references scripts evals -x '*/__pycache__/*' '*.pyc' '*.pyo'
)

python3 "$skill_dir/scripts/validate_skill.py" --package "$out"
echo "Wrote $out"
