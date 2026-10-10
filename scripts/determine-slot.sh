#!/usr/bin/env bash
# ABOUTME: Classifies a daily-sync run as morning, midday, or evening based on which
# ABOUTME: cron schedule triggered it, so a late-starting run is still classified correctly.
set -euo pipefail

schedule="${1:-}"

case "$schedule" in
  "17 13 * * *")
    echo morning
    ;;
  "17 17 * * *")
    echo midday
    ;;
  "17 21 * * *")
    echo evening
    ;;
  *)
    echo "[determine-slot] Unrecognized schedule '${schedule}' (empty means workflow_dispatch) — falling back to morning" >&2
    echo morning
    ;;
esac
