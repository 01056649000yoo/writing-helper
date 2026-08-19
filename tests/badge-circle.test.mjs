import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function collectSources(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectSources(full));
    else if (/\.(tsx|ts)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const sources = await collectSources("src");
const contents = await Promise.all(sources.map(async (file) => [file, await readFile(file, "utf8")]));

test("한 태그에 display 유틸리티를 두 개 쓰지 않는다", () => {
  // 개요 짜기의 `처음/가운데/끝` 번호가 `inline-block`과 `flex`를 함께 써서 가운데 정렬이 깨져 있었다.
  // 둘 다 display 라 나중에 정의된 하나만 이기고 다른 하나는 조용히 무시된다(2026-08-20).
  const conflicts = [];
  for (const [file, source] of contents) {
    for (const match of source.matchAll(/className="([^"]*)"/g)) {
      const classes = match[1].split(/\s+/);
      const displays = classes.filter((name) => (
        ["block", "inline-block", "inline", "flex", "inline-flex", "grid", "inline-grid"].includes(name)
      ));
      if (displays.length > 1) conflicts.push(`${file}: ${displays.join(" + ")}`);
    }
  }
  assert.deepEqual(conflicts, [], `display 유틸리티 충돌:\n${conflicts.join("\n")}`);
});

test("번호·아이콘 동그라미는 공용 배지 하나를 쓴다", async () => {
  const badge = await readFile("src/components/badge-circle.tsx", "utf8");
  // 크기와 정렬은 컴포넌트가 정한다 — 부르는 쪽은 색만 넘긴다.
  assert.match(badge, /inline-flex shrink-0 items-center justify-center rounded-full/);

  // 손으로 그린 원형 번호 배지가 다시 생기지 않게 막는다.
  const handMade = contents
    .filter(([file]) => !file.endsWith("badge-circle.tsx"))
    .flatMap(([file, source]) => (
      [...source.matchAll(/className="([^"]*rounded-full[^"]*)"/g)]
        .filter((match) => /items-center/.test(match[1]) && /justify-center/.test(match[1]) && /\bh-[0-9]/.test(match[1]))
        .map(() => file)
    ));
  assert.deepEqual([...new Set(handMade)], [], `공용 배지를 쓰지 않은 곳: ${[...new Set(handMade)].join(", ")}`);
});
