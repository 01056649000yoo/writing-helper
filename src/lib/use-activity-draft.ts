"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { persistActivityDraft, readActivityDraft } from "@/lib/activity-drafts";

const DRAFT_SAVE_INTERVAL_MS = 5000;

/**
 * 폼 입력 상태를 일정 주기로 localStorage 에 자동 저장하고, 마운트 시 복원하는 훅.
 * 제출 직전에 suspendAutosave 를 호출해 저장 루프를 멈춘 뒤 clearActivityDraft 로
 * 키를 비워야 새로고침해도 옛 초안이 다시 살아나지 않습니다.
 */
export function useActivityDraft<T>(storageKey: string, initialState: T) {
  const [draft, setDraft] = useState<T>(initialState);
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const autosaveEnabledRef = useRef(true);

  useEffect(() => {
    const { draft: nextDraft } = readActivityDraft(storageKey, initialState);
    autosaveEnabledRef.current = true;
    startTransition(() => {
      setDraft(nextDraft);
      setAutosaveEnabled(true);
    });
  }, [initialState, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!autosaveEnabled) return;

    const saveDraft = () => {
      if (!autosaveEnabledRef.current) return;
      persistActivityDraft(storageKey, draft);
    };

    const intervalId = window.setInterval(saveDraft, DRAFT_SAVE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      saveDraft();
    };
  }, [autosaveEnabled, draft, storageKey]);

  const suspendAutosave = useCallback(() => {
    autosaveEnabledRef.current = false;
    setAutosaveEnabled(false);
  }, []);

  const resumeAutosave = useCallback(() => {
    autosaveEnabledRef.current = true;
    setAutosaveEnabled(true);
  }, []);

  return [draft, setDraft, { suspendAutosave, resumeAutosave }] as const;
}
