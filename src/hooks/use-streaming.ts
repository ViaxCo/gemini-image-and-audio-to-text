"use client";

import type { MutableRefObject } from "react";
import type { FileItem } from "@/components/file-picker";
import { useStreamRunner } from "@/hooks/use-stream-runner";
import { useSubmitActions } from "@/hooks/use-submit-actions";
import type { Card } from "@/types";

export function useStreaming(opts: {
  mode: "image" | "audio";
  prompt: string;
  files: FileItem[];
  cards: Card[];
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  controllersRef: MutableRefObject<Record<string, AbortController | undefined>>;
  clearAllFiles: () => void;
  addToast: (m: string, v: "success" | "warning" | "destructive") => void;
}) {
  const { createStreamRunner } = useStreamRunner({
    controllersRef: opts.controllersRef,
    addToast: opts.addToast,
  });

  const { submit, retry, retrySubRequest, cancelCard, copy } = useSubmitActions(
    {
      mode: opts.mode,
      prompt: opts.prompt,
      files: opts.files,
      cards: opts.cards,
      setCards: opts.setCards,
      controllersRef: opts.controllersRef,
      clearAllFiles: opts.clearAllFiles,
      addToast: opts.addToast,
      createStreamRunner,
    },
  );

  return {
    submit,
    retry,
    retrySubRequest,
    cancelCard,
    copy,
    createStreamRunner,
  } as const;
}
