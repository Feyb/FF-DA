#!/usr/bin/env bash
# Runs the improve-codebase-architecture skill weekly via cron.
# Output is logged to ~/.claude/logs/arch-review.log

set -euo pipefail

LOG_DIR="$HOME/.claude/logs"
LOG_FILE="$LOG_DIR/arch-review.log"

mkdir -p "$LOG_DIR"

echo "=== Architecture review started: $(date) ===" >> "$LOG_FILE"

cd /home/user/FF-DA

/opt/node22/bin/claude \
  --print "/improve-codebase-architecture" \
  >> "$LOG_FILE" 2>&1

echo "=== Architecture review finished: $(date) ===" >> "$LOG_FILE"
