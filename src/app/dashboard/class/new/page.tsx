"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { createClass } from "@/app/actions/class-actions";

const GRADE_LEVELS = ["저학년", "중학년", "고학년"] as const;
const COL_SIZE = 10;

export default function NewClassPage() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [names, setNames] = useState<string[]>([""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const filledCount = names.filter(n => n.trim()).length;
  const displayCount = Math.max(filledCount + 1, names.length);
  const fields = Array.from({ length: displayCount }, (_, i) => names[i] ?? "");

  const GROUP = COL_SIZE * 2;
  const groups: string[][] = [];
  for (let i = 0; i < fields.length; i += GROUP) {
    groups.push(fields.slice(i, i + GROUP));
  }

  function handleChange(idx: number, val: string) {
    setNames(prev => { const next = [...prev]; next[idx] = val; return next; });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      const next = inputRefs.current[idx + 1];
      if (next) { next.focus(); }
      else {
        setNames(prev => [...prev, ""]);
        setTimeout(() => inputRefs.current[idx + 1]?.focus(), 0);
      }
    }
    if (e.key === "Backspace" && names[idx] === "" && idx > 0) {
      e.preventDefault();
      setNames(prev => prev.filter((_, i) => i !== idx));
      setTimeout(() => inputRefs.current[idx - 1]?.focus(), 0);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, idx: number) {
    const text = e.clipboardData.getData("text");
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) return;
    e.preventDefault();
    setNames(prev => {
      const next = [...prev];
      lines.forEach((line, i) => { next[idx + i] = line; });
      return next;
    });
    setTimeout(() => inputRefs.current[idx + lines.length]?.focus(), 0);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("students", names.filter(n => n.trim()).join("\n"));
    const result = await createClass(fd);
    if (result?.error) { setError(result.error); setPending(false); }
  }

  const setRef = useCallback((el: HTMLInputElement | null, idx: number) => {
    inputRefs.current[idx] = el;
  }, []);

  return (
    <main className="lab-page">
      <div className="lab-page__content lab-page__content--narrow">
        <Link href="/dashboard" className="lab-breadcrumb">← 학급 목록</Link>
        <div className="lab-panel lab-panel--raised p-6 sm:p-10">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🏫</div>
            <h1 className="text-2xl font-bold text-gray-800">새 학급 만들기</h1>
            <p className="text-base text-gray-500 mt-1">학급을 만들고 학생 명단을 등록하세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-7">
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">학급 이름</label>
              <input name="name" required placeholder="예) 4학년 2반"
                className="w-full px-5 py-4 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>

            <div>
              <label className="block text-base font-medium text-gray-700 mb-3">학년 수준</label>
              <div className="grid grid-cols-3 gap-3">
                {GRADE_LEVELS.map(grade => (
                  <label key={grade}
                    className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-3 cursor-pointer has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50">
                    <input type="radio" name="grade_level" value={grade} defaultChecked={grade === "중학년"}
                      className="text-indigo-500 shrink-0 w-4 h-4" />
                    <span className="text-base text-gray-700">{gradeLabel(grade)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-base font-medium text-gray-700">학생 명단</label>
                <span className="text-sm text-gray-400">
                  {filledCount > 0 ? `${filledCount}명 입력됨` : "이름 입력 후 Enter"}
                </span>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {groups.map((group, gi) => (
                  <div key={gi} className={`grid grid-cols-2 divide-x divide-gray-100 ${gi > 0 ? "border-t border-gray-100" : ""}`}>
                    <div className="divide-y divide-gray-50">
                      {group.slice(0, COL_SIZE).map((val, li) => {
                        const idx = gi * GROUP + li;
                        return (
                          <StudentRow key={idx} num={idx + 1} value={val}
                            inputRef={el => setRef(el, idx)}
                            onChange={v => handleChange(idx, v)}
                            onKeyDown={e => handleKeyDown(e, idx)}
                            onPaste={e => handlePaste(e, idx)} />
                        );
                      })}
                    </div>
                    <div className="divide-y divide-gray-50">
                      {group.slice(COL_SIZE).map((val, ri) => {
                        const idx = gi * GROUP + COL_SIZE + ri;
                        return (
                          <StudentRow key={idx} num={idx + 1} value={val}
                            inputRef={el => setRef(el, idx)}
                            onChange={v => handleChange(idx, v)}
                            onKeyDown={e => handleKeyDown(e, idx)}
                            onPaste={e => handlePaste(e, idx)} />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-400 mt-2">Enter로 다음 칸 이동 · 붙여넣기 지원</p>
            </div>

            {error && <p className="text-red-500 text-base bg-red-50 p-4 rounded-xl">{error}</p>}

            <button type="submit" disabled={pending}
              className="lab-button lab-button--primary w-full min-h-13 text-base disabled:opacity-50">
              {pending ? "학급 만드는 중..." : "✅ 학급 만들기"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function StudentRow({ num, value, inputRef, onChange, onKeyDown, onPaste }: {
  num: number;
  value: string;
  inputRef: (el: HTMLInputElement | null) => void;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className="text-sm text-gray-300 w-6 text-right shrink-0">{num}</span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        className="flex-1 text-base text-gray-700 bg-transparent focus:outline-none py-0.5 min-w-0"
        placeholder={value === "" ? "이름" : ""}
      />
    </div>
  );
}

function gradeLabel(grade: string) {
  const map: Record<string, string> = {
    "저학년": "🌱 저학년 (1~2학년)",
    "중학년": "🌿 중학년 (3~4학년)",
    "고학년": "🌳 고학년 (5~6학년)",
  };
  return map[grade] ?? grade;
}
