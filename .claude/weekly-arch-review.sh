#!/usr/bin/env bash
# Runs the improve-codebase-architecture skill weekly via systemd timer.
# Output is logged to ~/.claude/logs/arch-review.log

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$HOME/.claude/logs"
LOG_FILE="$LOG_DIR/arch-review.log"

mkdir -p "$LOG_DIR"

echo "=== Architecture review started: $(date) ===" >> "$LOG_FILE"

cd "$REPO_ROOT"

claude \
  --print "/improve-codebase-architecture" \
  >> "$LOG_FILE" 2>&1

echo "=== Architecture review finished: $(date) ===" >> "$LOG_FILE"
