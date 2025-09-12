"use client";

import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import { DEFAULT_PROMPT, DEFAULT_PROMPT_AUDIO } from "@/lib/default-prompts";

export type Mode = "image" | "audio";

export function usePromptAndMode() {
  const [mode, setMode] = useState<Mode>("image");
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);

  // Load saved mode once after mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PIPELINE_MODE);
      if (saved === "image" || saved === "audio") setMode(saved);
    } catch {}
  }, []);

  // Persist mode
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PIPELINE_MODE, mode);
    } catch {}
  }, [mode]);

  // Load prompt for mode
  useEffect(() => {
    try {
      const key =
        mode === "audio"
          ? STORAGE_KEYS.PROMPT_AUDIO
          : STORAGE_KEYS.PROMPT_DEFAULT;
      const saved = localStorage.getItem(key);
      setPrompt(
        saved ?? (mode === "audio" ? DEFAULT_PROMPT_AUDIO : DEFAULT_PROMPT),
      );
    } catch {
      setPrompt(mode === "audio" ? DEFAULT_PROMPT_AUDIO : DEFAULT_PROMPT);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Persist prompt per mode
  useEffect(() => {
    try {
      const key =
        mode === "audio"
          ? STORAGE_KEYS.PROMPT_AUDIO
          : STORAGE_KEYS.PROMPT_DEFAULT;
      localStorage.setItem(key, prompt);
    } catch {}
  }, [mode, prompt]);

  const resetPromptToDefault = useCallback(() => {
    setPrompt(mode === "audio" ? DEFAULT_PROMPT_AUDIO : DEFAULT_PROMPT);
  }, [mode]);

  return { mode, setMode, prompt, setPrompt, resetPromptToDefault } as const;
}
