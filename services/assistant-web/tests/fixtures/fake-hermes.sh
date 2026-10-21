#!/usr/bin/env bash
# Stand-in for the Hermes CLI that mimics the quiet single-query contract
# (stdout = reply, stderr ends with "session_id: <id>"). Used by the test
# suite only; the real integration run uses the installed `hermes`.
set -u
cmd="${1:-}"
case "$cmd" in
  chat)
    query=""; resume=""
    shift
    while [ $# -gt 0 ]; do
      case "$1" in
        -q) query="$2"; shift 2 ;;
        --resume) resume="$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    sid="${resume:-20260101_000000_abcdef}"
    if [ -n "$resume" ]; then echo "↻ Resumed session $sid (1 user message, 2 total messages)" >&2; fi
    if [ "$query" = "FAIL" ]; then
      echo "Error: simulated provider failure" >&2
      printf '\nsession_id: %s\n' "$sid" >&2
      exit 1
    fi
    if [ "$query" = "SLOW" ]; then sleep 5; fi
    echo "echo: $query"
    printf '\nsession_id: %s\n' "$sid" >&2
    exit 0
    ;;
  sessions)
    sub="${2:-}"
    if [ "$sub" = "export" ]; then printf '{"role":"user","content":"hi"}\n{"role":"assistant","content":"echo: hi"}\n'; exit 0; fi
    if [ "$sub" = "delete" ]; then echo "deleted"; exit 0; fi
    exit 2
    ;;
  *) echo "fake-hermes: unknown command $cmd" >&2; exit 2 ;;
esac
