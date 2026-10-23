#!/bin/bash
# スマホから感想タイムライン（8788 番）を見られるようにする：Cloudflare Tunnel で 8788 番だけを公開する
# 先に node server.mjs（または kiosk.command）を起動しておく。止めるときは、このウィンドウで Ctrl + C
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v cloudflared >/dev/null; then echo "cloudflared がありません。ターミナルで brew install cloudflared を実行してください"; read -r; exit 1; fi
echo "出てくる https://〇〇.trycloudflare.com に /timeline を付けて、スマホで開いてください"
cloudflared tunnel --url http://localhost:8788
