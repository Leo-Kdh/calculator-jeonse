// 한국주택금융공사(HF) '전세대출금리안내 주별' 공시에서 6대 은행 금리를 읽어 rates.json에 누적한다.
// 실행: node scripts/fetch-rates.mjs            (HF 페이지를 직접 요청)
//       node scripts/fetch-rates.mjs page.html  (저장된 HTML로 테스트)
// 결과: 새 취급기간이면 rates.json에 한 주 추가 → GITHUB_OUTPUT에 changed=true
// 실패(페이지 접속 불가·표 없음·값 이상)하면 rates.json을 건드리지 않고 오류로 종료한다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RATES_FILE = path.join(ROOT, 'rates.json');
const URL_HF = 'https://www.hf.go.kr/ko/sub02/sub02_01_07_01.do';
// rates.json의 banks 순서와 같아야 함. HF 표기명 → 화면 표기명
const BANKS = [
  ['국민은행', 'KB국민은행'],
  ['신한은행', '신한은행'],
  ['하나은행', '하나은행'],
  ['우리은행', '우리은행'],
  ['농협은행', 'NH농협은행'],
  ['기업은행', 'IBK기업은행'],
];
const MAX_WEEKS = 104;

function fail(msg, extra) {
  console.error('::error::' + msg);
  if (extra) console.error(extra);
  process.exit(1);
}

async function loadHtml() {
  const local = process.argv[2];
  if (local) return fs.readFileSync(local, 'utf8');
  let res;
  try {
    res = await fetch(URL_HF, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; jeonse-rate-bot/1.0; +https://github.com)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    fail(`HF 페이지 접속 실패: ${e.message} (해외 IP 차단·일시 장애 가능성)`);
  }
  if (!res.ok) fail(`HF 페이지 응답 오류: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // 문자 인코딩 판별 (UTF-8 기본, EUC-KR 대비)
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const head = buf.subarray(0, 2048).toString('latin1').toLowerCase();
  const isEucKr = /euc-kr|ks_c_5601|cp949/.test(ct) || /charset=["']?(euc-kr|ks_c_5601|cp949)/.test(head);
  return new TextDecoder(isEucKr ? 'euc-kr' : 'utf-8').decode(buf);
}

// HTML 표 → 행 배열(각 행은 셀 텍스트 배열)
function tableRows(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(td|th)>/gi, '\u0001')
    .replace(/<\/tr>/gi, '\u0002')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#45;|&#x2d;/gi, '-');
  return text.split('\u0002').map(r => r.split('\u0001').map(c => c.replace(/\s+/g, ' ').trim()).filter((c, i, a) => c !== '' || i < a.length - 1));
}

function parse(html) {
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const pm = plain.match(/취급기간\s*:?\s*(\d{4}[-.]\d{2}[-.]\d{2})\s*~\s*(\d{4}[-.]\d{2}[-.]\d{2})/);
  if (!pm) fail('취급기간을 찾지 못함 (페이지 구조 변경 또는 자바스크립트로 표를 그리는 구조일 수 있음)', plain.slice(0, 600));
  const period = `${pm[1].replace(/\./g, '-')} ~ ${pm[2].replace(/\./g, '-')}`;

  const rows = tableRows(html);
  const rates = BANKS.map(([hfName]) => {
    const row = rows.find(r => r.length >= 2 && r[0] === hfName);
    if (!row) return undefined;               // 표에 행 자체가 없음
    const v = row[1];
    if (/^[-–—]$/.test(v) || v === '') return null; // 해당 주 취급 없음
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  });

  const missing = BANKS.filter((_, i) => rates[i] === undefined).map(b => b[0]);
  if (missing.length) fail(`표에서 은행 행을 찾지 못함: ${missing.join(', ')}`, rows.filter(r => r.length > 1).slice(0, 30).map(r => r.join(' | ')).join('\n'));
  const nums = rates.filter(x => typeof x === 'number');
  if (nums.length < 3) fail(`유효 금리가 3개 미만 (${nums.length}개) → 표 해석 오류 의심`);
  if (nums.some(x => x <= 0 || x >= 20)) fail(`비정상 금리 값: ${nums.join(', ')}`);
  return { period, rates };
}

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

function writeRates(data) {
  // 사람이 읽기 쉽게: history 한 주 = 한 줄
  const lines = [
    '{',
    `  "updated": ${JSON.stringify(data.updated)},`,
    `  "source": ${JSON.stringify(data.source)},`,
    `  "url": ${JSON.stringify(data.url)},`,
    `  "banks": ${JSON.stringify(data.banks).replace(/,/g, ', ')},`,
    '  "history": [',
    data.history.map(h => `    {"period": ${JSON.stringify(h.period)}, "rates": ${JSON.stringify(h.rates).replace(/,/g, ', ')}}`).join(',\n'),
    '  ]',
    '}',
    '',
  ];
  fs.writeFileSync(RATES_FILE, lines.join('\n'));
}

function setOutput(k, v) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
}

const html = await loadHtml();
const { period, rates } = parse(html);
console.log(`공시 취급기간: ${period}`);
BANKS.forEach(([hf], i) => console.log(`  ${hf}: ${rates[i] ?? '취급 없음'}`));

const data = JSON.parse(fs.readFileSync(RATES_FILE, 'utf8'));
setOutput('period', period);
if (data.history.some(h => h.period === period)) {
  console.log('이미 반영된 주 → 변경 없음');
  setOutput('changed', 'false');
} else {
  data.history.push({ period, rates });
  data.history.sort((a, b) => a.period.localeCompare(b.period));
  if (data.history.length > MAX_WEEKS) data.history = data.history.slice(-MAX_WEEKS);
  data.updated = kstToday();
  writeRates(data);
  console.log(`새 주 추가 완료 (총 ${data.history.length}주)`);
  setOutput('changed', 'true');
}
