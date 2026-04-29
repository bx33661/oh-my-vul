#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <skill-dir> [output.skill]" >&2
  exit 2
fi

skill_dir="$1"
if [[ "$skill_dir" != /* ]]; then
  skill_dir="$repo_root/$skill_dir"
fi
skill_dir="$(cd "$skill_dir" && pwd)"
skill_name="$(basename "$skill_dir")"
out="${2:-"$repo_root/$skill_name.skill"}"

if [[ ! -f "$skill_dir/SKILL.md" ]]; then
  echo "Missing SKILL.md in $skill_dir" >&2
  exit 1
fi

rm -f "$out"

entries=(SKILL.md)
for dirname in references scripts evals contracts; do
  if [[ -d "$skill_dir/$dirname" ]]; then
    entries+=("$dirname")
  fi
done

(
  cd "$skill_dir"
  zip -qr "$out" "${entries[@]}" -x '*/__pycache__/*' '*.pyc' '*.pyo' '.git/*' '.claude/*' '.codex/*'
)

python3 "$repo_root/scripts/validate_skill.py" "$skill_dir" --package "$out"
echo "Wrote $out"
