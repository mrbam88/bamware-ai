#!/usr/bin/env bash
# One skill catalog, every machine.
#
# The only list of skills is bamware-ai/skills/ (first-party dirs plus
# symlinks into the vendored .agents/skills). This script makes ~/.claude/skills
# a mirror of that list and nothing else, so every laptop and the server show
# the same "/" menu. Idempotent; safe to run on every session start.
#
#   scripts/sync-skills.sh          # fix: link every catalog skill, archive strays
#   scripts/sync-skills.sh --check  # report only, exit 1 if anything is off
#   scripts/sync-skills.sh --list   # print the catalog (name and one-line purpose)
#
# Strays (anything in ~/.claude/skills that is not a link into the catalog) are
# moved to ~/.claude/skills-archive/<date>/, never deleted. Why: 2026-11-03 the
# Mac had 63 skills, the server 58, with different third-party sets installed
# by different sessions — "many different software factories" (Bilal).

set -u
MODE="${1:-fix}"
AI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CATALOG="$AI_DIR/skills"
DEST="$HOME/.claude/skills"
ARCHIVE="$HOME/.claude/skills-archive/$(date +%F)"

if [ "$MODE" = "--list" ]; then
  for d in "$CATALOG"/*/; do
    d="${d%/}"; [ -f "$d/SKILL.md" ] || continue
    desc="$(grep -m1 '^description:' "$d/SKILL.md" | sed 's/^description: *//; s/^"//; s/"$//' | cut -c1-90)"
    kind="own"; [ -L "$d" ] && kind="3rd"
    printf '%-4s %-40s %s\n' "$kind" "$(basename "$d")" "$desc"
  done
  exit 0
fi

mkdir -p "$DEST"
missing=(); strays=(); linked=0

# 1. every catalog skill must be a link in ~/.claude/skills
for d in "$CATALOG"/*/; do
  d="${d%/}"; [ -f "$d/SKILL.md" ] || continue
  name="$(basename "$d")"
  if [ "$(readlink "$DEST/$name" 2>/dev/null)" = "$d" ]; then
    linked=$((linked+1))
  else
    missing+=("$name")
  fi
done

# 2. anything else in ~/.claude/skills is a stray
for e in "$DEST"/*; do
  [ -e "$e" ] || [ -L "$e" ] || continue
  name="$(basename "$e")"
  target="$(readlink "$e" 2>/dev/null || true)"
  case "$target" in
    "$CATALOG"/*) ;;                # ours
    *) strays+=("$name") ;;
  esac
done

if [ "$MODE" = "--check" ]; then
  if [ ${#missing[@]} -eq 0 ] && [ ${#strays[@]} -eq 0 ]; then
    echo "skills: in sync ($linked linked)"; exit 0
  fi
  echo "skills: ${#missing[@]} not linked, ${#strays[@]} strays — run $AI_DIR/scripts/sync-skills.sh"
  exit 1
fi

for name in "${missing[@]}"; do
  if [ -e "$DEST/$name" ] || [ -L "$DEST/$name" ]; then
    mkdir -p "$ARCHIVE"; mv "$DEST/$name" "$ARCHIVE/$name"
  fi
  ln -sfn "$CATALOG/$name" "$DEST/$name"
  echo "  link    $name"
done
for name in "${strays[@]}"; do
  # a stray that is also a catalog name was handled above
  [ -L "$DEST/$name" ] && [ "$(readlink "$DEST/$name")" = "$CATALOG/$name" ] && continue
  mkdir -p "$ARCHIVE"; mv "$DEST/$name" "$ARCHIVE/$name"
  echo "  archive $name -> $ARCHIVE/"
done
total=$(find "$DEST" -maxdepth 1 -mindepth 1 | wc -l | tr -d ' ')
echo "skills: $total linked from $CATALOG; ${#missing[@]} fixed, ${#strays[@]} archived"
