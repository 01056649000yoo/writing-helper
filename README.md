## Development

```bash
npm install
npm run dev
```

로컬 개발은 `http://localhost:3000`에서 확인합니다.

## 아지트 통합 대상

연구소에서 계속 운영하고 아지트 글쓰기 결과로 연결할 활동은 아래 다섯 가지입니다.

- 글 개요 짜기 (`outline_builder`)
- 질문 만들기 (`question_generator`)
- 좋은 질문 고르기 (`question_voting`)
- 한줄모아 (`one_line_share`)
- 한자 활용 문장 만들기 (`hanja_writing`)

각 활동 매니페스트의 `integration` 항목이 표준 결과 종류와 스키마 버전을 선언합니다. 새 활동을 통합 대상으로 추가할 때도 이 계약을 먼저 등록하고, 아지트는 활동별 화면이나 RPC가 아니라 공통 결과 조회 경로를 사용합니다.

과학·도덕·낱말 게임의 실행 화면과 서버 코드는 제거했지만 기존 DB 테이블과 과거 데이터는 롤백과 이력 확인을 위해 삭제하지 않습니다.

### 통합 학급·학생 원장

통합 `/lab`은 별도의 학급이나 학생 명단을 만들지 않습니다. 끄적끄적 아지트의 `public.classes`와
`public.students`가 유일한 원장이며, 아지트에서 변경한 현재 활성 명단을 화면을 열 때 직접 읽습니다.

- 신규 활동은 `writing_helper.rooms.agit_class_id`로 아지트 학급을 직접 참조합니다.
- 학생 결과는 `writing_helper.student_sessions.agit_student_id`로 아지트 학생을 직접 참조합니다.
- 번호와 이름은 활동 당시 표시 스냅샷으로 유지합니다.
- 구 `writing_helper.classes`·`class_students`는 기존 자료와 롤백용 `helper.` 호환을 위해 삭제하지 않습니다.

## Production: Docker

이 앱은 운영 시 Docker Compose 기준으로 실행합니다.

```bash
BUILD_VERSION=$(git rev-parse --short HEAD) docker compose --env-file .env.local build
docker compose --env-file .env.local up -d
```

중지:

```bash
docker compose down
```

### 통합 DB `/lab` 병행 컨테이너

기존 `helper.` 운영 컨테이너는 롤백용으로 유지하고, 통합 DB를 보는 이미지는 별도 Compose 프로젝트와
`127.0.0.1:3001`에서 실행합니다. 통합 Supabase 환경파일의 값을 복사하지 않고 그 파일을 직접 읽습니다.

```bash
docker compose --env-file /Users/seunghyeonmaegmini/agit-supabase/.env -f docker-compose.lab.yml build
docker compose --env-file /Users/seunghyeonmaegmini/agit-supabase/.env -f docker-compose.lab.yml up -d --remove-orphans
curl --fail http://127.0.0.1:3001/lab/login
```

- Next.js `basePath`는 `/lab`로 빌드되며 루트형 기존 이미지와 섞어 쓰지 않습니다.
- 통합 컨테이너는 `agit_default` 비공개 네트워크만 사용하고, 통합 Kong과 아지트 AI 함수로 내부 연결합니다.
- 통합 환경에서는 별도 교사 회원가입을 화면과 서버 액션 양쪽에서 차단합니다.
- Caddy는 `/lab*`을 `127.0.0.1:3001`로 전달하되 경로를 제거하는 `handle_path`는 사용하지 않습니다.
- 전환 전까지 `helper.` 도메인과 3000번 기존 컨테이너를 유지합니다.

핵심 원칙:

- 앱 자체는 Docker 컨테이너로만 실행
- PM2, LaunchAgent, 수동 `npm run start`로 이 앱을 다시 띄우지 않음
- 공개 도메인은 Docker 프록시가 `writing-helper-app`만 보게 구성

## GitHub Actions 자동 배포

자동 배포 흐름:

1. GitHub `main` 푸시
2. 맥미니의 GitHub Actions 자체 호스팅 러너가 체크아웃
3. `npm ci`와 `npm run lint` 검사
4. 기존 연구소와 통합 `/lab` Docker 이미지 빌드
5. 두 Compose 스택을 각각 교체
6. 3000번 기존 로그인과 3001번 `/lab/login`을 각각 확인

## UI 디자인 계약

연구소는 별도 Next.js 앱으로 유지하지만 교사용 화면은 끄적끄적 아지트와 같은 디자인 계약을 사용합니다.

- 공통 색상·간격·모서리·그림자 토큰과 셸 클래스는 `src/app/globals.css`에서 관리합니다.
- 교사용 상단바와 현재 메뉴 표시는 `src/app/dashboard/layout.tsx`와 `dashboard-nav.tsx`가 한 번만 렌더링합니다.
- 활동별 색상은 다섯 활동을 빠르게 구별하는 보조 표현으로만 쓰고, 기본 버튼·카드·페이지 배경은 공통 토큰을 사용합니다.
- 공통 토큰을 바꿀 때는 아지트 `src/styles/design-system.css`와 함께 확인하고 `npm test`의 UI 계약 검사를 통과시킵니다.

### Required Environment Variables

러너 호스트의 `/Users/seunghyeonmaegmini/writing-helper/.env.local`에 있어야 하는 값:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_URL=...
SUPABASE_INTERNAL_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

통합 `/lab` 배포는 `/Users/seunghyeonmaegmini/agit-supabase/.env`의 기존 `ANON_KEY`와
`SERVICE_ROLE_KEY`를 Compose 치환에 사용합니다. 값을 연구소 저장소나 `.env.local`로 복사하지 않습니다.

## Notes

- `.env.local` 전체는 Docker 빌드 문맥에서 제외됩니다. 브라우저에 필요한 `NEXT_PUBLIC_*` 값만 빌드 인자로 전달하고 서비스 역할 키는 컨테이너 실행 시에만 주입합니다.
- 연구소는 별도 OpenAI 키를 저장하지 않습니다. AI 요청은 연구소 로그인 세션을 다시 검증한 뒤 비공개 Docker 네트워크에서 아지트의 `vibe-ai`로 전달합니다.
