---
name: kill-port
description: >-
  Kill the process listening on a TCP port. Use when the user says port in use,
  EADDRINUSE, kill port, free port, or Engram cannot bind 8787/8788.
---

# Kill Port

```bash
./.claude/skills/kill-port/scripts/kill-port.sh <port>
```

Engram: API `8787`, web `8788`.

If still held after TERM:

```bash
kill -9 $(lsof -t -iTCP:<port> -sTCP:LISTEN)
```
