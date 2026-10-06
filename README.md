# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`에서 점령된 가상 자료실을 볼 수 있습니다. `/data.json`에는 같은 가상 메모가 공개됩니다. 이 공개 상태를 확인하는 것이 1단계의 출발점입니다. 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이전 제출 묶음 방식의 자리표시자입니다. 1단계에서는 학생이 편집하지 않습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 가상 화면만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 저장소의 `src/attack-check.mjs`는 실제 배포가 된 뒤 `/data.json`을 비로그인으로 요청해 공개 가상 메모의 확인 표시를 읽습니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.

## 2단계: 자료를 코드 밖으로 이동

* **구현 내용**: 가상 메모를 Supabase `notes` 테이블로 이전하고, 정적 JSON 파일(`public/data.json`, `data.json`)에서 메모 본문을 제거했습니다. 화면(`public/index.html`)은 Vercel Serverless Function(`/api/notes`)을 통해 환경변수(`SUPABASE_URL`, `SUPABASE_SECRET_KEY`)를 사용하여 데이터를 읽어옵니다. 브라우저 코드 및 번들에는 비밀키가 노출되지 않습니다.
* **남은 약점 (공개 API 주소)**:
  * 2단계의 `/api/notes` 엔드포인트는 인증 장치가 없는 공개 API였습니다.

## 3단계: 진짜 로그인을 붙입니다

* **작동하는 기능**:
  * **인증 UI**: Supabase Auth 공식 SDK를 적용해 이메일/비밀번호 로그인 및 로그아웃 화면을 제공하며, 로그인 실패 시 오류 원인을 화면에 표시합니다.
  * **토큰 검증**: 서버리스 엔드포인트에서 `src/verify-login.mjs`를 활용하여 요청 Bearer 토큰의 서명, 만료, 대상을 검증합니다. 비로그인, 만료, 위조, 타 서비스 발급 토큰 요청은 모두 401 JSON 오류로 즉시 거부합니다.
  * **가상 메모 CRUD**: 로그인한 계정의 메모 추가(`POST /api/notes`), 목록 조회(`GET /api/notes`), 단건 조회(`GET /api/notes/:id`), 수정(`PUT /api/notes/:id`), 삭제(`DELETE /api/notes/:id`) 기능을 지원합니다.
  * **설정 등록**: `aleph.config.json`에 `identityProvider` 발급자 메타데이터와 `allowedRoutes` 경로를 등록했습니다.
* **다시 실행하는 방법**:
  * 로컬 빌드 검증: `npm run build -- --local`
  * 배포 및 동작 확인: 변경사항을 GitHub main 브랜치로 push하여 Vercel 배포 후, 배포 도메인에서 로그인 및 메모 추가·수정·삭제를 테스트합니다.
  * 거부 확인: 브라우저 주소창 또는 curl로 `GET /api/notes` 직접 호출 시 `401 Unauthorized`가 반환되는지 확인합니다.
* **해결된 약점**:
  * 3단계의 타인 자료 접근 허점(IDOR)을 4단계에서 API 계층 인가 검증과 DB RLS를 통해 완전히 해결했습니다.

## 4단계: 로그인해도 내 자료만 보이게 합니다

* **작동하는 기능**:
  * **API 계층 인가 및 IDOR 방어**: `GET /api/notes/:id`, `PUT /api/notes/:id`, `DELETE /api/notes/:id` 호출 시 DB의 `owner_id`와 JWT 검증 사용자(`userId`)를 대조하여, 타인 소유 자원 접근 또는 소유자 변경 시도시 `403 Forbidden` JSON 오류로 즉시 거부합니다.
  * **수정/삭제 무결성**: 수정(`PUT`) 시 요청 본문의 `owner_id` 변조를 차단하고 기존 행과 갱신 행 모두 본인 소유일 때만 반영합니다.
  * **DB 최소 권한 및 RLS 격리**: Supabase `notes` 테이블의 기본 권한을 `REVOKE`하고, `authenticated` 역할에만 `auth.uid() = owner_id` 조건의 최소 CRUD 권한(SELECT, INSERT, UPDATE, DELETE) 및 RLS 정책을 부여했습니다(`anon` 역할은 전면 차단).
* **다시 실행하는 방법**:
  * 로컬 검증: `npm run build -- --local` 및 `npm run test:r5`
  * 제출 묶음 생성: `npm run bundle`
  * 원격 배포 및 검증: 변경사항을 main 브랜치에 push 후 배포 URL에서 계정 A/B로 로그인하여 본인 메모 CRUD 및 타인 메모 수정·삭제 거부(403) 확인.

## 5단계: 자료 요청을 서버 한곳으로 모읍니다

* **작동하는 기능**:
  * **서버리스 프록시 일원화**: 브라우저의 메모 읽기·추가·수정·삭제 요청은 모두 Vercel 서버 함수(`/api/notes`, `/api/notes/:id`)를 통해서만 수행되며, 브라우저에서 Supabase REST API로의 직접 데이터 요청 경로는 존재하지 않습니다.
  * **DB 권한 전면 회수**: Supabase `notes` 테이블에 대해 `PUBLIC`, `anon`, `authenticated` 역할의 직접 권한을 전면 `REVOKE`하고 RLS를 적용하여, 공개 키 또는 사용자 토큰으로 원본 Supabase API를 직접 조회·수정하는 시도를 원천 차단했습니다.
  * **서버 전용 접근 통제 유지**: Vercel 서버리스 함수(`api/_auth.js`)는 `service_role` 키를 사용하여 안전하게 DB와 통신하며, 서버 함수 내의 인증 및 소유자 인가 검증 로직을 엄격하게 유지합니다.
  * **설정 등록**: `aleph.config.json`에 `step: 5` 및 쿼리 파라미터 없는 원본 자료 HTTPS 경로(`originalApiUrl`)를 등록했습니다.
* **다시 실행하는 방법**:
  * 로컬 검증: `npm run build -- --local` 및 `npm run test:r5`
  * 제출 묶음 생성: `npm run bundle`
  * 배포 및 확인: main 브랜치 push 후 브라우저에서 로그인 사용자 정상 메모 CRUD 확인 및 Supabase 원본 URL 직접 호출 차단 확인.



