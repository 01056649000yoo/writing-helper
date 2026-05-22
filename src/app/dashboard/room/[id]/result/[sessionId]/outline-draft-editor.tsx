"use client";

import { useState } from "react";
import { updateStudentResult } from "@/app/actions/room-actions";

type Field = "outline" | "draft";

export function OutlineDraftEditor({
  roomId,
  sessionId,
  initialOutline,
  initialDraft,
}: {
  roomId: string;
  sessionId: string;
  initialOutline: string;
  initialDraft: string | null;
}) {
  const [outline, setOutline] = useState(initialOutline);
  const [draft, setDraft] = useState(initialDraft ?? "");
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit(field: Field) {
    setEditingField(field);
    setEditText(field === "outline" ? outline : draft);
    setError("");
  }

  function cancelEdit() {
    setEditingField(null);
    setEditText("");
    setError("");
  }

  async function saveEdit() {
    if (!editingField) return;
    setSaving(true);
    setError("");
    const nextOutline = editingField === "outline" ? editText : outline;
    const nextDraft = editingField === "draft" ? editText : draft;
    const result = await updateStudentResult(roomId, sessionId, nextOutline, nextDraft);
    if (result?.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setOutline(nextOutline);
    setDraft(nextDraft);
    setEditingField(null);
    setEditText("");
    setSaving(false);
  }

  return (
    <div className="grid gap-4">
      <EditableSection
        title="📝 완성된 글쓰기 개요"
        wrapperClass="bg-indigo-50"
        titleClass="text-indigo-800"
        buttonClass="bg-white/80 text-indigo-700 hover:bg-white border border-indigo-100"
        saveButtonClass="bg-indigo-500 text-white hover:bg-indigo-600"
        textareaFocusClass="focus:border-indigo-400 focus:ring-indigo-200"
        content={outline}
        editing={editingField === "outline"}
        editText={editText}
        saving={saving}
        disabled={editingField !== null && editingField !== "outline"}
        onChangeText={setEditText}
        onEdit={() => startEdit("outline")}
        onCancel={cancelEdit}
        onSave={saveEdit}
      />

      {(draft || editingField === "draft") && (
        <EditableSection
          title="✍️ 고쳐쓰기용 초고"
          wrapperClass="bg-emerald-50"
          titleClass="text-emerald-800"
          buttonClass="bg-white/80 text-emerald-700 hover:bg-white border border-emerald-100"
          saveButtonClass="bg-emerald-500 text-white hover:bg-emerald-600"
          textareaFocusClass="focus:border-emerald-400 focus:ring-emerald-200"
          content={draft}
          editing={editingField === "draft"}
          editText={editText}
          saving={saving}
          disabled={editingField !== null && editingField !== "draft"}
          onChangeText={setEditText}
          onEdit={() => startEdit("draft")}
          onCancel={cancelEdit}
          onSave={saveEdit}
        />
      )}

      {error && (
        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">
          {error}
        </p>
      )}
    </div>
  );
}

function EditableSection({
  title,
  wrapperClass,
  titleClass,
  buttonClass,
  saveButtonClass,
  textareaFocusClass,
  content,
  editing,
  editText,
  saving,
  disabled,
  onChangeText,
  onEdit,
  onCancel,
  onSave,
}: {
  title: string;
  wrapperClass: string;
  titleClass: string;
  buttonClass: string;
  saveButtonClass: string;
  textareaFocusClass: string;
  content: string;
  editing: boolean;
  editText: string;
  saving: boolean;
  disabled: boolean;
  onChangeText: (value: string) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const rows = editing
    ? Math.min(28, Math.max(8, editText.split("\n").length + 1))
    : 0;

  return (
    <div className={`rounded-2xl p-6 ${wrapperClass}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className={`font-bold ${titleClass}`}>{title}</h2>
        {!editing && (
          <button
            type="button"
            onClick={onEdit}
            disabled={disabled}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${buttonClass}`}
          >
            ✏️ 수정
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <textarea
            value={editText}
            onChange={(event) => onChangeText(event.target.value)}
            rows={rows}
            disabled={saving}
            className={`w-full bg-white px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm leading-7 text-gray-800 font-sans resize-y focus:outline-none focus:ring-2 ${textareaFocusClass} disabled:opacity-60`}
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="text-sm font-semibold px-4 py-2 rounded-xl bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || editText.trim().length === 0}
              className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${saveButtonClass}`}
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      ) : (
        <pre className="whitespace-pre-wrap text-gray-700 text-sm leading-7 font-sans">
          {content}
        </pre>
      )}
    </div>
  );
}
