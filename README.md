## Development

```bash
npm install
npm run dev
```

로컬 개발은 `http://localhost:3000`에서 확인합니다.

## Production: Docker

이 앱은 운영 시 Docker Compose 기준으로 실행합니다.

```bash
BUILD_VERSION=$(git rev-parse --short HEAD) docker compose build
docker compose up -d
```

중지:

```bash
docker compose down
```

핵심 원칙:

- 앱 자체는 Docker 컨테이너로만 실행
- PM2, LaunchAgent, 수동 `npm run start`로 이 앱을 다시 띄우지 않음
- 공개 도메인은 Docker 프록시가 `writing-helper-app`만 보게 구성

## GitHub Auto Deploy

자동 배포 흐름:

1. GitHub `main` 푸시
2. 맥미니 호스트의 webhook 수신기 실행
3. `git pull --ff-only origin main`
4. `docker compose build`
5. `docker compose up -d --remove-orphans`
6. 이전 컨테이너 교체

### Host Webhook Receiver

앱 내부 `/api/github-deploy`는 더 이상 실제 배포를 담당하지 않습니다.  
배포는 호스트에서 별도 수신기가 받습니다.

관련 파일:

- [scripts/deploy-webhook-server.mjs](/Users/seunghyeonmaegmini/writing-helper/scripts/deploy-webhook-server.mjs:1)
- [scripts/run-deploy-webhook.sh](/Users/seunghyeonmaegmini/writing-helper/scripts/run-deploy-webhook.sh:1)
- [scripts/deploy-from-github.sh](/Users/seunghyeonmaegmini/writing-helper/scripts/deploy-from-github.sh:1)
- [deploy/com.writing-helper.deploy-webhook.plist.example](/Users/seunghyeonmaegmini/writing-helper/deploy/com.writing-helper.deploy-webhook.plist.example:1)
- [deploy/caddy-webhook-snippet.example](/Users/seunghyeonmaegmini/writing-helper/deploy/caddy-webhook-snippet.example:1)

기본 수신 주소:

- 로컬: `http://127.0.0.1:4010/health`
- webhook endpoint: `http://127.0.0.1:4010/github-deploy`

공개 도메인에서 받으려면 프록시에 아래 경로를 연결합니다.

- `https://helper.xn--vz0ba242ncqcba79xhwx.site/__deploy/github/github-deploy`

### Required Environment Variables

`.env.local`에 있어야 하는 값:

```bash
GITHUB_WEBHOOK_SECRET=...
GITHUB_WEBHOOK_REPO=01056649000yoo/writing-helper
GITHUB_WEBHOOK_REF=refs/heads/main
DEPLOY_WEBHOOK_HOST=127.0.0.1
DEPLOY_WEBHOOK_PORT=4010
```

## Deploy Logs

- 앱 배포 로그: [logs/deploy-webhook.log](/Users/seunghyeonmaegmini/writing-helper/logs/deploy-webhook.log:1)

## Notes

- 로그인 하단의 `deploy <commit>` 표기로 실제 배포 커밋을 확인할 수 있습니다.
- Docker 빌드에서는 `NEXT_PUBLIC_BUILD_VERSION`이 직접 주입되고, 로컬 빌드에서는 Git 해시를 자동으로 읽습니다.
