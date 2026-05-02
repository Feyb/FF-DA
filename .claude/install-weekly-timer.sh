#!/usr/bin/env bash
# Installs the weekly arch-review systemd user timer for this checkout.
# Run once after cloning; safe to re-run.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_SYSTEMD="$HOME/.config/systemd/user"

mkdir -p "$USER_SYSTEMD"

cat > "$USER_SYSTEMD/arch-review.service" << EOF
[Unit]
Description=Weekly improve-codebase-architecture skill run

[Service]
Type=oneshot
ExecStart=$SCRIPT_DIR/weekly-arch-review.sh
EOF

cat > "$USER_SYSTEMD/arch-review.timer" << EOF
[Unit]
Description=Run architecture review every Monday at 09:00

[Timer]
OnCalendar=Mon *-*-* 09:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now arch-review.timer

echo "Timer installed. Next runs:"
systemctl --user list-timers arch-review.timer
