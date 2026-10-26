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
  * **서버리스 프록시 일원화**: 브라우저의 메모 읽기·추가·수정·삭제 요청은 물론 로그인 인증(`POST /api/auth`)까지 모두 Vercel 서버 함수를 통해서만 수행되며, 화면 코드(`public/index.html`)에서 Supabase SDK 및 공개 anon 키(`SUPABASE_ANON_KEY`)를 전면 제거했습니다.
  * **DB 권한 전면 회수**: Supabase `notes` 테이블에 대해 `PUBLIC`, `anon`, `authenticated` 역할의 직접 권한을 전면 `REVOKE`하고 RLS를 적용하여, 공개 키 또는 사용자 토큰으로 원본 Supabase API를 직접 조회·수정하는 시도를 원천 차단했습니다.
  * **서버 전용 접근 통제 유지**: Vercel 서버리스 함수(`api/_auth.js`, `api/auth.js`)는 서버 환경변수의 키를 사용하여 안전하게 통신하며, 서버 함수 내의 인증 및 소유자 인가 검증 로직을 엄격하게 유지합니다.
  * **설정 등록**: `aleph.config.json`에 `step: 5`, 쿼리 파라미터 없는 원본 자료 HTTPS 경로(`originalApiUrl`), 및 `allowedRoutes`를 등록했습니다.
* **다시 실행하는 방법**:
  * 로컬 검증: `npm run build -- --local` 및 `npm run test:r5`
  * 제출 묶음 생성: `npm run bundle`
  * 배포 및 확인: main 브랜치 push 후 브라우저에서 로그인 사용자 정상 메모 CRUD 확인 및 Supabase 원본 URL 직접 호출 차단 확인.

## 6단계: 등록한 기기만 자료실에 들어옵니다

* **작동하는 기능**:
  * **기기 등록 판정 규칙(`device_registered`)**: SDP 엔진 계약(`docs/DECIDER_REQUEST.md`)에 따라 판정기(`src/decider.mjs`)에 기기 등록 상태 검증 규칙을 구현했습니다.
  * **인가 및 거부 처리**: `request.deviceRegistered`가 `true`인 경우에만 승인(`decision: 'allow'`, `reasonCode: 'approved'`)하고, 미등록(`false`)이거나 누락된 요청은 즉시 거부(`decision: 'deny'`, `reasonCode: 'device_not_registered'`)합니다.
  * **설정 등록**: `aleph.config.json`의 단계를 `step: 6`으로 갱신하고 기존의 원본 API 주소(`originalApiUrl`), 허용 라우트, 발급자 설정을 보존했습니다.
* **다시 실행하는 방법 (확인 순서)**:
  * 별도의 설치 프로그램은 없으며 로컬 판정기 시험을 실행합니다:
    ```bash
    npm run decider:test
    ```
  * 시험 결과에서 다음 두 항목이 모두 `통과`로 출력되는지 확인합니다:
    * `통과 · 등록 기기의 정상 요청` (allow 판정)
    * `통과 · 미등록 기기의 가상 요청` (deny 및 device_not_registered 판정)
  * 기존 단위/빌드 검증: `npm run build -- --local` 및 `npm run test:r5`
## 7단계: 평소와 다른 접속은 다시 확인합니다

* **작동하는 기능**:
  * **신호 출처 검증**: `src/decider.mjs`에서 엔진이 넘긴 신호(`signals`)의 출처(`source`)를 검증하여 위조된 클라이언트 헤더가 정상 접속 정보로 승격되지 않도록 차단했습니다.
  * **복합 이상 접속 판정 규칙(`step_up_required`)**: 비통상 시각(심야), 미확인 네트워크, 대량 요청/위험 행동 신호가 결합된 가상 사건을 탐지하여 추가 본인 확인(`decision: 'step_up'`, `reasonCode: 'step_up_required'`)을 요구합니다. 지역(`region`) 단독으로는 영구 차단하지 않습니다.
  * **재인증 승인**: 기인증된 유효 추가 인증(`request.stepUp.verified === true` 및 유효 시간 내) 요청은 정상 승인(`decision: 'allow'`, `reasonCode: 'approved'`)합니다.
  * **설정 등록**: `aleph.config.json` 단계를 `step: 7`로 갱신하고 기존 발급자, 원본 API 주소, 허용 라우트를 유지했습니다.
* **다시 실행하는 방법 (확인 순서)**:
  * 로컬 판정기 시험을 실행합니다:
    ```bash
    npm run decider:test
    npm run fixture:7
    ```
  * 시험 결과에서 다음 네 항목이 모두 `통과`로 출력되는지 확인합니다:
    * `통과 · 등록 기기의 정상 요청` (allow 판정)
    * `통과 · 미등록 기기의 가상 요청` (deny 판정)
    * `통과 · 복합 이상 접속` (step_up 판정)
    * `통과 · 다시 확인한 복합 이상 접속` (allow 판정)
  * `npm run fixture:7`에서 정상 사건은 `allow`, 복합 이상 사건은 `step_up`으로 판정되는지 확인합니다.
  * 기존 단위/빌드 검증: `npm run build -- --local` 및 `npm run test:r5`
  * 제출 묶음 생성: `npm run bundle`

## 8단계: 자료마다 갈 수 있는 구역을 나눕니다

* **작동하는 기능**:
  * **자원 식별 구역 분리**: 메모와 강사 공지의 자원 식별 체계를 분리(`note-` / UUID 및 `notice-`)하여 서버가 자원 구역을 구별할 수 있도록 구성했습니다.
  * **판정기 구역 규칙(`zone_policy`)**: `src/decider.mjs`에 서비스 및 경로 모양별 구역 규칙을 추가했습니다.
    * 메모: 단건 경로(`GET /notes/:id` 등)만 허용하고 ID 없는 전체 목록 경로는 거부합니다.
    * 반 공지: 읽기(`GET`)만 허용하고 쓰기(`POST·PUT·PATCH·DELETE`)는 전면 거부합니다.
    * 강사 자료: 판정기에서 전면 거부합니다.
    * 기능 경로 차단: `:id` 깊이의 `export` 등 특수 기능 경로는 즉시 거부합니다.
  * **자료 API 소유자·권한 재대조**: 클라이언트 요청 본문이나 헤더의 `role` 주장을 무시하고, 검증된 신원과 저장된 소유자·강사 권한을 대조하여 타 구역 자료 접근 및 공지 변조를 차단했습니다.
  * **설정 등록**: `aleph.config.json`의 단계를 `step: 8`로 올리고, `allowedRoutes`에 판정기가 허용하는 경로만 메서드를 붙여 갱신했습니다.
* **다시 실행하는 방법 (확인 순서)**:
  * 로컬 판정기 시험을 실행합니다:
    ```bash
    npm run decider:test
    npm run fixture:7
    ```
  * 시험 결과에서 다음 항목들이 모두 `통과`로 출력되는지 확인합니다:
    * `통과 · 등록 기기의 정상 요청`
    * `통과 · 미등록 기기의 가상 요청`
    * `통과 · 복합 이상 접속`
    * `통과 · 다시 확인한 복합 이상 접속`
    * `통과 · 메모 전체 목록 거부 (ID 없는 목록 경로)`
    * `통과 · 공지 읽기 허용 (GET)`
    * `통과 · 공지 쓰기 거부 (PUT)`
    * `통과 · 강사 자료 거부`
    * `통과 · 기능 경로 거부 (:id 위치의 export)`
  * 기존 단위/빌드 검증: `npm run build -- --local` 및 `npm run test:r5`
  * 제출 묶음 생성: `npm run bundle`

## 9단계: 도플갱어를 찾고 권한을 거둡니다

* **작동하는 기능**:
  * **사건 계약 준수 입력 처리**: `src/detect.mjs`에서 `docs/DETECT_EVENTS.md` 계약에 정의된 `at`(시각), `method`(요청 방식), `identity.sub`(가명 사용자) 세 값만 파싱하며, 네트워크·기기·지역 등 계약 외 필드는 배제했습니다. 토큰, 개인정보, 메모 본문은 저장하거나 출력하지 않습니다.
  * **단시간 대량 조회 탐지 규칙(`burst_read`)**: 동일한 `identity.sub` 사용자의 `GET` 요청이 임의의 10분 구간 내에서 120건을 초과(121건 이상)할 경우 의심 사건으로 판정합니다. 정확히 120건 이하, 다른 사용자의 요청, 10분 밖으로 분산된 요청은 정상(`observe`)으로 판정합니다.
  * **회수 제안 형식**: 탐지 시 정확히 `{ action: 'propose_revocation', reasonCode: 'burst_read', subject }` 형식만 반환하며 다른 키는 일절 추가하지 않습니다. 정상 사건은 `{ action: 'observe' }`를 반환합니다.
  * **기존 판정기 및 설정 보존**: `src/decider.mjs`의 허용/거부 응답 형식과 기기 규칙을 온전히 보존하고, `aleph.config.json`의 단계를 `step: 9`로 갱신했습니다.
* **다시 실행하는 방법 (확인 순서)**:
  * 로컬 탐지 시험을 실행합니다:
    ```bash
    npm run detect:test
    ```
  * 시험 결과에서 다음 6개 항목이 모두 `통과`로 출력되는지 확인합니다:
    * `통과 · 정상 조회 30건`
    * `통과 · 10분 안에 120건`
    * `통과 · 10분 안에 121건`
    * `통과 · 폭주 조회 200건`
    * `통과 · 서로 다른 사용자 각 100건`
    * `통과 · 10분 밖으로 흩어진 조회 200건`
  * 기존 판정기 및 단위 시험 검증:
    ```bash
    npm run decider:test
    npm run fixture:7
    npm run build -- --local
    npm run test:r5
    ```
  * 제출 묶음 생성:
    ```bash
    npm run bundle
    ```

## 10단계: 백업에서 자료실을 되살립니다

* **작동하는 기능**:
  * **안전 정책 사본 대조 및 diff 분석(`scripts/policy-diff.mjs`)**: 침해 전 검증된 안전 정책 사본(`src/policy-backup.json`)의 SHA-256 무결성 해시를 대조하여, 변조 여부를 검증하고 현재 시험 정책과의 변경 범위(diff)만 사전 출력합니다. 사본 부재 또는 해시 불일치 시 작업을 즉시 중단하며 실제 운영 정책은 건드리지 않습니다.
  * **안전 정책 복원 절차(`scripts/policy-restore.mjs`)**: 검증된 사본 버전으로 시험 정책을 안전하게 되돌립니다. 실행 전 바뀔 항목을 출력하며, 감사 이력과 타 서비스 규칙을 온전히 보존합니다. 정책 복원 후 계정 B의 계정 A 자료 요청은 다시 403 Forbidden으로 거부되고 계정 A의 정상 요청은 유지됩니다.
  * **비공개 가상 메모 사본 단건 복원 POST 엔드포인트(`POST /api/notes/restore`)**: 사본 저장소(`src/backup-notes.json`)에서 지정된 한 건의 메모 ID, 소유자(`owner_id`), 내용 해시(`contentHash`)를 정밀 대조한 후 DB에 복원(UPSERT)합니다. 위조된 해시는 400 Bad Request, 소유자 불일치/타인 메모 복구 시도는 403 Forbidden으로 거부하며, 다른 메모와 감사 기록은 보존합니다.
  * **설정 등록**: `aleph.config.json` 단계를 `step: 10`으로 올리고, `restoreRoute: "POST /api/notes/restore"` 및 `allowedRoutes`에 복구 경로를 등록했습니다.
* **다시 실행하는 방법 (복구 뒤 1~9단계 정상·금지 요청 재시험 순서)**:
  1. 안전 정책 사본 diff 확인:
     ```bash
     npm run policy:diff
     ```
     - 정상 결과: 복원할 버전(1.0.0)과 변경 범위가 실행 전에 출력됩니다.
  2. 안전 정책 복원 실행:
     ```bash
     npm run policy:restore
     ```
     - 정상 결과: 바뀔 항목이 확인된 후 안전 정책이 복원되며 계정 B의 A 자료 접근 차단이 복구됩니다.
  3. 로컬 판정기·탐지기·단위 시험 재검증:
     ```bash
     npm run decider:test
     npm run fixture:7
     npm run detect:test
     npm run test:r5
     ```
  4. 복구 뒤 1~9단계 및 10단계 정상·금지 요청 재시험 순서 및 점검 결과:
     * **1단계 (공개 자료실)**:
       * 정상 요청: 공개 마커 확인 -> 1단계 완료 후 2단계부터 정적 파일 메모 제거로 대체됨.
       * 금지 요청: 정적 `/data.json` 메모 노출 -> 차단 확인 (메모 본문 0건).
     * **2단계 (자료 코드 밖 이전)**:
       * 금지 요청: 비인가 정적 파일 조회 -> 차단 확인 (메모 노출 없음).
     * **3단계 (진짜 로그인)**:
       * 정상 요청: 로그인 사용자 메모 조회 -> 토큰 세션으로 200 반환.
       * 금지 요청: 비로그인 `GET /api/notes`, `POST /api/notes` -> 차단 확인 (HTTP 401 Unauthorized).
     * **4단계 (내 자료 격리)**:
       * 정상 요청: 계정 A의 본인 메모 조회 -> 200 정상 반환.
       * 금지 요청: 비인가 단건 `GET /api/notes/:id`, `PUT`, `DELETE` -> 차단 확인 (HTTP 401).
       * 타인 메모 IDOR 교차 시험: 브라우저 실시간 2개 계정 동시 로그인은 미실행 (단위 테스트로 인가 통제 통과).
     * **5단계 (서버 한곳 일원화)**:
       * 정상 요청: 서버리스 프록시 API 호출 -> 정상 통신.
       * 금지 요청: Supabase 원본 REST API 직접 GET 호출 -> 차단 확인 (HTTP 401 Unauthorized).
     * **6단계 (등록 기기만 허용)**:
       * 정상 요청: 등록 기기 요청 -> 승인 (`npm run decider:test` allow 통과).
       * 금지 요청: 미등록 기기 가상 요청 -> 차단 확인 (`npm run decider:test` deny 통과).
     * **7단계 (이상 접속 다시 확인)**:
       * 정상 요청: 재인증 완료된 이상 접속 -> 승인 (allow).
       * 금지 요청: 심야·미확인네트워크·행동이상 복합 이상 접속 -> 추가 인증 요구 확인 (`npm run fixture:7` step_up 판정).
     * **8단계 (구역 나누기)**:
       * 정상 요청: 공지 읽기 (`GET /api/notices/:id`) -> 허용 (GET 200 또는 decider 통과).
       * 금지 요청: 공지 수정 (`PUT /api/notices/:id`), 공지 ID로 메모 접근, 메모 목록 경로, 강사 자료 접근 -> 차단 확인 (HTTP 401/403 거부).
     * **9단계 (도플갱어 권한 회수)**:
       * 정상 요청: 10분 내 120건 이하 GET 요청 -> 정상 관찰 (observe).
       * 금지 요청: 10분 내 121건 이상 burst_read 요청 -> 권한 회수 제안 확인 (`npm run detect:test` propose_revocation 통과).
     * **10단계 (백업 복원 재시험)**:
       * 정상 요청: 사본과 일치하는 ID·소유자·해시로 `POST /api/notes/restore` -> 복원 성공 확인 (HTTP 200 OK, 해시 일치).
       * 금지 요청 1: 위조된 내용 해시로 복구 호출 -> 차단 확인 (HTTP 400 Bad Request, 내용 해시 불일치).
       * 금지 요청 2: 미등록 ID로 복구 호출 -> 차단 확인 (HTTP 404 Not Found, 사본 미존재).
       * 금지 요청 3: 복구 완료 후 비로그인 단건 메모 접근 -> 차단 유지 확인 (HTTP 401 Unauthorized).
  5. 로컬 빌드 및 제출 묶음 생성:
     ```bash
     npm run build -- --local
     npm run bundle
     ```
     - 실제로 실행하지 않은 시험은 미실행으로 표기하고 결과를 꾸미지 않았습니다.

## 11단계: 나만의 접속 앱을 완성합니다

* **작동하는 기능**:
  * **설치형 웹앱 설정(manifest.json)**: `public/manifest.json`을 추가하고 `public/index.html`에 연동하여 앱 이름, `standalone` 디스플레이, 테마 색상을 정의했습니다. 앱 설치 표시만으로 기기 확인이 끝났다고 보지 않으며, 서버의 기기 승인이 필수임을 명시했습니다.
  * **오프라인 상태 감지 및 안내**: 브라우저 네트워크 이벤트(`online`/`offline`) 및 `navigator.onLine`을 감지하여 네트워크 단절 시 상단 경고 배너로 오프라인 상태를 안내합니다.
  * **기기 승인 전 보호 자료 차단 UI**: 로그인된 상태라도 기기 승인이 확인되기 전에는 보호 자료(메모 목록 및 작성 폼)를 표시하지 않습니다.
  * **서버 기기 승인 엔드포인트(`POST /api/device/verify`)**: 인증된 사용자 세션을 확인하고 기기 승인 상태를 서버에서 판정합니다. 비인가 요청은 401 Unauthorized로 즉시 거부하며, 기기 키나 토큰을 브라우저 저장소(localStorage/sessionStorage)에 저장하지 않습니다.
  * **설정 등록**: `aleph.config.json`의 단계를 `step: 11`로 올리고, `allowedRoutes`에 `POST /api/device/verify`를 추가했습니다.
* **다시 실행하는 방법 (확인 순서)**:
  1. 단위 시험 및 로컬 판정기·탐지기 검증:
     ```bash
     npm run test:r5
     npm run decider:test
     npm run fixture:7
     npm run detect:test
     ```
  2. 로컬 빌드 및 제출 묶음 생성:
     ```bash
     npm run build -- --local
     npm run bundle
     ```
  3. 직접 확인할 것:
     * **승인 전에는 자료가 없는가?**: 로그인 직후 기기 미승인 상태에서 메모 목록과 작성 폼이 감춰지고 기기 승인 안내가 노출되는지 확인합니다.
     * **승인한 기기에서 기존 화면이 열리는가?**: 서버 기기 승인 확인 버튼을 누른 후 승인 배지와 함께 기존 메모 목록 및 작성 폼이 정상 표시되는지 확인합니다.




## 12단계: 탈환 작전실을 완성합니다

* **작동하는 기능**:
  * **탈환 작전실 현황 요약(`GET /api/ops/summary`)**: 판정기 규칙(3종 활성), 탐지 사건 규칙(`burst_read`), 회수 상태(`propose_revocation`), 복구 버전(`v1.0.0` SHA-256 무결성 검증)의 메타데이터를 통합 제공합니다. 가상 메모 본문은 일절 포함하지 않으며 서버 응답 수치와 화면 표시가 완전히 일치합니다.
  * **방어 실측 점검 및 41종 공격 대조표**: 1~11단계의 정상·금지 요청(정적 파일 메모 미노출, 비로그인 401 차단, 단건 IDOR 차단, 원본 DB 직접 접근 차단, 구역 격리, 위조 해시 복원 400 차단 등)을 실제 API로 실측하여 표로 렌더링합니다. 아직 실행하지 않은 총공세 41종 가상 침공 시험은 임의 통과 처리하지 않고 `미실행 (Pending)`으로 명확히 구분했습니다.
  * **설정 등록**: `aleph.config.json`의 단계를 `step: 12`로 갱신하고, `allowedRoutes`에 `GET /api/ops/summary`를 등록했습니다.

* **출처 구분 (학생 몫 vs 제공 엔진)**:
  * **학생 몫**:
    * **학생 판정기(`src/decider.mjs`)**: 계약에 명시된 18개 이름만 읽어 기기 등록(`device_registered`), 복합 이상 접속(`step_up_required`), 구역 정책(`zone_policy`) 규칙 판정 수행.
    * **학생 탐지기(`src/detect.mjs`)**: 10분 구간 내 단일 사용자 121건 이상 단시간 대량 조회 시 권한 회수 제안(`propose_revocation`, `burst_read`).
    * **학생 접속 앱(`public/index.html`, `public/manifest.json`)**: PWA 지원, 인메모리 기기 승인 통제, 탈환 작전실 대시보드 및 실측 대조표 렌더링.
    * **학생 자료실 API(`api/*`)**: Supabase Auth 연동, 인가/IDOR 차단, 프록시 일원화, 복구 엔드포인트(`POST /api/notes/restore`), 작전실 요약 엔드포인트(`GET /api/ops/summary`).
  * **제공 엔진**:
    * **ALEPH SDP 엔진 (출처: 제공 엔진)**: 트래픽 인입, 클라이언트 신원 확인, 판정기(`decide()`) 호출 및 인가 판정 적용, 사건 스트림 전달 및 릴레이 보안 통제.

* **설치·실행·중지·복구 안내 (재현 순서)**:
  1. **설치 (Install)**:
     ```bash
     npm install
     ```
     - 저장소를 클론한 후 필수 의존성 패키지(`@supabase/supabase-js`, `jose`)를 설치합니다. 오류 없이 정상 완료됩니다.
  2. **실행 및 검증 (Run & Test)**:
     - 판정기 규칙 검증:
       ```bash
       npm run decider:test
       npm run fixture:7
       ```
     - 비정상 사건 탐지 검증:
       ```bash
       npm run detect:test
       ```
     - 단위 시험 전체 검증:
       ```bash
       npm run test:r5
       ```
     - 정적 결과물 로컬 빌드:
       ```bash
       npm run build -- --local
       ```
     - 제출 묶음 무결성 및 자기 점검:
       ```bash
       npm run bundle
       ```
  3. **중지 (Stop)**:
     - 실행 중인 로컬 테스트 및 프로세스는 터미널에서 `Ctrl + C` 또는 터미널 세션을 닫아 안전하게 중지합니다.
  4. **복구 (Restore)**:
     - 정책 사본 diff 및 무결성 해시 사전 대조:
       ```bash
       npm run policy:diff
       ```
     - 안전 정책 복원 실행:
       ```bash
       npm run policy:restore
       ```
     - 비공개 메모 단건 사본 복구:
       - 사본 ID·소유자 ID·SHA-256 내용 해시가 일치하는 정상 페이로드로 `POST /api/notes/restore`를 호출하여 복구합니다. 위조된 해시는 400 Bad Request로 거부됩니다.

* **직접 확인할 것**:
  * 실제 API 결과와 작전실 화면 표시가 일치하는가?
  * 41종 시험 중 실측된 항목과 미실행 항목이 명확히 구별되었는가?
  * ALEPH SDP 엔진과 학생 작업의 출처가 명확히 분리되었는가?
  * 비밀번호, 토큰, 비밀키, 실제 개인정보가 일절 포함되지 않았는가?

## 17단계: 앱 내부 AI 연결 상태 표시

* **작동하는 기능**:
  * **앱 서버를 통한 수업용 AI 연결 점검 (`/api/ai/connection`)**:
    * 제공 화면(`public/app.js`, `public/index.html`)에서 앱 서버 엔드포인트(`/api/ai/connection`)를 통해 점검을 수행하고 결과를 `renderAiConnection`에 연결합니다.
    * 임의의 고정 성공(`verified`)을 반환하지 않고, 실제 수업용 AI 게이트웨이에 연결하여 `transportChecked: true`와 앱 권한 및 모델 응답을 엄격히 실측하며 미확인 시 권한 준비 중(`AUTH_PENDING`)을 반환합니다.
    * `AbortController` 및 요청 ID 시퀀스 추적을 통해 점검 취소(`cancelAiConnectionCheck`)와 재연결(`resetAiConnection`) 시 진행 중 점검을 즉시 중단하고 지연 응답 무효화를 보장합니다.
  * **수업용 AI 연결 상태 렌더링 (`renderAiConnection`)**:
    * 상태 분기(`idle`, `loading`, `ok`, `error`)를 지원합니다.
    * `idle`: 점검 전 안내("AI 연결 점검 전") 및 컨테이너 초기화로 이전 상태를 보존하지 않습니다.
    * `loading`: 점검 중 안내("AI 연결 점검 중...")를 렌더링합니다.
    * `ok`: `audienceAuthorization`에 따라 시험 연결(`test`) 및 앱 권한 확인 후 점검(`verified`)을 구분하고, 사용 가능 모델 수(`modelCount`)와 점검 시각(`checkedAt`)을 표시합니다.
    * **사건 설명 미실행 고지**: 모델 목록 조회 성공과 사건 설명의 완료를 혼동하지 않도록 "사건 설명은 아직 실행하지 않았습니다." 문구를 화면에 명시합니다.
    * `error`: 원문 오류나 열쇠를 화면에 노출하지 않고 안전한 정제 코드 및 메시지를 노출하며, 7대 원인(권한 준비 중, 인증 실패, 이용 한도, 이용 시간, 시간 초과, 취소, 모델 없음)별 조치 가이드를 한국어로 안내합니다.
    * 수동 점검 안내: "다시 점검은 사용자가 버튼을 직접 누르는 것입니다."를 표기하여 불필요한 자동 재시도를 차단합니다.
  * **보안 사건 설명 요청 및 기본 렌더링 (`/api/ai/explain`, `renderExplanation`)**:
    * 화면에서 과제 기준의 `/api/ai/explain` 엔드포인트를 호출하여 결과를 `renderExplanation`에 전달합니다.
    * `ok` 시 최상위 요소에 `data-student-explanation-event="event.id"` 속성을 부여하고 요약문을 표시합니다. 실패 시에는 해당 속성을 부여하지 않고 "기록은 그대로 유지됩니다."를 안내합니다.

## 18단계: 근거에 연결된 AI 보안 이벤트 설명

* **작동하는 기능**:
  * **근거 기반 보안 사건 설명 (`renderExplanation`)**:
    * AI 요약을 선택한 이벤트의 실제 근거(`evidence`), 규칙(`rules`), 현재 상태(`state`)와 바인딩하여 표시합니다.
    * `status === 'error'` 시 `event`가 null이어도 정제된 에러 코드, 메시지 및 `기록은 그대로 유지됩니다.`를 출력합니다.
    * `event`가 null이고 오류가 없으면 `보안 기록에서 기록을 먼저 고르세요.`를 안내합니다.
    * `status === 'loading'` 시 `설명 요청 중...`을 표시합니다.
    * `executed === true`인 제안은 시스템 규칙 위반으로 즉시 거부(`EXECUTED_PROPOSAL_REJECTED`)합니다.
    * `evidenceIds`가 `event.evidence`에 존재하지 않는 경우(`unknown_evidence`) 설명을 거부(`INVALID_EVIDENCE`)하며 가상 근거를 생성하지 않습니다.
    * 성공한 설명에만 `data-student-explanation-event=event.id` 속성을 부여합니다.
    * 사건 ID, `AI 설명(참고용)` 요약, 인용 근거(`ID — 근거 글`), 적용 규칙(`ID — 규칙 글`)을 표시합니다.
    * `access`, `session`, `device` 중 `unknown` 상태를 `확인 불가(unknown)`로 표기하며 정상이나 안전으로 왜곡하지 않습니다.
    * 지원 조치가 없는 경우(`supportedActions` 부재) `연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상)`를 안내하며, 제안이 있는 경우 `사람 확인이 필요하며 실행되지 않았습니다`를 명시하고 실행 버튼은 생성하지 않습니다.
* **다시 실행하는 방법**:
  * 단위 테스트 검증:
    ```bash
    npm run test:r5
    ```


