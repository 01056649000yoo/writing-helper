# 맥미니 로컬 호스팅 가이드

이 프로젝트는 Next.js Node 서버로 배포할 수 있으므로, 맥미니에서 아래 구조로 운영하는 것이 가장 단순합니다.

- 앱 빌드: `npm run build`
- 앱 실행: `npm run start`
- 프로세스 유지: `pm2`
- 외부 HTTPS 진입: `Caddy`
- DB/백엔드: 로컬 Supabase

권장 포트 분리:

- 개발 서버: `3000`
- 운영 서버: `3000`

## 1. 운영 실행 방식

개발용 `npm run dev` 대신 운영에서는 반드시 아래 순서로 실행합니다.

```bash
npm install
npm run build
npm run start
```

Next.js 16 문서 기준으로 Node.js 서버 배포는 `build` + `start` 스크립트가 있으면 모든 기능을 지원합니다.

## 2. PM2로 상시 실행

이 저장소 루트에 `ecosystem.config.cjs`를 추가해 두었습니다.

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

자주 쓰는 명령:

```bash
pm2 status
pm2 logs writing-helper
pm2 restart writing-helper
pm2 stop writing-helper
```

## 3. 새 코드 반영 절차

GitHub에서 최신 코드를 받아 운영 반영할 때는 아래 순서가 안전합니다.

```bash
cd /Users/seunghyeonmaegmini/writing-helper
git pull origin main
npm install
npm run build
pm2 restart writing-helper
```

의존성이 바뀌지 않았더라도 `npm run build`는 항상 다시 실행하는 편이 좋습니다.

## 4. Caddy로 도메인 연결

`Caddyfile.example`를 기준으로 실제 Caddy 설정 파일을 만들면 됩니다.

핵심 설정:

```caddy
{
  admin off
}

helper.끄적끄적아지트.site {
  encode gzip zstd
  reverse_proxy 127.0.0.1:3000
}
```

이 구조의 장점:

- HTTPS 인증서를 Caddy가 자동 관리
- 외부는 `443` 포트로 접속
- 내부 Next 앱 운영 프로세스는 `3000` 포트를 사용

## 5. DNS와 공유기

외부 접속이 되려면 다음이 맞아야 합니다.

- `helper.끄적끄적아지트.site` DNS가 맥미니가 있는 공인 IP를 가리킴
- 공유기에서 `80`, `443` 포트를 맥미니로 포워딩
- 맥미니 방화벽이 해당 포트를 막지 않음

## 6. 운영 체크리스트

- `.env.local`이 운영용 값으로 채워져 있는지 확인
- 로컬 Supabase 컨테이너가 재부팅 후 자동으로 올라오는지 확인
- `pm2 status`에서 `writing-helper`가 online 상태인지 확인
- `curl http://127.0.0.1:3000`로 내부 응답 확인
- 브라우저에서 `https://helper.끄적끄적아지트.site` 접속 확인

## 7. 추천 운영 순서

1. 로컬에서 `npm run build` 성공 확인
2. `pm2 start ecosystem.config.cjs`
3. 내부 주소 `http://127.0.0.1:3000` 확인
4. Caddy 연결
5. DNS/포트포워딩 확인
6. 외부 도메인 접속 확인

## 8. 지금 구조에서 중요한 점

현재 이 프로젝트는 Vercel보다 맥미니 로컬 호스팅이 더 잘 맞습니다.

- 로컬 Supabase와 같이 묶여 있음
- 학생 참여형 세션 구조라 내부 네트워크 테스트가 잦음
- 이미 맥미니에서 앱이 실행 가능한 상태임

즉 운영 기준은 `Vercel 배포`가 아니라 `맥미니에서 Next 서버와 Supabase를 안정적으로 상시 유지`하는 쪽으로 잡는 것이 맞습니다.
