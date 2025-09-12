"use client";

import type { FileItem } from "@/components/file-picker";
import { useStreamRunner } from "@/hooks/use-stream-runner";
import { useSubmitActions } from "@/hooks/use-submit-actions";
import { buildFormData } from "@/lib/stream-utils";
import type { Card } from "@/types";

export function useStreaming(opts: {
  mode: "image" | "audio";
  prompt: string;
  files: FileItem[];
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  controllersRef: React.MutableRefObject<
    Record<string, AbortController | undefined>
  >;
  clearAllFiles: () => void;
  addToast: (m: string, v: "success" | "warning" | "destructive") => void;
}) {
  const { runOcrStream } = useStreamRunner({
    setCards: opts.setCards,
    controllersRef: opts.controllersRef,
    addToast: opts.addToast,
  });

  const { submit, retry, copy } = useSubmitActions({
    mode: opts.mode,
    prompt: opts.prompt,
    files: opts.files,
    setCards: opts.setCards,
    clearAllFiles: opts.clearAllFiles,
    addToast: opts.addToast,
    runOcrStream,
  });

  return { submit, retry, copy, runOcrStream } as const;
}

export const StreamingHelpers = { buildFormData };
