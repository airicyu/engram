#!/usr/bin/env bash
# Usage: kill-port.sh <port>   # list + kill listeners on that port
set -euo pipefail
PORT="${1:?usage: kill-port.sh <port>}"
lsof -nP -iTCP:"$PORT" -sTCP:LISTEN || { echo "nothing on $PORT"; exit 0; }
kill $(lsof -t -iTCP:"$PORT" -sTCP:LISTEN)
echo "killed port $PORT"
