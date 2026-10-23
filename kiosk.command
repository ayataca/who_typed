#!/bin/bash
# Who typed? を展示用に起動する（Mac）：サーバーを立ち上げ、Chrome をキオスクモードで開く。
# キオスクモードでは、Chrome のタブ・アドレスバーも Mac のメニューバーも出ない。終了は ⌘Q。
# ふだんの Chrome とは別のプロフィールで開く（基板・カメラの許可は、最初の1回だけ聞かれる）
cd "$(dirname "$0")"
PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2); PORT=${PORT:-8787}
URL="http://localhost:$PORT/keycap_lab/index.html"
if ! curl -s -o /dev/null "http://localhost:$PORT/"; then
  node server.mjs &
  SERVER=$!
  for i in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 0.25; done
fi
open -na "Google Chrome" --args --kiosk --no-first-run --user-data-dir="$HOME/Library/Application Support/who_typed_kiosk" "$URL"
echo "Chrome をキオスクモードで開きました（$URL）。終了は Chrome で ⌘Q。このウィンドウを閉じると、サーバーも止まります"
[ -n "$SERVER" ] && wait $SERVER
