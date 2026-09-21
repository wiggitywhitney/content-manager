#!/usr/bin/env bash
# ABOUTME: Sends a Slack notification for one of dot-agent-deck's four orchestration events.
# ABOUTME: Reads the webhook URL from GSM via vals at send time; never logs, echoes, or holds the URL elsewhere.

EVENT="${1:-}"

case "$EVENT" in
  escalation) TEXT=":vertical_traffic_light: dot-agent-deck: test-plan ready for approval" ;;
  merge-gate) TEXT=":vertical_traffic_light: dot-agent-deck: merge ready for confirmation" ;;
  run-finished) TEXT=":white_check_mark: dot-agent-deck: run finished" ;;
  worker-stuck) TEXT=":warning: dot-agent-deck: a worker role appears stuck" ;;
  *)
    echo "notify-slack: unknown event '$EVENT' (expected escalation|merge-gate|run-finished|worker-stuck)" >&2
    exit 0
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

STATUS=$(vals exec -f "$SCRIPT_DIR/../.vals.yaml" -- bash -c '
  curl -s -o /dev/null -w "%{http_code}" \
    --connect-timeout 5 --max-time 10 \
    -X POST -H "Content-Type: application/json" \
    -d "{\"text\":\"$1\"}" \
    "$SLACK_WEBHOOK_URL"
' _ "$TEXT" 2>/dev/null)

if [[ "$STATUS" != 2* ]]; then
  echo "notify-slack: $EVENT send failed or timed out (status: ${STATUS:-none})" >&2
fi

exit 0
