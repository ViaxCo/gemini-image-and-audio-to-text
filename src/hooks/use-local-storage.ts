"use client";

import { useCallback, useEffect, useState } from "react";

export function useLocalStorageString(key: string) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState("");

  // Initialize from localStorage on mount
  useEffect(() => {
    try {
      const v = localStorage.getItem(key) || "";
      setValue(v);
      setSaved(v);
    } catch {
      // ignore
    }
  }, [key]);

  const save = useCallback(() => {
    try {
      const trimmed = value.trim();
      if (!trimmed) return false;
      localStorage.setItem(key, trimmed);
      setSaved(trimmed);
      return true;
    } catch {
      return false;
    }
  }, [key, value]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setValue("");
      setSaved("");
      return true;
    } catch {
      return false;
    }
  }, [key]);

  const isDirty = value.trim() !== saved.trim();

  return { value, setValue, saved, isDirty, save, clear } as const;
}
