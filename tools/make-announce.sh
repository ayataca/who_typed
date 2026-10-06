#!/bin/zsh
# macOSの音声でアナウンスを書き出す
#   ./tools/make-announce.sh            → 日本語音声すべてで候補を audio/candidates/ に書き出す
#   ./tools/make-announce.sh system    → システム設定で選んだ声で本番用 audio/announce-*.wav を書き出す（通常はこれ）
#   ./tools/make-announce.sh Kyoko     → 名前を指定して書き出す（簡易版の声のみ）
# プレミアム／Siriの声（Sakura など）は名前では呼べず、指定しても黙って Kyoko になる。
# 使うには「システム設定 → アクセシビリティ → 読み上げコンテンツ → システムの声」で選んでから system で書き出す。
set -e
cd "${0:A:h}/.."
RATE=${RATE:-190}   # 1分あたりの語数。小さいほどゆっくり
PLACE='それでは、はじめます。[[slnc 450]] キーボードの上に、[[slnc 150]] 両手の指を、置いてください。'
WAIT='指を、離さずに、[[slnc 200]] キーボードではなく、[[slnc 120]] 画面を、ご覧ください。'
render(){ # voice name outfile text
  local tmp=$(mktemp -t announce).aiff
  if [[ $1 == system ]]; then say -r $RATE -o $tmp "$3"; else say -v "$1" -r $RATE -o $tmp "$3"; fi
  # 前後に少し無音を足し、音量をそろえる
  ffmpeg -loglevel error -y -i $tmp -af "adelay=150|150,apad=pad_dur=0.3,loudnorm=I=-16:TP=-1.5" -ar 44100 -ac 1 "$2"
  rm -f $tmp
}
if [[ -z $1 ]]; then
  mkdir -p audio/candidates
  say -v '?' | grep ja_JP | sed -E 's/ +ja_JP.*//' | while read -r v; do
    f="audio/candidates/${v// /_}"; f=${f//[()（）]/}
    render "$v" "$f-place.wav" "$PLACE"; render "$v" "$f-wait.wav" "$WAIT"; echo "$v"
  done
  render system audio/candidates/system-place.wav "$PLACE"; render system audio/candidates/system-wait.wav "$WAIT"; echo "system（システムの声）"
else
  render "$1" audio/announce-place.wav "$PLACE"; render "$1" audio/announce-wait.wav "$WAIT"
  echo "書き出し完了: audio/announce-place.wav, audio/announce-wait.wav ($1)"
fi
