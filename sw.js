// 이자계산기_전세 서비스워커
// - 페이지(index.html): 네트워크 우선 → 수정 사항이 바로 반영, 오프라인이면 저장본
// - 그 외 앱 파일(차트 라이브러리·아이콘 등): 캐시 우선 (오프라인 실행)
// - rates.json: 네트워크 우선 (항상 최신 금리, 오프라인이면 마지막 저장본)
// 화면 파일(index.html 등)을 수정하면 아래 버전을 올려야 사용자 기기에 반영됨
const VERSION = 'v3';
const CACHE = 'jeonse-app-' + VERSION;
const SHELL = [
  './', './index.html', './manifest.webmanifest', './vendor/chart.umd.min.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './rates.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 구글 폰트 등 외부 요청은 브라우저 기본 처리

  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(req, {cache: 'no-store'})
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  if (url.pathname.endsWith('/rates.json')) {
    e.respondWith(
      fetch(req, {cache: 'no-store'})
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./rates.json', copy)); return res; })
        .catch(() => caches.match('./rates.json'))
    );
    return;
  }
  e.respondWith(
    caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
