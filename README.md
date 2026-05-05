## Development

개발 서버 실행:

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`으로 확인할 수 있습니다.

## Production On Mac Mini

이 프로젝트는 Vercel 대신 맥미니 로컬 호스팅 기준으로 운영할 수 있습니다.

운영 실행:

```bash
npm install
npm run build
npm run start
```

상시 실행 권장:

```bash
pm2 start ecosystem.config.cjs
```

리버스 프록시 예시는 [Caddyfile.example](/Users/seunghyeonmaegmini/writing-helper/Caddyfile.example:1), 운영 문서는 [docs/mac-mini-hosting.md](/Users/seunghyeonmaegmini/writing-helper/docs/mac-mini-hosting.md:1)에 정리되어 있습니다.

권장 포트 분리:

- 개발: `3000`
- 운영: `3000`

## GitHub Auto Deploy

GitHub webhook으로 맥미니 서버를 자동 동기화할 수 있습니다.

- 엔드포인트: `/api/github-deploy`
- 대상 이벤트: `push`
- 대상 브랜치: `main`
- 서명 방식: `x-hub-signature-256`

필수 환경 변수:

```bash
GITHUB_WEBHOOK_SECRET=...
GITHUB_WEBHOOK_REPO=01056649000yoo/writing-helper
GITHUB_WEBHOOK_REF=refs/heads/main
```

웹훅이 들어오면 [scripts/deploy-from-github.sh](/Users/seunghyeonmaegmini/writing-helper/scripts/deploy-from-github.sh:1)가 실행되어 아래 순서로 반영됩니다.

1. `git pull --ff-only origin main`
2. `npm install`
3. `npm run build`
4. `npx pm2 restart writing-helper --update-env`

로그 파일:

- [logs/deploy-webhook.log](/Users/seunghyeonmaegmini/writing-helper/logs/deploy-webhook.log:1)

## Notes

- Next.js 16 기준 Node 서버 배포는 `npm run build` + `npm run start` 구조를 사용합니다.
- 운영에서는 `npm run dev`가 아니라 `pm2`로 `start` 프로세스를 유지하는 방식을 권장합니다.
