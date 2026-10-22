// 画面をタップすると全画面にする（感想タイムラインと展示用フィードで共通）
// - Android・iPad・PC の Chrome などで効く。ブラウザの決まりで、最初の1回はタップが必要
// - iPhone の Safari は Web ページの全画面表示に対応していないので、
//   共有ボタン →「ホーム画面に追加」から開く（アドレスバーなしで開く）
(() => {
  const el = document.documentElement;
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!request) return;
  const isFull = () => document.fullscreenElement || document.webkitFullscreenElement;
  document.addEventListener('click', () => {
    if (isFull()) return;
    try {
      const p = request.call(el, { navigationUI: 'hide' });
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* 全画面にできない端末では、そのまま表示を続ける */ }
  });
})();
