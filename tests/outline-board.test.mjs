import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import test from "node:test";
import {
  OUTLINE_BOARD_MANUAL_COOLDOWN_MS,
  OUTLINE_BOARD_REFRESH_MS,
  OUTLINE_BOARD_SERVER_CACHE_MS,
  boardRemaining,
  changedStudentKeys,
  formatBoardDeadline,
  groupOutlineAnswers,
  normalizeOutlineBoardPayload,
  normalizeStudentOutlineBoard,
  normalizeTeacherOutlineBoard,
  readOutlineBoardResponse,
  outlinePreview,
  samlinkShortUrl,
} from "../src/lib/outline-board.ts";

// 친구 개요 모음(2026-10-10): 제출한 개요를 번호·이름과 함께 보는 공개 페이지 + 샘링크 5글자 주소.

test("새로 고침은 1분 자동, 단추는 5초 쉼, 서버는 판마다 5초에 한 번만 DB", () => {
  assert.equal(OUTLINE_BOARD_REFRESH_MS, 60_000, "학생 화면 60초 미만 폴링 금지");
  assert.equal(OUTLINE_BOARD_MANUAL_COOLDOWN_MS, 5_000);
  assert.equal(OUTLINE_BOARD_SERVER_CACHE_MS, 5_000);
});

test("개요 답을 처음·가운데·끝으로 묶고 빈 칸은 뺀다(옛 개요의 question 도 읽는다)", () => {
  const sections = groupOutlineAnswers([
    { section: "처음", label: "소개할 곳", answer: "우리 동네 공원" },
    { section: "가운데", label: "볼거리", answer: "  " },
    { section: "끝", question: "하고 싶은 말", answer: "놀러 와!" },
    { section: "엉뚱", label: "?", answer: "처음으로" },
    "깨진 값",
  ]);
  assert.deepEqual(sections.처음.map((item) => item.answer), ["우리 동네 공원", "처음으로"]);
  assert.equal(sections.가운데.length, 0);
  assert.deepEqual(sections.끝[0], { label: "하고 싶은 말", answer: "놀러 와!" });
});

test("열린 판만 학생 목록을 싣고, 닫힘·만료·없음은 상태만", () => {
  const open = normalizeOutlineBoardPayload({
    state: "open", topic: "우리 동네", expires_at: "2026-10-17T06:00:00Z",
    students: [{ key: "a1", number: 3, name: "김민준", updated_at: "t1", answers: [{ section: "처음", label: "x", answer: "공원이 커요" }] }],
  });
  assert.equal(open.state, "open");
  assert.equal(open.students[0].name, "김민준");
  assert.equal(outlinePreview(open.students[0]), "공원이 커요");
  assert.deepEqual(normalizeOutlineBoardPayload({ state: "expired", students: [{ key: "x" }] }), { state: "expired" });
  assert.deepEqual(normalizeOutlineBoardPayload({ state: "hacked" }), { state: "missing" });
  assert.deepEqual(normalizeOutlineBoardPayload(null), { state: "missing" });
});

test("새로 고침 응답은 서버가 정리한 모양 그대로 읽는다(다시 정리하면 개요가 빈다)", () => {
  const server = normalizeOutlineBoardPayload({
    state: "open", topic: "학예회", expires_at: "2026-10-17T06:00:00Z",
    students: [{ key: "k2", number: 2, name: "문민우", updated_at: "t1", answers: [
      { section: "가운데", label: "피곤했던 순간", answer: "춤 연습" },
      { section: "끝", label: "다짐", answer: "열심히" },
    ] }],
  });
  const roundTrip = readOutlineBoardResponse(JSON.parse(JSON.stringify(server)));
  assert.deepEqual(roundTrip, server);
  assert.equal(roundTrip.students[0].sections.가운데[0].answer, "춤 연습");
  assert.equal(changedStudentKeys(server.students, roundTrip.students).size, 0, "같은 판을 다시 받으면 새 표시 없음");
  assert.deepEqual(readOutlineBoardResponse({ state: "closed" }), { state: "closed" });
});

test("만료 표시는 서울 시각, 오늘 닫히면 강조", () => {
  assert.equal(formatBoardDeadline("2026-10-17T06:00:00Z"), "10월 17일(토) 오후 3:00");
  const now = new Date("2026-10-12T01:00:00Z"); // 서울 10월 12일 오전 10시
  assert.deepEqual(boardRemaining("2026-10-17T06:00:00Z", now), { label: "D-5", urgent: false });
  assert.deepEqual(boardRemaining("2026-10-13T06:00:00Z", now), { label: "D-1", urgent: true });
  assert.deepEqual(boardRemaining("2026-10-12T08:00:00Z", now), { label: "오늘 닫혀요", urgent: true });
  assert.equal(boardRemaining("2026-10-12T00:00:00Z", now), null);
});

test("새로 들어오거나 고쳐진 카드만 표시(첫 읽기는 표시 없음)", () => {
  const before = [{ key: "a", updatedAt: "1" }, { key: "b", updatedAt: "1" }];
  const after = [{ key: "a", updatedAt: "1" }, { key: "b", updatedAt: "2" }, { key: "c", updatedAt: "1" }];
  assert.deepEqual([...changedStudentKeys(before, after)].sort(), ["b", "c"]);
  assert.equal(changedStudentKeys(null, after).size, 0);
});

test("선생님 판 정보와 샘링크 주소", () => {
  assert.equal(normalizeTeacherOutlineBoard(null), null);
  assert.equal(normalizeTeacherOutlineBoard({ state: "open" }), null);
  assert.deepEqual(normalizeTeacherOutlineBoard({ state: "open", slug: "k7m2q", expires_at: "e", created_at: "c" }),
    { state: "open", slug: "k7m2q", expiresAt: "e", createdAt: "c" });
  assert.equal(samlinkShortUrl("k7m2q"), "https://샘링크.kr/k7m2q");
});

test("공개 페이지는 로그인 없이 열리고 검색·캐시에 남지 않는다", async () => {
  const [proxy, page, route, client] = await Promise.all([
    readFile("src/proxy.ts", "utf8"),
    readFile("src/app/board/[token]/page.tsx", "utf8"),
    readFile("src/app/board/[token]/data/route.ts", "utf8"),
    readFile("src/app/board/[token]/board-client.tsx", "utf8"),
  ]);
  assert.match(proxy, /"\/board"/);
  assert.match(page, /robots:\s*\{\s*index:\s*false/);
  const metadataBlock = page.slice(page.indexOf("export const metadata"), page.indexOf("export default"));
  assert.doesNotMatch(metadataBlock, /student|name|이름|topic/i, "미리보기 메타데이터에 학생·주제 정보를 싣지 않는다");
  assert.match(route, /no-store/);
  assert.match(route, /noindex/);
  assert.match(client, /visibilitychange/, "다른 탭이면 멈춘다");
  assert.doesNotMatch(client, /supabase|realtime|channel\(/i, "학생 상시 실시간 연결을 쓰지 않는다");
  assert.match(client, /ArrowLeft/);
  assert.match(client, /requestFullscreen/);
});

test("옛 QR 공유 페이지는 닫고, 로그인 없이 결과를 꺼내는 서버 기능은 없다", async () => {
  const [share, studentActions, livePanel] = await Promise.all([
    readFile("src/app/share/[sessionId]/page.tsx", "utf8"),
    readFile("src/app/actions/student-actions.ts", "utf8"),
    readFile("src/app/dashboard/room/[id]/live-student-panel.tsx", "utf8"),
  ]);
  assert.doesNotMatch(share, /createSupabaseAdminClient|student_sessions/);
  assert.match(share, /더 이상 쓰지 않는 주소/);
  assert.doesNotMatch(studentActions, /getShareableResult/);
  await assert.rejects(access("src/app/share/[sessionId]/copy-button.tsx"));
  assert.ok(livePanel.length > 0);
});

test("선생님 상자: 1주 늘리기·새 주소(확인)·끄기(확인)·샘링크 관리, 방 만들기 기본 꺼짐", async () => {
  const [panel, newRoom, createRoom] = await Promise.all([
    readFile("src/app/dashboard/room/[id]/outline-board-panel.tsx", "utf8"),
    readFile("src/app/dashboard/room/new/page.tsx", "utf8"),
    readFile("src/app/actions/room-actions.ts", "utf8"),
  ]);
  assert.match(panel, /1주 늘리기/);
  assert.match(panel, /지금 주소는 바로 닫혀요/);
  assert.match(panel, /samlink-connect=1/);
  assert.match(panel, /누구나 볼 수 있어요/);
  assert.match(newRoom, /share_board: false/);
  assert.match(newRoom, /주소를 아는 사람은 누구나 볼 수 있어요/);
  assert.match(createRoom, /share_outline_board[\s\S]{0,200}open_outline_board_v1/);
});

test("학생 개요 화면 띠: 열린 판·기간 지난 판만, 긴 번호가 없거나 끈 판이면 띠 없음", () => {
  const token = "a".repeat(48);
  assert.deepEqual(normalizeStudentOutlineBoard({ state: "open", slug: "k7m2q", expires_at: "e", token }),
    { state: "open", slug: "k7m2q", expiresAt: "e", token });
  assert.equal(normalizeStudentOutlineBoard({ state: "expired", slug: "k7m2q", token }).state, "expired");
  assert.equal(normalizeStudentOutlineBoard({ state: "closed", slug: "k7m2q", token }), null);
  assert.equal(normalizeStudentOutlineBoard({ state: "open", slug: "k7m2q", token: "짧음" }), null);
  assert.equal(normalizeStudentOutlineBoard(null), null);
});

test("학생 쓰는 화면·완성 화면에 띠, 내 활동 확인 뒤에만 판을 주고 상시 폴링은 없다", async () => {
  const [activity, result, link, actions] = await Promise.all([
    readFile("src/app/room/[id]/activity/page.tsx", "utf8"),
    readFile("src/app/room/[id]/result/page.tsx", "utf8"),
    readFile("src/components/outline-board-link.tsx", "utf8"),
    readFile("src/app/actions/outline-board-actions.ts", "utf8"),
  ]);
  assert.match(activity, /<OutlineBoardLink[^>]*variant="strip"/);
  assert.match(result, /<OutlineBoardLink[^>]*variant="card"/);
  assert.match(link, /기간이 끝났어요/);
  assert.match(link, /role="dialog"/);
  assert.match(link, /embedded/);
  assert.doesNotMatch(link, /setInterval|setTimeout/, "띠 상태는 들어올 때·모달을 닫을 때만 읽는다");
  const studentFn = actions.slice(actions.indexOf("export async function getStudentOutlineBoard"));
  assert.match(studentFn, /ownsIntegratedStudentSession[\s\S]*get_student_outline_board_v1/);
});
