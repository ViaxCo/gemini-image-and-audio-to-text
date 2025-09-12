"use client";

import { useCallback, useState } from "react";
import type { FileItem } from "@/components/file-picker";
import type { Mode } from "@/hooks/use-prompt-and-mode";

export function useFiles(
  mode: Mode,
  addToast: (m: string, v: "success" | "warning" | "destructive") => void,
) {
  const [files, setFiles] = useState<FileItem[]>([]);

  const onPickFiles = useCallback(
    (picked: FileList | null) => {
      if (!picked) return;
      const all = Array.from(picked);

      if (mode === "audio") {
        const allowedExt = new Set([
          "mp3",
          "m4a",
          "wav",
          "aac",
          "ogg",
          "flac",
          "aiff",
          "aif",
        ]);
        let filesToUse = all.filter((f) => {
          const ext = f.name.split(".").pop()?.toLowerCase();
          const okType =
            f.type.startsWith("audio/") || (ext ? allowedExt.has(ext) : false);
          const okSize = f.size <= 20 * 1024 * 1024;
          if (!okType) return false;
          if (!okSize) {
            addToast(
              "Audio over 20 MB isn’t supported inline. Trim/compress and retry.",
              "warning",
            );
            return false;
          }
          return true;
        });
        if (filesToUse.length > 10) {
          addToast("Only first 10 audio files kept.", "warning");
          filesToUse = filesToUse.slice(0, 10);
        }
        const next: FileItem[] = filesToUse.map((f) => ({ file: f }));
        setFiles((prev) => [...prev, ...next]);
        const rejectedCount = all.length - filesToUse.length;
        if (rejectedCount > 0) {
          addToast(
            "Unsupported audio type. Use MP3/WAV/M4A/OGG/FLAC.",
            "warning",
          );
        }
      } else {
        const accepted = all.filter(
          (f) =>
            /image\/(jpeg|jpg|png)/.test(f.type) && f.size <= 10 * 1024 * 1024,
        );
        const rejected = all.filter((f) => !accepted.includes(f));
        const next: FileItem[] = accepted.map((f) => ({
          file: f,
          previewUrl: URL.createObjectURL(f),
        }));
        setFiles((prev) => [...prev, ...next]);
        if (rejected.length)
          addToast(
            `${rejected.length} file(s) rejected (type or >10MB).`,
            "warning",
          );
      }
    },
    [mode, addToast],
  );

  const onDrop: React.DragEventHandler<HTMLElement> = useCallback(
    (e) => {
      e.preventDefault();
      onPickFiles(e.dataTransfer.files);
    },
    [onPickFiles],
  );

  const removeFile = useCallback((idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const clearAllFiles = useCallback(() => {
    try {
      files.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    } catch {}
    setFiles([]);
  }, [files]);

  return {
    files,
    setFiles,
    onPickFiles,
    onDrop,
    removeFile,
    clearAllFiles,
  } as const;
}
