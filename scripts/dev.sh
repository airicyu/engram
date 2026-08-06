#!/usr/bin/env bash
# 同時啟動 server + web。不啟用 job control,讓三者(本 script、server、web)
# 同屬一個 process group:終端的單一 Ctrl-C(SIGINT 給前景 process group)會
# 同時送達 server 與 web,`kill 0` 在退出時補殺殘留。
# 不做多層 process / port / log 管理 —— server、web 各自的 dev.sh 已在啟動時
# 清理自己的 port,log 直接輸出(想看單邊 log,直接跑 dev:server / dev:ui)。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

trap 'exit 130' INT
trap 'kill 0 2>/dev/null || true' EXIT

bun run --cwd server dev &
bun run --cwd web dev &

# 任一退出(Ctrl-C、crash、或正常結束)就收工,EXIT trap 補殺另一邊。
wait -n
