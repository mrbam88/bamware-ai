#!/usr/bin/env bash
# Night queue — list open `night`-labelled issues across active repos,
# ordered by the board's Priority field when that's cheaply obtainable.
#
# Used by the night-supervisor skill (skills/night-supervisor/SKILL.md) to
# pick the overnight work order. Needs only `gh` (authenticated) and `jq`.
#
# Usage:
#   scripts/night-queue.sh          # human-readable: repo#N  P?  title  url
#   scripts/night-queue.sh --json   # raw JSON array, same fields + priority

set -uo pipefail

OWNER="mrbam88"
REPOS=(
  bamware-brewdesk
  bamware-brewdesk-flutter
  bamware-venue-engine
  bamware-infra
  bamware-ai
  bamware-web
  bamware-dating-app
  bamware-dating-service
  bamware-mcp
)
PROJECT_NUMBER=2

JSON_OUT=0
if [ "${1:-}" = "--json" ]; then
  JSON_OUT=1
fi

for bin in gh jq; do
  command -v "$bin" >/dev/null 2>&1 || { echo "night-queue: '$bin' not on PATH" >&2; exit 1; }
done

# --- 1. collect open `night` issues from every repo, in repo-list order ---
# Each repo's issues get a `.repo` and a stable `.seq` (fallback ordering)
# stamped on before we merge everything into one array.
TICKETS_JSON="[]"
seq=0
for repo in "${REPOS[@]}"; do
  page="$(gh issue list --label night -R "$OWNER/$repo" \
    --json number,title,url,labels 2>/dev/null)"
  [ -z "$page" ] && page="[]"
  page="$(printf '%s' "$page" | jq --arg repo "$repo" --argjson start "$seq" \
    'to_entries | map(.value + {repo: $repo, seq: ($start + .key)})')"
  seq=$((seq + $(printf '%s' "$page" | jq 'length')))
  TICKETS_JSON="$(jq -n --argjson a "$TICKETS_JSON" --argjson b "$page" '$a + $b')"
done

# --- 2. best-effort priority join from the board -----------------------
# `gh project item-list` is a single call across all repos on the project.
# If it fails, is empty, or jq chokes on it, every ticket just falls back
# to "?" and keeps repo-list order (still correct, just unprioritized).
PRIORITY_MAP="{}"
PROJECT_JSON="$(gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" \
  --format json --limit 500 2>/dev/null)"
if [ -n "$PROJECT_JSON" ]; then
  PRIORITY_MAP="$(printf '%s' "$PROJECT_JSON" | jq \
    '[.items[]? | select(.content.url != null) | {(.content.url): (.priority // "")}] | add // {}' \
    2>/dev/null || echo '{}')"
  [ -z "$PRIORITY_MAP" ] && PRIORITY_MAP="{}"
fi

# --- 3. join + sort: P0 < P1 < P2 < unknown, ties keep repo-list order --
RESULT="$(jq -n --argjson tickets "$TICKETS_JSON" --argjson pmap "$PRIORITY_MAP" '
  def rank(p):
    if   (p | startswith("P0")) then 0
    elif (p | startswith("P1")) then 1
    elif (p | startswith("P2")) then 2
    else 9 end;
  $tickets
  | map(
      . as $t
      | ($pmap[$t.url] // "") as $prio
      | $t + {
          priority: (if $prio == "" then "?" else ($prio | .[0:2]) end),
          _rank: rank($prio)
        }
    )
  | sort_by([._rank, .seq])
  | map(del(._rank, .seq))
')"

if [ "$JSON_OUT" = 1 ]; then
  printf '%s\n' "$RESULT"
  exit 0
fi

COUNT="$(printf '%s' "$RESULT" | jq 'length')"
if [ "$COUNT" -eq 0 ]; then
  echo "night-queue: no open 'night' tickets across ${#REPOS[@]} repos (owner $OWNER)."
  exit 0
fi

printf '%s' "$RESULT" | jq -r '.[] | "\(.repo)#\(.number)  \(.priority)  \(.title)  \(.url)"'
