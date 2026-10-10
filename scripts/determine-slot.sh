#!/usr/bin/env bash
# ABOUTME: Classifies a daily-sync run as morning, midday, evening, or manual based on which
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
  "")
    # workflow_dispatch has no schedule string
    echo manual
    ;;
  *)
    echo "[determine-slot] Unrecognized schedule '${schedule}' — falling back to morning" >&2
    echo morning
    ;;
esac
