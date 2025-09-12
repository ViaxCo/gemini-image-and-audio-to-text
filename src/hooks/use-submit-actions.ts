"use client";

import type React from "react";
import { useCallback } from "react";
import type { FileItem } from "@/components/file-picker";
import { buildFormData } from "@/lib/stream-utils";
import { updateById } from "@/lib/utils";
import type { Card } from "@/types";

export function useSubmitActions(opts: {
  mode: "image" | "audio";
  prompt: string;
  files: FileItem[];
  setCards: React.Dispatch<React.SetStateAction<Card[]>>;
  clearAllFiles: () => void;
  addToast: (m: string, v: "success" | "warning" | "destructive") => void;
  runOcrStream: (
    id: string,
    form: FormData,
    o: { showErrorToast: boolean },
  ) => Promise<void>;
}) {
  const {
    mode,
    prompt,
    files,
    setCards,
    clearAllFiles,
    addToast,
    runOcrStream,
  } = opts;

  const addProcessingCard = useCallback(
    (
      args: Pick<Card, "prompt" | "files"> & {
        mode?: "image" | "audio";
        filesBlob?: { file: File }[];
      },
    ) => {
      const id = crypto.randomUUID();
      const createdAt = Date.now();
      setCards((prev) => [
        {
          id,
          mode: args.mode,
          prompt: args.prompt,
          files: args.files,
          filesBlob: args.filesBlob,
          status: "processing",
          createdAt,
        },
        ...prev,
      ]);
      return id;
    },
    [setCards],
  );

  const submit = useCallback(async () => {
    if (mode === "audio") {
      const items = files.slice(0, 10);
      const runs: Promise<void>[] = [];
      for (const { file } of items) {
        const id = addProcessingCard({
          mode: "audio",
          prompt,
          files: [{ name: file.name, size: file.size, type: file.type }],
          filesBlob: [{ file }],
        });
        runs.push(
          runOcrStream(id, buildFormData(prompt, [file]), {
            showErrorToast: true,
          }).then(() => void 0),
        );
      }
      clearAllFiles();
      await Promise.allSettled(runs);
    } else {
      const id = addProcessingCard({
        mode: "image",
        prompt,
        files: files.map((f) => ({
          name: f.file.name,
          size: f.file.size,
          type: f.file.type,
        })),
        filesBlob: files.map((f) => ({ file: f.file })),
      });
      clearAllFiles();
      try {
        await runOcrStream(
          id,
          buildFormData(
            prompt,
            files.map((f) => f.file),
          ),
          { showErrorToast: true },
        );
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        setCards((prev) =>
          updateById(prev, id, { status: "failed", error: message }),
        );
        addToast(`Failed: ${message}`, "destructive");
      }
    }
  }, [
    addProcessingCard,
    addToast,
    clearAllFiles,
    files,
    mode,
    prompt,
    runOcrStream,
    setCards,
  ]);

  const retry = useCallback(
    async (card: Card) => {
      if (!card.filesBlob?.length) {
        alert("Original files not available for retry.");
        return;
      }
      const id = card.id;
      setCards((prev) =>
        updateById(prev, id, {
          status: "processing",
          resultText: undefined,
          error: undefined,
          usage: undefined,
          usageTotal: undefined,
          createdAt: Date.now(),
        }),
      );
      try {
        await runOcrStream(
          id,
          buildFormData(
            card.prompt,
            card.filesBlob.map((f) => f.file),
          ),
          { showErrorToast: false },
        );
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        setCards((prev) =>
          updateById(prev, id, { status: "failed", error: message }),
        );
      }
    },
    [runOcrStream, setCards],
  );

  const copy = useCallback(
    async (text?: string) => {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        addToast("Copied to clipboard", "success");
      } catch {
        addToast("Failed to copy", "destructive");
      }
    },
    [addToast],
  );

  return { submit, retry, copy, addProcessingCard } as const;
}
