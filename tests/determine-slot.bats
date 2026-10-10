#!/usr/bin/env bats
# ABOUTME: Tests scripts/determine-slot.sh, which classifies a daily-sync run
# ABOUTME: as morning, midday, or evening based on the triggering cron schedule string.

bats_require_minimum_version 1.5.0

setup() {
  SCRIPT="$BATS_TEST_DIRNAME/../scripts/determine-slot.sh"
}

@test "morning cron schedule resolves to morning" {
  run "$SCRIPT" "17 13 * * *"
  [ "$status" -eq 0 ]
  [ "$output" = "morning" ]
}

@test "midday cron schedule resolves to midday" {
  run "$SCRIPT" "17 17 * * *"
  [ "$status" -eq 0 ]
  [ "$output" = "midday" ]
}

@test "evening cron schedule resolves to evening" {
  run "$SCRIPT" "17 21 * * *"
  [ "$status" -eq 0 ]
  [ "$output" = "evening" ]
}

@test "empty schedule (workflow_dispatch) falls back to morning" {
  run --separate-stderr "$SCRIPT" ""
  [ "$status" -eq 0 ]
  [ "$output" = "morning" ]
}

@test "missing argument (schedule unset) falls back to morning" {
  run --separate-stderr "$SCRIPT"
  [ "$status" -eq 0 ]
  [ "$output" = "morning" ]
}

@test "unrecognized schedule string falls back to morning" {
  run --separate-stderr "$SCRIPT" "0 0 * * *"
  [ "$status" -eq 0 ]
  [ "$output" = "morning" ]
}

@test "does not read wall-clock time" {
  run grep -o 'date' "$SCRIPT"
  [ "$status" -eq 1 ]
}
