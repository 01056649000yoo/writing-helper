"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createScienceRoom } from "@/app/actions/science-actions";
import {
  SENSE_META,
  PRESET_MEASUREMENTS,
  VARIABLE_CARD_META,
  type SenseType,
  type VariableCardType,
} from "@/types/science";

const ALL_SENSES: SenseType[] = ["sight", "smell", "hearing", "touch"];
const ALL_VARIABLES: VariableCardType[] = ["temperature", "amount", "material", "time"];

function Toggle({
  name,
  label,
  desc,
  defaultChecked = true,
}: {
  name: string;
  label: string;
  desc?: string;
  defaultChecked?: boolean;
}) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer group">
      <div>
        <p className="text-sm font-semibold text-gray-700 group-hover:text-indigo-600 transition-colors">{label}</p>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      <div
        onClick={() => setOn((v) => !v)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${on ? "bg-indigo-500" : "bg-gray-200"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? "translate-x-5" : ""}`} />
        <input type="checkbox" name={name} value="on" checked={on} onChange={() => {}} className="sr-only" />
      </div>
    </label>
  );
}

function CheckCard({
  name,
  value,
  emoji,
  label,
  defaultChecked = true,
}: {
  name: string;
  value: string;
  emoji: string;
  label: string;
  defaultChecked?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <button
      type="button"
      onClick={() => setChecked((v) => !v)}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
        checked
          ? "bg-indigo-50 border-indigo-300 text-indigo-700"
          : "bg-white border-gray-200 text-gray-400"
      }`}
    >
      <span>{emoji}</span>
      <span>{label}</span>
      {checked && <input type="hidden" name={name} value={value} />}
    </button>
  );
}

export default function NewScienceRoomPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await createScienceRoom(fd);
    if ("error" in result) {
      setError(result.error ?? "오류가 발생했습니다.");
      setPending(false);
    } else {
      router.push(`/dashboard/science/${result.roomId}`);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-sky-100 p-6">
      <div className="max-w-2xl mx-auto pt-8 pb-16">
        <Link href="/dashboard" className="text-cyan-600 text-sm hover:underline">
          ← 대시보드로
        </Link>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* 헤더 */}
          <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🔬</span>
              <div>
                <p className="text-xs font-semibold text-cyan-600">과목별 글쓰기 활동</p>
                <h1 className="text-2xl font-bold text-gray-800">관찰하고 추론하기</h1>
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-1">관찰 → 추론 → 질문 3단계로 과학적 사고를 글로 옮기는 활동입니다.</p>
          </div>

          {/* 기본 정보 */}
          <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8 space-y-5">
            <h2 className="text-base font-bold text-gray-700 flex items-center gap-2">
              📌 기본 정보
            </h2>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-600">활동 제목</label>
              <input
                name="title"
                required
                placeholder="예) 양초 연소 관찰 글쓰기"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:bg-white transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-600">실험·관찰 주제</label>
              <input
                name="topic"
                required
                placeholder="예) 양초가 타는 동안 무슨 일이 일어날까?"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:bg-white transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-600">학생 안내문 <span className="text-gray-400 font-normal">(선택)</span></label>
              <textarea
                name="instructions"
                rows={3}
                placeholder="예) 양초에 불을 붙이고 2분 동안 관찰하세요. 색, 모양, 냄새 변화를 놓치지 마세요!"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:bg-white transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-gray-600">활동 시간</label>
              <select
                name="duration_hours"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:bg-white transition"
              >
                <option value="1">1시간</option>
                <option value="2" selected>2시간</option>
                <option value="4">4시간</option>
                <option value="8">당일 (8시간)</option>
              </select>
            </div>
          </div>

          {/* 1단계 설정 */}
          <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8 space-y-6">
            <h2 className="text-base font-bold text-gray-700">🔍 1단계 관찰 설정</h2>

            <Toggle name="use_before_after" label="변하기 전·후 카드" desc="변화가 있는 실험에서 대비 구조로 관찰하게 합니다" />
            <Toggle name="use_drawing" label="그림 그리기" desc="태블릿 캔버스로 직접 스케치합니다" />

            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-600">활성화할 감각 카드</p>
              <div className="flex flex-wrap gap-2">
                {ALL_SENSES.map((s) => (
                  <CheckCard
                    key={s}
                    name="enabled_senses"
                    value={s}
                    emoji={SENSE_META[s].emoji}
                    label={SENSE_META[s].label}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-600">측정 입력칸 <span className="text-gray-400 font-normal">(해당 실험에 맞는 것만 선택)</span></p>
              <div className="flex flex-wrap gap-2">
                {PRESET_MEASUREMENTS.map((m) => (
                  <CheckCard
                    key={m.unit}
                    name="enabled_measurements"
                    value={`${m.label}|${m.unit}`}
                    emoji="📏"
                    label={`${m.label} (${m.unit})`}
                    defaultChecked={false}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 2단계 설정 */}
          <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8 space-y-6">
            <h2 className="text-base font-bold text-gray-700">💡 2단계 추론 설정</h2>
            <Toggle name="use_inference_template" label="문장 템플릿 제공" desc="저학년 권장 — '나는 ~ 때문에 ~ 라고 생각합니다' 구조 제공" />
            <Toggle name="use_counter_argument" label="반대 생각 버튼" desc="고학년 심화용 — 자신의 추론을 비판적으로 재검토" defaultChecked={false} />
          </div>

          {/* 3단계 설정 */}
          <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8 space-y-5">
            <h2 className="text-base font-bold text-gray-700">❓ 3단계 질문 설정</h2>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-600">제공할 변인 카드</p>
              <div className="flex flex-wrap gap-2">
                {ALL_VARIABLES.map((v) => (
                  <CheckCard
                    key={v}
                    name="enabled_variable_cards"
                    value={v}
                    emoji={VARIABLE_CARD_META[v].emoji}
                    label={VARIABLE_CARD_META[v].label}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 완성 후 설정 */}
          <div className="bg-white rounded-3xl shadow-lg border border-white/70 p-8 space-y-6">
            <h2 className="text-base font-bold text-gray-700">🏁 완성 후 설정</h2>
            <Toggle name="use_peer_review" label="동료 리뷰" desc="친구 기록에 공감·토론 반응을 남깁니다" />
            <Toggle name="use_ai_summary" label="AI 글 정리" desc="3단계 내용을 바탕으로 AI가 관찰 글을 완성합니다" defaultChecked={false} />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-600 flex items-center gap-2">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full py-4 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-bold text-base rounded-2xl shadow-lg transition-all"
          >
            {pending ? "활동 만드는 중..." : "활동 시작하기 →"}
          </button>
        </form>
      </div>
    </div>
  );
}
