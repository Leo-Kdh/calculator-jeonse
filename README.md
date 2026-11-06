# 이자계산기_전세

전세대출 이자·상환표·변동금리 시나리오·전세 vs 월세 비교 계산기.
6대 은행(KB국민·신한·하나·우리·NH농협·IBK기업) 전세대출 평균금리를 매일 08:45(서울) 자동 확인해 새 주 공시가 나오면 반영합니다.

- 금리 출처: 한국주택금융공사 [전세대출금리안내(주별)](https://www.hf.go.kr/ko/sub02/sub02_01_07_01.do)
  - HF 보증서 담보 전세대출의 해당 주 평균금리 (버팀목 등 주택도시기금 재원·지자체 협약 상품 제외)
- 계산 결과는 참고용 추정치이며, 실제 금액은 금융기관 약정서 기준

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 계산기 화면 |
| `rates.json` | 은행별 주별 금리 데이터 (자동 갱신) |
| `scripts/fetch-rates.mjs` | HF 공시 수집 → `rates.json` 누적 |
| `.github/workflows/update-and-deploy.yml` | 매일 실행 + 사이트 배포 |
| `manifest.webmanifest`, `sw.js`, `icons/` | 홈 화면 앱 설치·오프라인 실행 |
| `vendor/chart.umd.min.js` | 차트 라이브러리 (Chart.js 4.4.1, MIT) |

## 설치 절차

1. GitHub → **+ → New repository** → 이름 입력(영문·숫자·`-`·`_`·`.`만 가능) → **Public** → Create
2. **Add file → Upload files** → 이 폴더의 파일·폴더 전부 끌어다 놓기 → **Commit changes**
   - `.github` 폴더가 안 올라가면: **Add file → Create new file** → 파일명 `.github/workflows/update-and-deploy.yml` 입력 → 내용 붙여넣기 → Commit
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**
4. **Actions** 탭 → `금리 갱신 및 사이트 배포` → **Run workflow** (첫 실행 테스트)
   - 성공(초록 ✓): 로그의 `HF 주별 전세대출금리 수집` 단계에 은행별 금리가 찍히면 정상
   - 실패(빨강 ✗): 해당 단계 로그를 캡처해 문의 (HF 접속 차단·페이지 구조 문제 여부 판단)
5. 접속: `https://<아이디>.github.io/<저장소이름>/` (반영까지 최대 10분)
6. 휴대폰에서 접속 → 홈 화면에 추가 (iPhone: Safari 공유 → 홈 화면에 추가 / Android: Chrome ⋮ → 홈 화면에 추가 또는 앱 설치)

## 운영 메모

- 금리는 주 1회 바뀌므로 매일 실행해도 새 주가 아닐 때는 아무것도 커밋하지 않음
- 수집 실패 시 기존 데이터는 그대로 유지되고, 실행 실패 알림이 GitHub 계정 메일로 옴
- 공개 저장소는 60일간 활동이 없으면 예약 실행이 자동 중지됨 → Actions 탭에서 다시 켜기
- `index.html` 등 화면 파일을 고치면 `sw.js`의 `VERSION`을 올려야 기존 설치 기기에 반영됨
- 6대 은행 구성 변경: `scripts/fetch-rates.mjs`의 `BANKS`와 `rates.json`의 `banks`를 같은 순서로 수정
