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
  if command -v zip >/dev/null 2>&1; then
    zip -qr "$out" "${entries[@]}" -x '*/__pycache__/*' '*.pyc' '*.pyo' '.git/*' '.claude/*'
  else
    python3 - "$out" "${entries[@]}" <<'PY'
import os
import sys
import zipfile

out = sys.argv[1]
entries = sys.argv[2:]

def include(path: str) -> bool:
    parts = path.split(os.sep)
    if "__pycache__" in parts or ".git" in parts or ".claude" in parts:
        return False
    return not path.endswith((".pyc", ".pyo"))

with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for entry in entries:
        if os.path.isfile(entry):
            if include(entry):
                archive.write(entry, entry)
            continue
        for root, dirs, files in os.walk(entry):
            dirs[:] = [name for name in dirs if include(os.path.join(root, name))]
            for name in files:
                path = os.path.join(root, name)
                if include(path):
                    archive.write(path, path)
PY
  fi
)

python3 "$repo_root/scripts/validate_skill.py" "$skill_dir" --package "$out"
echo "Wrote $out"
