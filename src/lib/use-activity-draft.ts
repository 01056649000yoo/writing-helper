"use client";

import { startTransition, useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { persistActivityDraft, readActivityDraft } from "@/lib/activity-drafts";

/**
 * 폼 입력 상태를 localStorage 에 자동 저장하고, 마운트 시 복원하는 훅.
 * 제출 직전에 suspendAutosave 를 호출해 저장 루프를 멈춘 뒤 clearActivityDraft 로
 * 키를 비워야 새로고침해도 옛 초안이 다시 살아나지 않습니다.
 */
export function useActivityDraft<T>(storageKey: string, initialState: T) {
  const [draft, setDraftState] = useState<T>(initialState);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const autosaveEnabledRef = useRef(true);
  const hydratedRef = useRef(false);
  const latestDraftRef = useRef(draft);

  useEffect(() => {
    latestDraftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const { draft: nextDraft, savedAt: nextSavedAt } = readActivityDraft(storageKey, initialState);
    autosaveEnabledRef.current = true;
    hydratedRef.current = false;
    latestDraftRef.current = nextDraft;
    startTransition(() => {
      setDraftState(nextDraft);
      setSavedAt(nextSavedAt);
      hydratedRef.current = true;
    });
  }, [initialState, storageKey]);

  const persistIfReady = useCallback((nextDraft: T) => {
    if (!hydratedRef.current) return;
    if (!autosaveEnabledRef.current) return;
    persistActivityDraft(storageKey, nextDraft);
    setSavedAt(Date.now());
  }, [storageKey]);

  const setDraft: Dispatch<SetStateAction<T>> = useCallback((nextDraft) => {
    setDraftState((previousDraft) => {
      const resolvedDraft = typeof nextDraft === "function"
        ? (nextDraft as (previousDraft: T) => T)(previousDraft)
        : nextDraft;
      latestDraftRef.current = resolvedDraft;
      persistIfReady(resolvedDraft);
      return resolvedDraft;
    });
  }, [persistIfReady]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saveLatestDraft = () => persistIfReady(latestDraftRef.current);
    window.addEventListener("pagehide", saveLatestDraft);
    window.addEventListener("visibilitychange", saveLatestDraft);
    return () => {
      window.removeEventListener("pagehide", saveLatestDraft);
      window.removeEventListener("visibilitychange", saveLatestDraft);
      saveLatestDraft();
    };
  }, [persistIfReady]);

  const suspendAutosave = useCallback(() => {
    autosaveEnabledRef.current = false;
  }, []);

  const resumeAutosave = useCallback(() => {
    autosaveEnabledRef.current = true;
    if (hydratedRef.current) {
      persistActivityDraft(storageKey, latestDraftRef.current);
    }
  }, [storageKey]);

  return [draft, setDraft, { suspendAutosave, resumeAutosave, savedAt }] as const;
}
