FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
ARG BUILD_VERSION
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_BASE_PATH=""
ARG NEXT_PUBLIC_LAB_SIGNUP_ENABLED="true"
ARG NEXT_PUBLIC_LAB_SSO_ENABLED="false"
RUN test -n "$BUILD_VERSION"
ENV NEXT_PUBLIC_BUILD_VERSION=${BUILD_VERSION}
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
ENV NEXT_PUBLIC_LAB_SIGNUP_ENABLED=${NEXT_PUBLIC_LAB_SIGNUP_ENABLED}
ENV NEXT_PUBLIC_LAB_SSO_ENABLED=${NEXT_PUBLIC_LAB_SSO_ENABLED}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
ARG BUILD_VERSION
ARG NEXT_PUBLIC_BASE_PATH=""
ARG NEXT_PUBLIC_LAB_SIGNUP_ENABLED="true"
ARG NEXT_PUBLIC_LAB_SSO_ENABLED="false"
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_PUBLIC_BUILD_VERSION=${BUILD_VERSION}
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
ENV NEXT_PUBLIC_LAB_SIGNUP_ENABLED=${NEXT_PUBLIC_LAB_SIGNUP_ENABLED}
ENV NEXT_PUBLIC_LAB_SSO_ENABLED=${NEXT_PUBLIC_LAB_SSO_ENABLED}

# 실행 이미지에서 패키지 관리자를 걷어낸다 (2026-09-02).
#
# 왜: 이 이미지는 `node server.js` 하나로 돈다 — npm·yarn·corepack 은 빌드 단계에서만 쓰고
# 실행할 때는 한 번도 부르지 않는데, node 베이스 이미지에 딸려 와 그대로 남아 있었다.
# 그 안의 npm 번들 `tar` 때문에 월간 이미지 취약점 검사에 CRITICAL 이 계속 잡혔다
# (압축을 푸는 통로가 없어 실제 위험은 아니지만, 잡음이 진짜 볼 것을 가린다).
# 없는 것에 대해서는 매달 다시 판단할 일이 없다.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /opt/yarn-* /usr/local/bin/npm /usr/local/bin/npx \
           /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
