export type OutlineResultPayload = {
  outline: string | null;
  draft: string | null;
};

export function serializeOutlineResult(payload: OutlineResultPayload) {
  return JSON.stringify({
    version: 2,
    outline: payload.outline,
    draft: payload.draft,
  });
}

export function parseOutlineResult(raw: string | null | undefined): OutlineResultPayload {
  if (!raw) {
    return { outline: null, draft: null };
  }

  try {
    const parsed = JSON.parse(raw) as {
      outline?: unknown;
      draft?: unknown;
    };

    if (typeof parsed.outline === "string" || parsed.outline === null) {
      return {
        outline: typeof parsed.outline === "string" ? parsed.outline : null,
        draft: typeof parsed.draft === "string" ? parsed.draft : null,
      };
    }
  } catch {
    // Legacy plain-text outline payload
  }

  return {
    outline: raw,
    draft: null,
  };
}
