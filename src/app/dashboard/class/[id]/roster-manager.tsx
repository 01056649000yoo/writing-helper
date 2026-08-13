"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addClassStudents, deleteClassStudent } from "@/app/actions/class-actions";

type Student = {
  id: string;
  student_number: number;
  student_name: string;
};

export function RosterManager({
  classId,
  students,
  rosterLocked,
}: {
  classId: string;
  students: Student[];
  rosterLocked: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [studentName, setStudentName] = useState("");
  const [error, setError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const shouldScrollRoster = students.length > 20;
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleAddStudent() {
    if (rosterLocked || !studentName.trim()) return;

    setError("");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("class_id", classId);
      formData.set("students", studentName.trim());

      const result = await addClassStudents(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }

      setStudentName("");
      router.refresh();
      setTimeout(() => inputRef.current?.focus(), 0);
    });
  }

  function handleDeleteStudent(studentId: string) {
    if (rosterLocked) return;

    setError("");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("class_id", classId);
      formData.set("student_id", studentId);

      const result = await deleteClassStudent(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }

      setPendingDeleteId(null);
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-[28px] shadow-sm border border-white/70 overflow-hidden">
      <div className="px-5 py-5 sm:px-7 sm:py-6 border-b border-gray-100 bg-gradient-to-r from-slate-50 via-white to-indigo-50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">👥 학생 명단</h2>
            <p className="text-sm text-gray-500 mt-1">번호와 이름으로 바로 입장할 수 있는 참여자 목록입니다.</p>
          </div>
          <div className="shrink-0 rounded-2xl bg-white/90 border border-indigo-100 px-3 py-2 text-right shadow-sm">
            <p className="text-xs font-medium text-gray-400">등록 인원</p>
            <p className="text-lg font-bold text-indigo-600">{students.length}명</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-700">현재 명단</p>
            <p className="text-xs text-gray-400">스크롤해서 전체 확인</p>
          </div>

          {students.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 px-5 py-8 text-center">
              <p className="text-sm font-medium text-gray-500">아직 등록된 학생이 없습니다.</p>
              <p className="text-xs text-gray-400 mt-1">오른쪽 입력칸에서 학생 이름을 하나씩 추가해보세요.</p>
            </div>
          ) : (
            <div className={shouldScrollRoster ? "max-h-[420px] overflow-y-auto pr-1" : ""}>
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-2.5">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="group flex items-center gap-2.5 rounded-2xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/30 sm:px-3.5"
                  >
                    <div className="flex h-8.5 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">
                      {student.student_number}
                    </div>
                    <p className="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-semibold text-gray-800 sm:text-[15px]">
                      {student.student_name}
                    </p>
                    {pendingDeleteId !== student.id ? (
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(student.id)}
                        disabled={rosterLocked || isPending}
                        className="shrink-0 rounded-lg p-1.5 text-sm font-bold leading-none text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        aria-label={`${student.student_name} 삭제`}
                        title="삭제"
                      >
                        ×
                      </button>
                    ) : (
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(null)}
                          disabled={isPending}
                          className="rounded-lg px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStudent(student.id)}
                          disabled={isPending}
                          className="rounded-lg bg-red-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-600 disabled:opacity-40"
                        >
                          확인
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 bg-slate-50/70 px-4 py-4 sm:px-6 sm:py-5">
        <div className="rounded-3xl border border-white bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">학생 추가</p>
              <p className="text-xs text-gray-400 mt-1">이름을 한 명씩 입력하면 다음 번호로 바로 추가됩니다.</p>
            </div>
            <p className="text-xs text-indigo-600">Enter로 바로 추가 가능</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              ref={inputRef}
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddStudent();
                }
              }}
              disabled={rosterLocked || isPending}
              className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50"
              placeholder="예) 김민서"
            />

            <button
              type="button"
              onClick={handleAddStudent}
              disabled={rosterLocked || isPending || !studentName.trim()}
              className="rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50 sm:min-w-[132px]"
            >
              {isPending ? "추가 중..." : "학생 추가"}
            </button>
          </div>

          {rosterLocked && (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              진행 중인 활동 세션이 있을 때는 학생 명단을 수정할 수 없습니다.
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
