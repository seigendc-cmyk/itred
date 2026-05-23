import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearDraft as clearLocalDraft,
  getDraft,
  getDraftUpdatedAt,
  saveDraft,
} from "../utils/localDraftStorage.ts";

interface UseFormDraftOptions<T> {
  draftKey: string;
  formData: T;
  setFormData: (data: T | ((prev: T) => T)) => void;
  enabled: boolean;
  saveDelayMs?: number;
}

const sanitizeDraftValue = (value: unknown): unknown => {
  if (typeof File !== "undefined" && value instanceof File) return undefined;
  if (typeof Blob !== "undefined" && value instanceof Blob) return undefined;
  if (typeof value === "string" && value.startsWith("data:image/")) {
    return "";
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeDraftValue(item))
      .filter((item) => item !== undefined);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, sanitizeDraftValue(item)])
        .filter(([, item]) => item !== undefined),
    );
  }
  return value;
};

export const useFormDraft = <T,>({
  draftKey,
  formData,
  setFormData,
  enabled,
  saveDelayMs = 900,
}: UseFormDraftOptions<T>) => {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const skipNextSaveRef = useRef(false);

  const storageKey = useMemo(() => `itred_form_draft:${draftKey}`, [draftKey]);

  const readDraft = useCallback((): T | null => {
    const draft = getDraft<T>(storageKey);
    return draft === undefined ? null : draft;
  }, [storageKey]);

  const refreshDraftState = useCallback(() => {
    const draft = readDraft();
    setHasDraft(!!draft);
    setDraftUpdatedAt(getDraftUpdatedAt(storageKey));
  }, [readDraft, storageKey]);

  const clearDraft = useCallback(() => {
    try {
      clearLocalDraft(storageKey);
    } catch (error) {
      console.warn("Failed to clear form draft", error);
    }
    setHasDraft(false);
    setDraftUpdatedAt(null);
  }, [storageKey]);

  const restoreDraft = useCallback(() => {
    const draft = readDraft();
    if (!draft) return false;
    skipNextSaveRef.current = true;
    setFormData(draft);
    setHasDraft(true);
    setDraftUpdatedAt(getDraftUpdatedAt(storageKey));
    return true;
  }, [readDraft, setFormData, storageKey]);

  const getDraftValue = useCallback(() => readDraft(), [readDraft]);

  const discardDraft = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  useEffect(() => {
    refreshDraftState();
  }, [refreshDraftState]);

  useEffect(() => {
    if (!enabled) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    const handle = window.setTimeout(() => {
      try {
        // IMPORTANT: Draft autosave is localStorage-only.
        // Do not write drafts to Firebase/Firestore. Drafts change on every field edit.
        const draftValue = sanitizeDraftValue(formData) as T;
        saveDraft(storageKey, draftValue);
        setHasDraft(true);
        setDraftUpdatedAt(getDraftUpdatedAt(storageKey));
      } catch (error) {
        console.warn("Failed to save form draft", error);
      }
    }, saveDelayMs);

    return () => window.clearTimeout(handle);
  }, [enabled, formData, saveDelayMs, storageKey]);

  return {
    hasDraft,
    draftUpdatedAt,
    restoreDraft,
    discardDraft,
    clearDraft,
    refreshDraftState,
    getDraftValue,
  };
};
