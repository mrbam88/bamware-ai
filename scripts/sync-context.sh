#!/usr/bin/env bash

set -u

SCRIPT_DIR="$(cd "${BASH_SOURCE[0]%/*}" && pwd)"
BAMWARE_AI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INTERVIEWS_DIR="$BAMWARE_AI_DIR/../interviews"

check_repo() {
  local name="$1"
  local repo="$2"

  if ! git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    printf 'error: %s is not a git repository: %s\n' "$name" "$repo" >&2
    return 1
  fi
}

check_clean() {
  local name="$1"
  local repo="$2"
  local changes

  changes="$(git -C "$repo" status --porcelain)"
  if [[ -n "$changes" ]]; then
    printf 'error: %s has uncommitted changes:\n%s\n' "$name" "$changes" >&2
    return 1
  fi
}

failed=0
check_repo "bamware-ai" "$BAMWARE_AI_DIR" || failed=1
check_repo "interviews" "$INTERVIEWS_DIR" || failed=1
if ((failed)); then
  exit 1
fi

check_clean "bamware-ai" "$BAMWARE_AI_DIR" || failed=1
check_clean "interviews" "$INTERVIEWS_DIR" || failed=1
if ((failed)); then
  exit 1
fi

if ! git -C "$BAMWARE_AI_DIR" fetch origin; then
  printf 'error: failed to fetch bamware-ai\n' >&2
  exit 1
fi
if ! git -C "$INTERVIEWS_DIR" fetch origin; then
  printf 'error: failed to fetch interviews\n' >&2
  exit 1
fi

bamware_behind="$(git -C "$BAMWARE_AI_DIR" rev-list --count HEAD..origin/main)"
interviews_behind="$(git -C "$INTERVIEWS_DIR" rev-list --count HEAD..origin/main)"

if ! git -C "$BAMWARE_AI_DIR" merge-base --is-ancestor HEAD origin/main &&
  ! git -C "$BAMWARE_AI_DIR" merge-base --is-ancestor origin/main HEAD; then
  printf 'error: bamware-ai cannot fast-forward to origin/main\n' >&2
  failed=1
fi
if ! git -C "$INTERVIEWS_DIR" merge-base --is-ancestor HEAD origin/main &&
  ! git -C "$INTERVIEWS_DIR" merge-base --is-ancestor origin/main HEAD; then
  printf 'error: interviews cannot fast-forward to origin/main\n' >&2
  failed=1
fi
if ((failed)); then
  exit 1
fi

if ! git -C "$BAMWARE_AI_DIR" merge --ff-only origin/main; then
  printf 'error: failed to fast-forward bamware-ai\n' >&2
  exit 1
fi
if ! git -C "$INTERVIEWS_DIR" merge --ff-only origin/main; then
  printf 'error: failed to fast-forward interviews\n' >&2
  exit 1
fi

bamware_head="$(git -C "$BAMWARE_AI_DIR" rev-parse --short HEAD)"
interviews_head="$(git -C "$INTERVIEWS_DIR" rev-parse --short HEAD)"
printf 'bamware-ai: HEAD %s, was %s commit(s) behind origin/main\n' "$bamware_head" "$bamware_behind"
printf 'interviews: HEAD %s, was %s commit(s) behind origin/main\n' "$interviews_head" "$interviews_behind"

if ! read -r marker_timestamp marker_sha < "$BAMWARE_AI_DIR/CONTEXT_VERSION"; then
  printf 'warning: could not read CONTEXT_VERSION\n' >&2
elif [[ "$bamware_head" != "$marker_sha" ]]; then
  printf 'warning: bamware-ai HEAD %s differs from CONTEXT_VERSION %s; CI may not have stamped the newest commit yet\n' \
    "$bamware_head" "$marker_sha" >&2
fi
