#!/bin/bash
# 끄적끄적아지트 길잡이 — 포트 80 → 3002 리다이렉트 설정
# sudo로 실행하세요: sudo bash setup-port-redirect.sh

echo "rdr pass on en0 proto tcp from any to any port 80 -> 127.0.0.1 port 3002" > /etc/pf.anchors/writing-helper

# pf.conf에 anchor 추가 (이미 있으면 스킵)
if ! grep -q "writing-helper" /etc/pf.conf; then
  echo '
# writing-helper 포트 리다이렉트
rdr-anchor "writing-helper"
load anchor "writing-helper" from "/etc/pf.anchors/writing-helper"' >> /etc/pf.conf
fi

# pf 활성화 및 룰 로드
pfctl -e 2>/dev/null || true
pfctl -f /etc/pf.conf

echo "✅ 포트 80 → 3002 리다이렉트 설정 완료"
echo "   외부에서 http://helper.끄적끄적아지트.site 접속 가능"
echo ""
echo "⚠️  공유기에서 포트포워딩도 확인하세요:"
echo "   외부 포트 80 → 내부 192.168.219.102:80"
