#!/usr/bin/env bash
# ABOUTME: Classifies a daily-sync run as morning or evening based on which
# ABOUTME: cron schedule triggered it, so a late-starting run is still classified correctly.
set -euo pipefail

schedule="${1:-}"

case "$schedule" in
  "0 13 * * *")
    echo true
    ;;
  "0 21 * * *")
    echo false
    ;;
  *)
    echo "[determine-slot] Unrecognized schedule '${schedule}' (empty means workflow_dispatch) — falling back to morning" >&2
    echo true
    ;;
esac
