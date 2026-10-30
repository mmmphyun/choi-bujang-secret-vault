# ALEPH 방어전 학생 실행 설명서 및 시스템 구성도 (STUDENT_RUNBOOK)

이 문서는 제3자가 작업 위치와 명령어를 확인하여 프로젝트를 실행하고 아키텍처를 파악할 수 있도록 작성한 공식 실행 설명서입니다. 프로젝트의 실제 코드, 설정, 패키지 파일과 일치하며 일체의 비밀값(토큰, API 키, 비밀번호)을 포함하지 않습니다.

---

## 1. 실행 환경 및 프로그램 사양

본 프로젝트는 Windows 및 PowerShell 환경을 기준으로 검증되었습니다.

| 프로그램 / 런타임 | 요구 버전 | 실제 확인 버전 | 확인 명령어 | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js** | `>=22` (`package.json`) | `v24.22.1` | `node -v` | ESM 모듈(`type: "module"`) 및 네이티브 테스트 러너(`node --test`) 사용 |
| **npm** | 최신 권장 | `11.19.1` | `npm -v` | 의존성 관리 및 빌드/테스트/서버 구동 스크립트 실행 |
| **Git** | `2.x` 이상 | `2.55.0.windows.5` | `git --version` | 형상 관리 및 제출 커밋 해시 추적 |
| **PowerShell** | `5.1` 또는 `7.x` | Windows PowerShell | `$PSVersionTable.PSVersion` | 기본 셸 환경 |
| **Web Browser** | 최신 Chromium / Gecko | 최신 Chrome / Edge | - | DOM 렌더링 및 UI 검증 |

---

## 2. 프로젝트 폴더 구조 및 역할

작업의 Git 최상위 폴더(`C:\work\aleph-defense`) 기준 디렉터리 구성입니다.

```
aleph-defense/
├── api/                      # 서버리스 API 엔드포인트 계층 (인증, 메모, 기기, AI, 사건 프록시)
│   ├── _auth.js              # JWT 인증 검증 및 Supabase REST 프록시 공통 통신 모듈 (학생 작성)
│   ├── auth.js               # 로그인 프록시 엔드포인트 (POST /api/auth) (학생 작성)
│   ├── events.js             # 최근 보안 감사 기록 정적 제공 (GET /api/events) (제공 시작 틀)
│   ├── ai/                   # AI 엔드포인트
│   │   ├── connection.js     # 외부 AI 게이트웨이 직접 연결 점검 (학생 작성)
│   │   └── explain.js        # 사건 식별자 기반 보안 요약 템플릿 반환 (학생 작성)
│   ├── device/               # 기기 엔드포인트
│   │   └── verify.js         # 기기 식별자 유효성 검사 및 자체 승인 (학생 작성)
│   ├── notes/                # 가상 메모 엔드포인트
│   │   ├── index.js          # 메모 목록 조회(GET) 및 생성(POST) (Supabase 직접 통신) (학생 작성)
│   │   ├── [id].js           # 단건 조회, 수정, 삭제 (소유자 및 자원 구역 격리) (학생 작성)
│   │   └── restore.js        # 메모 사본 검증 및 단건 복구 (선택적 인증/해시 검증) (학생 작성)
│   ├── notices/              # 공지사항 조회 엔드포인트 (GET /api/notices) (제공 시작 틀)
│   └── ops/                  # 작전실 현황 요약 엔드포인트 (GET /api/ops/summary) (제공 시작 틀)
├── docs/                     # 시스템 문서
│   ├── DECIDER_REQUEST.md    # 6~8단계 SDP 판정기 계약 규격 명세 (제공 문서)
│   ├── DETECT_EVENTS.md      # 9~10단계 이상 탐지 엔진 사건 규격 (제공 문서)
│   └── STUDENT_RUNBOOK.md    # [본 문서] 21단계 학생용 실행 설명서 및 시스템 구성도 (학생 작성)
├── public/                   # 정적 웹 프론트엔드 계층
│   ├── index.html            # 브라우저 UI 마크업 및 작전실 대시보드 (제공 시작 틀 기반 학생 보완)
│   ├── app.js                # 웹 애플리케이션 진입점 및 API 비동기 통신 클라이언트 (제공 코드)
│   └── aleph.json            # 배포 메타데이터 (빌드 시 생성)
├── scripts/                  # 빌드, 검증, 번들링 및 복구 스크립트
│   ├── build-public.mjs      # 정적 빌드 스크립트 (`npm run build`) (제공 코드)
│   ├── bundle.mjs            # 단계별 검증 및 제출 묶음 생성 (`npm run bundle`) (제공 코드)
│   ├── decider-test.mjs      # 판정기 로컬 시뮬레이션 검증 (`npm run decider:test`) (제공 코드)
│   ├── detect-test.mjs       # 탐지기 로컬 시뮬레이션 검증 (`npm run detect:test`) (제공 코드)
│   ├── fixture-7.mjs         # 복합 이상 접속 검증 (`npm run fixture:7`) (제공 코드)
│   ├── policy-diff.mjs       # 보안 정책 차이 대조 (`npm run policy:diff`) (제공 코드)
│   └── policy-restore.mjs    # 보안 정책 안전 복원 (`npm run policy:restore`) (제공 코드)
├── src/                      # 독립 정책 엔진 및 시뮬레이션 로직
│   ├── decider.mjs           # 제로 트러스트 접근 제어 판정기 (`decide`) (학생 구현)
│   ├── detect.mjs            # 이상 접속 및 폭주 조회 탐지기 (`detectEvents`) (학생 구현)
│   ├── policy-manager.mjs    # 보안 정책 무결성 검증 및 복원 모듈 (학생 구현)
│   ├── verify-login.mjs      # JWT 서명/만료/대상 검증 모듈 (학생 구현)
│   ├── backup-notes.json     # 비공개 가상 메모 안전 복원 사본 파일
│   ├── policy-active.json    # 현재 활성 정책 파일
│   └── policy-backup.json    # 안전 기준 백업 정책 파일
├── student/                  # 학생 확장 UI 렌더링 계층
│   └── extension.mjs         # 상태 표시, AI 설명, 조치, 취약점 렌더러 7종 (학생 구현)
├── test/                     # 단위 및 통합 테스트 스위트
│   ├── action.test.mjs       # 19단계 조치 분리 및 실측 검증
│   ├── ai-connection.test.mjs# 17단계 AI 연결 및 설명 검증
│   ├── build-identity.test.mjs# 배포 식별자 검증
│   ├── explanation.test.mjs  # 18단계 근거 기반 설명 검증
│   ├── restore.test.mjs      # 11단계 메모 및 정책 복구 검증
│   ├── student-events.test.mjs# 15단계 이벤트 목록 및 상세 검증
│   ├── student-status.test.mjs# 14단계 기기/세션/진단 상태 검증
│   └── vulnerabilities.test.mjs# 20단계 취약점 및 OSV 매핑 검증
├── aleph.config.json         # 과제 단계 설정 및 허용 엔드포인트 명세
├── package.json              # 패키지 명세 및 스크립트 정의
└── package-lock.json         # 의존성 고정 락 파일
```

---

## 3. 작업 위치 및 실행 명령어

### 3.1 PowerShell 실행 위치
반드시 Git 저장소의 최상위 디렉터리에서 PowerShell을 실행합니다:
```powershell
Set-Location -Path "C:\work\aleph-defense"
```

### 3.2 의존성 설치
```powershell
npm install
```
*설치 패키지 버전 고정*:
- `@supabase/supabase-js`: `2.117.2`
- `jose`: `6.2.12`

### 3.3 로컬 개발 서버 실행 및 브라우저 접속
본 프로젝트는 Vercel Serverless Function(`api/`)과 정적 웹 자원(`public/`)을 로컬에서 함께 구동할 수 있도록 `package.json`에 `dev` 스크립트(`npx -y vercel dev`)를 지원합니다.
```powershell
npm run dev
```
- **정상 시작 신호**:
  ```text
  > aleph-defense-starter@ dev
  > npx -y vercel dev
  
  Ready! Available at http://localhost:3000
  ```
- **브라우저 접근 주소**: `http://localhost:3000` 접속 시 로그인 화면 및 작전실 대시보드 렌더링 확인.
- **종료 방법**: PowerShell 창에서 `Ctrl + C` 입력 후 `Y` 선택.

### 3.4 로컬 정적 빌드
```powershell
npm run build -- --local
```
- **정상 완료 신호**: 오류 없이 프로세스가 종료되며 `public/` 디렉터리에 배포 자원이 준비됨.

### 3.5 전체 단위 테스트 스위트 검증 (65종 전수 통과)
```powershell
npm run test:r5
```
- **정상 확인 신호**:
  ```text
  ℹ tests 65
  ℹ pass 65
  ℹ fail 0
  ```

### 3.6 독립 보안 엔진 및 정책 시뮬레이션 검증
`src/` 디렉터리의 판정기 및 탐지기는 웹 API 내부 미들웨어가 아닌 독립 시뮬레이션 모듈로서 다음 스크립트로 동작을 검증합니다:
```powershell
# 접근 제어 판정기 가상 요청 시험 (9개 시나리오 통과 확인)
npm run decider:test

# 비정상 행위 및 폭주 조회 탐지기 가상 시험 (6개 시나리오 통과 확인)
npm run detect:test

# 복합 이상 접속 판정 픽스처 시험 (정상: allow, 복합 이상: step_up 확인)
npm run fixture:7

# 보안 정책 변조 차이 대조
npm run policy:diff

# 안전 기준 정책 복원
npm run policy:restore
```

### 3.7 번들 생성 전 준비 사항 및 `bundle-notes.json` 작성 가이드
`scripts/bundle.mjs`(`npm run bundle`)는 실행 시 프로젝트 루트의 `bundle-notes.json`을 읽어 제출 묶음을 생성합니다. 이 파일은 개인 제출 메모가 포함되므로 `.gitignore`에 등록되어 저장소에 기본 커밋되지 않습니다. 새로 클론한 환경에서는 번들을 실행하기 전에 아래와 같이 프로젝트 루트에 파일을 생성해야 합니다:

1. **`bundle-notes.json` 파일 생성**:
   루트 디렉터리(`C:\work\aleph-defense\bundle-notes.json`)에 UTF-8 인코딩으로 다음 JSON 템플릿을 생성합니다:
   ```json
   {
     "explanation": "1. 학생용 실행 설명서(STUDENT_RUNBOOK.md) 및 시스템 아키텍처를 실제 구현과 일치시켰습니다.\n2. 로컬 개발 서버 구동 스크립트와 번들 사전 준비 절차를 완비했습니다.\n3. 오류별 실제 코드 원인과 제공/학생 경계를 명확히 분리 정리했습니다.",
     "blockedAt": null
   }
   ```
   *주의*: `explanation` 필드는 최소 10자 이상의 3줄 요약 문자열이어야 합니다.

2. **자기 점검 번들 생성 실행**:
   ```powershell
   npm run bundle
   ```
   - **정상 완료 신호**:
     ```text
     제출 묶음 JSON 생성: C:\work\aleph-defense\artifacts\submission.json
     단계 12 · 커밋 ... · 바뀐 파일 ... · 규칙 3개 · 직접 점검 17개
     ```

### 3.8 재실행 순서
코드나 문서를 수정한 후에는 `npm run test:r5`로 기존 65개 단위 기능의 비회귀(Non-regression) 상태를 먼저 확인하고, `npm run dev`로 로컬 서버를 재시작하여 브라우저에서 화면을 확인합니다.

---

## 4. 접속 주소 및 환경

| 구분 | 접속 주소 (URL) | 설명 |
| :--- | :--- | :--- |
| **로컬 환경** | `http://localhost:3000` | `npm run dev` (`npx vercel dev`) 구동 시 로컬 접근 주소 |
| **공개 배포 앱** | `https://choi-bujang-secret-vault-evun.vercel.app` | Vercel 프로덕션 배포 주소 (`aleph.config.json`의 `publicAppUrl`) |
| **심판 접수 서버** | `https://aleph-judge-production.up.railway.app/defense/judge` | 심판 접수 서버 (`aleph.config.json`의 `judgeIssuer`) |
| **원격 인증 발급자**| `https://lokymnrpfrnfirmhjvht.supabase.co/auth/v1` | Supabase Auth JWT 발급자 (`aleph.config.json`의 `identityProvider.issuer`) |
| **원격 데이터베이스**| `https://lokymnrpfrnfirmhjvht.supabase.co/rest/v1/notes` | Supabase REST API 원본 주소 (`aleph.config.json`의 `originalApiUrl`) |

---

## 5. 시스템 아키텍처 및 실제 데이터 흐름

### 5.1 아키텍처 구조 및 실제 연결 상태
시스템은 사용자의 브라우저, 로컬/서버리스 앱 서버(`api/`), 외부 서비스(Supabase, AI 게이트웨이), 그리고 독립 검증 엔진(`src/`)으로 구성됩니다.
* **실제 핸들러 동작 요약**:
  1. **로그인 (`POST /api/auth`)**: 브라우저 요청을 받아 Supabase Auth 서비스에 로그인 요청을 전달하고 JWT 토큰을 반환합니다.
  2. **가상 메모 (`api/notes/*`)**: `api/_auth.js`에서 JWT 토큰의 서명/만료/대상을 검증합니다. 통과된 요청은 판정기를 거치지 않고 `supabaseRequest()`를 통해 Supabase REST API(`/rest/v1/notes`)를 직접 호출하며, 핸들러 레벨에서 `owner_id` 대조를 통해 소유자를 격리합니다.
  3. **메모 복구 (`POST /api/notes/restore`)**:
     - **선택적 인증**: 요청에 `Authorization` 헤더가 전달된 경우에만 JWT 인증을 수행하여 요청자 ID와 사본의 `owner_id`를 대조(불일치 시 403)하며, 인증 헤더가 없는 요청도 허용됩니다.
     - **사본 및 해시 검증**: 사본 부재 시 404, 본문 `owner_id` 불일치 시 403, SHA-256 내용 해시 불일치 시 400을 반환합니다.
     - **DB 반영 결과 무시 및 200 반환**: 사본 검증 통과 후 Supabase DB에 갱신을 시도하지만, DB 통신 실패 여부와 무관하게(에러 무시) 사본 검증 성공 정보를 담아 `200 OK`(`success: true`)를 반환합니다.
  4. **기기 확인 (`POST /api/device/verify`)**: JWT 인증 후 요청 본문의 `deviceId` 길이(>=8)를 검사하여 유효하면 자체 승인 응답을 즉시 반환합니다. 판정기(`src/decider.mjs`)를 호출하지 않습니다.
  5. **보안 기록 (`GET /api/events`)**: 탐지기(`src/detect.mjs`)를 실행하지 않고 시작 틀에 내장된 최근 감사 기록 정적 배열(`RECENT_SECURITY_EVENTS`)을 즉시 반환합니다.
  6. **사건 설명 (`POST /api/ai/explain`)**: 외부 AI 게이트웨이를 호출하지 않고 전달된 `eventId`를 바탕으로 고정 요약 템플릿 문장을 즉시 반환합니다.
  7. **AI 연결 점검 (`GET /api/ai/connection`)**: 외부 AI 게이트웨이(`https://aleph-judge-production.up.railway.app/defense/ai/connection`)로 직접 HTTP 요청을 보내 전송 상태 및 권한을 실측합니다.
  8. **보안 정책 및 탐지 엔진 (`src/`)**: 웹 API의 요청 처리 경로에 배치되지 않으며, `npm run decider:test`, `npm run detect:test` 등의 독립 검증 스크립트에 의해 가상 시나리오를 검증하는 모듈로 분리되어 있습니다.

### 5.2 텍스트 기반 구성도 (ASCII)
```
+---------------------------------------------------------------------------------------------------------+
|                                           1. 브라우저 계층                                              |
|   +---------------------------------------------+   +-----------------------------------------------+   |
|   |   public/index.html (학생 접속 앱 보완)     |   |         student/extension.mjs                 |   |
|   |   public/app.js (제공 클라이언트 로직)      |   |  - renderStatus, renderEvents                 |   |
|   |  - 화면 렌더링 및 사용자 이벤트 처리       |   |  - renderAiConnection, renderExplanation      |   |
|   |  - fetch 비동기 통신 (Authorization Bearer) |   |  - renderAction, renderVulnerabilities        |   |
|   +---------------------------------------------+   +-----------------------------------------------+   |
+----------------------------------------------------+----------------------------------------------------+
                                                     |
                                                     | HTTPS / JSON (Bearer Token 선택/필수)
                                                     v
+---------------------------------------------------------------------------------------------------------+
|                                     2. 앱 서버 계층 (api/ 서버리스 함수)                                |
|   +-------------------------------------------------------------------------------------------------+   |
|   |                                           api/_auth.js                                          |   |
|   |   - Bearer 토큰 추출, src/verify-login.mjs 연동 서명/만료/대상 검증                            |   |
|   |   - supabaseRequest(): 환경변수 기반 Supabase REST API 통신 헬퍼                                |   |
|   +-------------------------------------------------------------------------------------------------+   |
|   | 엔드포인트 실제 처리 동작:                                                                      |   |
|   | - POST /api/auth          : Supabase Auth 로그인 요청 프록시                                    |   |
|   | - GET/PUT/DEL /api/notes/*: JWT 검증 후 Supabase REST API 직접 호출 (소유자 owner_id 격리)       |   |
|   | - POST /api/notes/restore : 선택적 인증, 사본 해시 검증 후 Supabase 시도 (DB 실패 무시 200 반환)|   |
|   | - POST /api/device/verify : JWT 검증 후 deviceId 길이 검사 -> 자체 승인 JSON 반환 (판정기 미연결)|  |
|   | - GET /api/events         : 정적 사건 배열(RECENT_SECURITY_EVENTS) 반환 (탐지기 미연결)         |   |
|   | - POST /api/ai/explain    : eventId 기반 고정 안내 템플릿 문장 반환 (AI 게이트웨이 미연결)       |   |
|   | - GET /api/ai/connection  : 외부 AI 게이트웨이 직접 연결 점검 (transportChecked 실측)          |   |
|   | - GET /api/ops/summary    : 작전실 메타데이터 요약 객체 반환                                    |   |
|   +------------------------------------+----------------------------+------------------------------+   |
+----------------------------------------|----------------------------|-----------------------------------+
                                         |                            |
                     (HTTPS / REST)      |                            | (HTTPS fetch)
                     v                   |                            v
+----------------------------------------+   +------------------------------------------------------------+
|        3. 외부 데이터베이스            |   |                      4. 외부 AI 게이트웨이                 |
|   Supabase (Auth & Database)           |   |   수업용 AI 게이트웨이 (/connection)                       |
|   - auth/v1: JWT 토큰 발급             |   |   - 전송 점검(transportChecked), 권한(test/verified) 실측  |
|   - rest/v1/notes: 메모 데이터 영속화  |   +------------------------------------------------------------+
+----------------------------------------+

===========================================================================================================
[ 독립 시뮬레이션 및 감사 엔진 계층 (src/) - 웹 API와 분리된 로컬 테스트 실행 모듈 ]
  - src/decider.mjs        : `npm run decider:test`, `npm run fixture:7`에서 가상 요청 9종 판정 검증
  - src/detect.mjs         : `npm run detect:test`에서 감사 로그 배열 대상 10분 슬라이딩 윈도우 폭주 탐지
  - src/policy-manager.mjs : `npm run policy:diff`, `policy:restore`에서 정책 해시 대조 및 복원
  - src/verify-login.mjs   : `api/_auth.js`에서 JWT 검증 시 재사용되는 신원 검증 모듈
  - src/backup-notes.json  : `api/notes/restore.js`에서 조회되는 단건 메모 사본 파일
===========================================================================================================
```

### 5.3 Mermaid 구성도
```mermaid
flowchart TD
    subgraph Browser["1. 브라우저 계층"]
        UI["기본 UI (public/index.html - 학생 보완, app.js - 제공)"]
        Ext["학생 확장 뷰 (student/extension.mjs)"]
        UI --- Ext
    end

    subgraph AppServer["2. 서버리스 API 계층 (api/)"]
        AuthMiddleware["인증/프록시 모듈 (api/_auth.js)"]
        RouteAuth["POST /api/auth<br>(로그인 프록시)"]
        RouteNotes["/api/notes/*<br>(소유자 격리 CRUD)"]
        RouteRestore["POST /api/notes/restore<br>(선택적 인증, 해시 검증, DB 실패 무시 200)"]
        RouteDevice["POST /api/device/verify<br>(식별자 검사 자체 승인)"]
        RouteEvents["GET /api/events<br>(정적 사건 배열 반환)"]
        RouteAiExplain["POST /api/ai/explain<br>(고정 템플릿 문장 반환)"]
        RouteAiConn["GET /api/ai/connection<br>(게이트웨이 실측)"]
    end

    subgraph ExternalServices["3. 외부 연동 서비스"]
        SupabaseAuth["Supabase Auth (JWT 발급)"]
        SupabaseDB["Supabase REST API (/rest/v1/notes)"]
        AiGateway["수업용 AI 게이트웨이"]
    end

    subgraph StandaloneEngine["4. 독립 정책/검증 엔진 (src/) - 로컬 테스트용"]
        Decider["src/decider.mjs<br>(npm run decider:test)"]
        Detector["src/detect.mjs<br>(npm run detect:test)"]
        PolicyMgr["src/policy-manager.mjs<br>(npm run policy:diff)"]
        Verifier["src/verify-login.mjs<br>(JWT 검증 모듈)"]
        BackupNotes["src/backup-notes.json<br>(메모 안전 사본)"]
    end

    UI -->|HTTPS / Bearer Token| AppServer
    AuthMiddleware --> Verifier
    RouteAuth -->|Proxy| SupabaseAuth
    RouteNotes --> AuthMiddleware
    RouteNotes -->|supabaseRequest() 직접 호출| SupabaseDB
    RouteRestore -.->|선택적 토큰 검증 시| AuthMiddleware
    RouteRestore -->|사본 조회| BackupNotes
    RouteRestore -->|DB 반영 시도 (실패 무시)| SupabaseDB
    RouteAiConn -->|fetch 직접 점검| AiGateway

    %% 명시적 독립 관계 표현
    Decider -.->|가상 요청 시험 독립 구동| StandaloneEngine
    Detector -.->|로그 시뮬레이션 독립 구동| StandaloneEngine
```

### 5.4 계층별 모듈 및 실제 데이터 흐름 표
| 계층 | 대상 모듈/파일 | 입력 데이터 | 실제 처리 내용 | 출력/결과 |
| :--- | :--- | :--- | :--- | :--- |
| **브라우저** | `student/extension.mjs`<br>`public/index.html`<br>`public/app.js` | 사용자 입력, 백엔드 API 응답 JSON | DOM 생성(`createElement`), 상태별 분기 렌더링, `data-*` 속성 바인딩 | 웹 화면 갱신 및 식별자 보존 |
| **로그인 프록시** | `api/auth.js` | `{ email, password }` | Supabase Auth API에 로그인 요청 프록시 | JWT Access Token 발급 반환 |
| **메모 API** | `api/notes/index.js`<br>`api/notes/[id].js` | HTTP 요청, Bearer JWT, 메모 본문 | JWT 서명 검증 후 `owner_id` 대조, Supabase REST API 직접 호출 | 메모 CRUD 데이터 또는 `401`/`403`/`404` |
| **메모 복구** | `api/notes/restore.js` | `{ id, owner, contentHash }`<br>(선택적 Bearer JWT) | 1. 사본 ID 존재(404) 및 소유자 대조(403)<br>2. 내용 SHA-256 해시 대조(400)<br>3. 인증 헤더 전달 시에만 요청자 신원 대조(403)<br>4. Supabase DB 갱신 시도하되 실패 무시 | `200 OK` 복구 사본 정보 반환 |
| **기기 확인** | `api/device/verify.js` | `{ deviceId }`, Bearer JWT | JWT 검증 후 `deviceId` 유효성(문자열, >=8) 검사 | 자체 승인 JSON (`approved: true`) 반환 |
| **보안 사건** | `api/events.js` | `GET /api/events` | 별도 탐지기 호출 없이 정적 배열 5건 반환 | 감사/XDR 기록 배열 반환 |
| **사건 설명** | `api/ai/explain.js` | `{ eventId }` | 외부 AI 호출 없이 고정 템플릿 요약 문장 반환 | 고정 요약 텍스트 JSON 반환 |
| **AI 연결 점검** | `api/ai/connection.js` | `GET /api/ai/connection` | 외부 AI 게이트웨이로 직접 fetch 요청 후 전송/권한 실측 | 게이트웨이 연결 상태 및 모델 수 반환 |
| **독립 판정 엔진** | `src/decider.mjs` | `DECIDER_REQUEST` 규격 JSON | `npm run decider:test` 실행 시 기기 등록 및 구역 규칙 시뮬레이션 | `allow`, `deny`, `step_up` 판정 결과 |
| **독립 탐지 엔진** | `src/detect.mjs` | 가상 사건 객체 배열 | `npm run detect:test` 실행 시 10분 슬라이딩 윈도우 폭주 탐지 | 위험 경보 및 이상 사건 ID 목록 |

---

## 6. 기능 경계 및 검증 상태 구분 표

### 6.1 제공 코드 vs 학생 구현 경계 일원화
README.md와 본 문서는 동일한 기준으로 코드 작성 주체 및 경계를 정의합니다:

| 구분 | 컴포넌트 / 디렉터리 | 파일명 | 설명 |
| :--- | :--- | :--- | :--- |
| **운영 측 제공 코드**<br>(수정 금지) | **UI 기본 로직** | `public/app.js` | 웹 UI 기본 이벤트 리스너 및 API 비동기 통신 클라이언트 |
| | **제공 시작 틀 API** | `api/events.js`<br>`api/ops/summary.js`<br>`api/notices/` | 기본 감사 기록 목 데이터 및 운영 요약 엔드포인트 |
| | **검증/번들 스크립트** | `scripts/build-public.mjs`<br>`scripts/bundle.mjs`<br>`scripts/decider-test.mjs`<br>`scripts/detect-test.mjs`<br>`scripts/fixture-7.mjs`<br>`scripts/policy-diff.mjs`<br>`scripts/policy-restore.mjs` | 정적 빌드, 제출 묶음 생성, 시뮬레이션 시험 러너 |
| | **공식 규격 문서** | `docs/DECIDER_REQUEST.md`<br>`docs/DETECT_EVENTS.md` | 판정기 및 탐지기 계약 규격 문서 |
| **학생 작성/수정 코드**<br>(1~21단계 누적) | **학생 접속 앱 UI** | `public/index.html`<br>`student/extension.mjs` | 제공된 시작 틀 기본 마크업을 바탕으로 PWA 및 작전실 대시보드를 보완한 웹 화면, 13~20단계 프론트엔드 확장 렌더러 7종 |
| | **학생 자료실 API** | `api/_auth.js`<br>`api/auth.js`<br>`api/notes/index.js`<br>`api/notes/[id].js`<br>`api/notes/restore.js`<br>`api/device/verify.js`<br>`api/ai/connection.js`<br>`api/ai/explain.js` | 2~5단계 메모 CRUD 및 소유자 격리,<br>6단계 기기 식별자 검증,<br>11단계 단건 사본 복구,<br>17~18단계 AI 연결 점검 및 설명 엔드포인트 |
| | **독립 정책/보안 엔진** | `src/verify-login.mjs`<br>`src/decider.mjs`<br>`src/detect.mjs`<br>`src/policy-manager.mjs` | 3단계 JWT 서명 검증,<br>6~8단계 접근 제어 판정 규칙,<br>9~10단계 슬라이딩 윈도우 이상 탐지,<br>11단계 정책 복원 모듈 |
| | **학생 문서 및 설정** | `docs/STUDENT_RUNBOOK.md`<br>`package.json` | 21단계 실행 설명서 및 아키텍처 문서,<br>로컬 개발 서버 구동 스크립트 |

### 6.2 실측 완료 기능 (테스트 통과)
| 검증 대상 | 실행 스크립트 | 통과 항목 수 | 실측 내용 요약 |
| :--- | :--- | :--- | :--- |
| **단위 테스트 스위트** | `npm run test:r5` | 65 / 65 통과 | - 13~14단계: 기기/세션 상태 분리 및 민감정보 제거<br>- 15단계: 접속 기록/경보 목록, 계약 불일치 처리<br>- 16단계: 정책 복원 및 비공개 메모 복구<br>- 17단계: AI 연결 점검 상태 4단계 및 7대 에러 대응<br>- 18단계: 근거 바인딩 AI 설명 및 지연 응답 무효화<br>- 19단계: 조치 상태/실제 효과 분리 (`effectApplied`)<br>- 20단계: 설치 패키지 락 버전 매핑 및 OSV 취약점 분기 |
| **접근 제어 판정기** | `npm run decider:test` | 9 / 9 통과 | 등록 기기 허용, 미등록 거부, 복합 이상 접속 step_up, 공지 읽기 허용/쓰기 거부 등 가상 시뮬레이션 |
| **이상 탐지기** | `npm run detect:test` | 6 / 6 통과 | 10분 내 120건 정상, 121건 이상 탐지, 폭주 조회 차단 가상 시뮬레이션 |
| **복합 이상 픽스처** | `npm run fixture:7` | 통과 | 정상 사건 `allow`, 복합 이상 사건 `step_up` 판정 |
| **정책 차이 대조** | `npm run policy:diff` | 통과 | 5개 변조 항목(버전, 소유자 격리, 공지 쓰기 권한) 식별 |
| **로컬 정적 빌드** | `npm run build -- --local` | 정상 완료 | `public/data.json` 제거 및 정적 배포 구조 생성 |

### 6.3 미확인 및 시뮬레이션 항목 (과정 외 범위 명시)
본 프로젝트는 판정 환경 및 모의 픽스처를 기준으로 구현 및 검증되었으며, 다음 항목은 실제 상용 인프라가 연동되지 않았음을 명시합니다:
1. **실제 ALEPH 운영 심판 실시간 통신**: `npm run bundle` 및 로컬 테스트는 가상 픽스처 기반 자기 점검이며, 외부 심판 서버와의 실시간 라이브 채점 세션은 포함되지 않음.
2. **사내망 실서버 mTLS 개인 인증서 연동**: 실제 기업 제로 트러스트 게이트웨이 접속 시 요구되는 개인 인증서는 학원 환경 정책상 발급되지 않으므로, 앱은 모의 환경('서버 연결 안 함' 또는 모의 응답)으로 동작함.
3. **상용 유료 LLM 외부 직접 호출**: 실제 유료 OpenAI/Anthropic/Gemini API 키를 외부 서버로 직접 전송하지 않으며, 수업용 AI 게이트웨이 모의 규격 및 정제된 에러 핸들링으로 검증됨.

---

## 7. 오류별 실제 코드 원인 및 확인·복구 절차

실제 백엔드 핸들러 소스코드의 에러 반환 조건에 맞추어 점검 및 조치 절차를 기술합니다:

| HTTP 상태 코드 | 실제 핸들러 발생 위치 | 코드상 발생 원인 | 확인 및 복구 절차 |
| :--- | :--- | :--- | :--- |
| **`404 Not Found`**<br>(자원 부재) | `api/notes/restore.js:54`<br><br>`api/notes/[id].js:30, 74` | 1. **복구 대상 사본 부재**: `src/backup-notes.json` 파일 및 요청 본문에 해당 메모 ID의 사본이 없음<br>2. **메모 미존재**: 요청한 메모 ID가 데이터베이스에 존재하지 않음 | 1. `src/backup-notes.json`에 등록된 유효한 사본 ID인지 확인<br>2. 메모 단건 조회/수정 시 올바른 메모 ID 경로인지 확인 |
| **`403 Forbidden`**<br>(인가 실패 / 권한 거부) | `api/notes/[id].js:37, 79`<br>`api/notes/[id].js:62`<br>`api/notes/[id].js:15`<br>`api/notes/restore.js:68`<br>`api/notes/restore.js:85` | 1. **소유자 불일치 (IDOR 차단)**: 메모의 `owner_id`가 요청자 JWT의 `authUser.userId`와 불일치함<br>2. **소유자 변경 시도 차단**: `PUT` 요청 본문의 `payload.owner_id`가 본인 ID와 다름<br>3. **자료 구역(Zone) 불일치**: 메모 API에 `notice-`, `instructor-` 접두사 자원 ID로 접근함<br>4. **복구 본문 소유자 불일치**: `api/notes/restore` 본문의 `owner_id`가 사본 소유자와 다름<br>5. **복구 요청자 소유자 불일치**: (인증 헤더 전달 시) JWT 토큰의 `userId`가 사본 소유자와 다름 | 1. 요청 헤더의 JWT가 대상 메모의 실제 작성자 계정인지 확인<br>2. 메모 수정(`PUT`) 시 본문에서 `owner_id`를 임의 변조하지 않음<br>3. 메모 API(`api/notes/:id`)에는 일반 메모 UUID만 전달하고, 공지는 `api/notices/:id`로 요청<br>4. 복구 요청 시 사본과 일치하는 `owner_id` 전달 및 본인 계정 토큰 사용 |
| **`400 Bad Request`**<br>(잘못된 요청 / 검증 실패) | `api/notes/restore.js:75`<br><br>`api/notes/restore.js:32`<br>`api/device/verify.js:25`<br>`api/notes/index.js:40` | 1. **복구 내용 해시 불일치**: 복구 요청 본문의 `contentHash`가 사본 실제 계산 SHA-256 해시와 불일치함 (변조된 사본)<br>2. **복구 ID 누락**: 복구 요청 본문에 `id`가 전달되지 않음<br>3. **기기 식별자 부적합**: `deviceId` 누락, 비문자열, 또는 8자 미만 전달 시 발생 (`approved: false`)<br>4. **메모 제목 누락**: 메모 생성(`POST`) 시 `title`이 누락되었거나 공백 문자열임 | 1. 사본 복구 시 위조되지 않은 원본 백업 데이터와 올바른 SHA-256 해시값 전달<br>2. 복구 요청 본문에 대상 `id` 포함<br>3. 기기 검증 요청 시 8자 이상의 유효한 기기 식별자 전송<br>4. 메모 작성 시 공백이 아닌 유효한 제목(`title`) 입력 |
| **`401 Unauthorized`**<br>(인증 실패) | `api/_auth.js:23`<br><br>`api/_auth.js:43` | 1. **인증 토큰 누락**: 필수 인증 API에 `Authorization` 헤더가 전달되지 않음<br>2. **토큰 무효/만료**: JWT 서명이 위조되었거나 유효기간이 지났거나 발급자/대상이 불일치함 | 1. 로그인(`POST /api/auth`)을 먼저 수행하여 정상 토큰 획득<br>2. `Authorization: Bearer <token>` 형식으로 헤더 전달<br>3. `aleph.config.json`의 `identityProvider` 설정값 일치 여부 확인 |
| **`405 Method Not Allowed`**<br>(메소드 불허) | `api/device/verify.js:6`<br>`api/events.js:111`<br>`api/notes/index.js:75`<br>`api/notes/restore.js:20` | 1. `api/device/verify`에 GET 호출<br>2. `api/events`에 POST 호출<br>3. `api/notes`에 PUT/DELETE 호출<br>4. `api/notes/restore`에 GET 호출 | 1. API 명세에 규정된 올바른 HTTP 메서드(GET, POST, PUT, DELETE)로 요청 |
| **`503` / `AUTH_PENDING`**<br>(AI 연결 대기/실패) | `api/ai/connection.js:37, 51, 65` | 1. 외부 AI 게이트웨이 응답 시간 초과(`TIMEOUT`)<br>2. 게이트웨이 전송 점검(`transportChecked: true`) 미확인 또는 계정 권한 준비 중 | 1. 자동 재시도하지 않고 화면의 「다시 점검」 버튼을 수동으로 클릭<br>2. 게이트웨이 접속 환경변수(`AI_GATEWAY_URL`, `AI_GATEWAY_TOKEN`) 확인 |
| **`시뮬레이션 거부`**<br>(판정기 가상 시나리오) | `src/decider.mjs` (`decide`) | `npm run decider:test` 실행 시 미등록 기기(`deviceRegistered: false`), 복합 이상 접속(`step_up`), 전체 목록 경로 요청에 대한 시뮬레이션 거부 | 1. 본 거부는 독립 시뮬레이션 시험의 정상 동작 결과임<br>2. `docs/DECIDER_REQUEST.md` 규칙 명세와 `src/decider.mjs`의 `RULE_IDS` 구현 대조 |
