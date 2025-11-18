"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { batchConfig as defaultBatchConfig } from "@/config/batch";
import { mirrorFileListToInput } from "@/lib/dom";
import { cn } from "@/lib/utils";

export type FileItem = {
  file: File;
  previewUrl?: string;
};

export function FilePicker(props: {
  files: FileItem[];
  mode?: "image" | "audio";
  onPickFiles: (files: FileList | null) => void;
  onDrop: React.DragEventHandler<HTMLElement>;
  removeFile: (idx: number) => void;
  clearAllFiles: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const config = defaultBatchConfig;

  // When the parent clears all files (e.g., after Submit), also reset
  // the hidden native input so selecting the same files fires `change` again.
  // This mirrors the behavior used by the visible "Clear all" button below.
  useEffect(() => {
    if (props.files.length === 0 && inputRef.current) {
      inputRef.current.value = "";
      mirrorFileListToInput(inputRef.current, null);
    }
  }, [props.files.length]);

  const mode = props.mode ?? "image";
  const isAudio = mode === "audio";
  const totalFiles = props.files.length;
  const plannedRequests = isAudio
    ? totalFiles
    : totalFiles > 0
      ? Math.max(1, Math.ceil(totalFiles / config.maxFilesPerRequest))
      : 0;

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">
        {isAudio ? "Audio → Text" : "Image/PDF → Text OCR"}
      </h1>
      <section
        onDragEnter={(e) => {
          if (Array.from(e.dataTransfer?.types || []).includes("Files")) {
            setDragActive(true);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (Array.from(e.dataTransfer?.types || []).includes("Files")) {
            setDragActive(true);
          }
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          setDragActive(false);
          // Let the parent handle state
          props.onDrop(e);
          // Mirror files into the native input so it shows "N files"
          if (inputRef.current)
            mirrorFileListToInput(inputRef.current, e.dataTransfer.files);
        }}
        aria-label="File dropzone"
        className={cn(
          "border-2 border-dashed rounded-md p-6 text-sm text-muted-foreground transition-colors",
          dragActive ? "bg-accent/40 border-ring ring-2" : "hover:bg-accent/30",
        )}
      >
        {isAudio
          ? "Drag & drop MP3/WAV/M4A/OGG/FLAC (≤ 20 MB each), or"
          : "Drag & drop JPEG/PNG/PDF here, or"}
        <div className="mt-2 flex items-center gap-3">
          <Input
            id="file-input"
            ref={inputRef}
            type="file"
            accept={
              isAudio ? "audio/*" : "image/jpeg,image/png,application/pdf"
            }
            className="sr-only w-px h-px"
            multiple
            onChange={(e) => {
              props.onPickFiles(e.currentTarget.files);
              // Clear value so selecting the same file again still fires change
              e.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            aria-describedby="file-helper"
          >
            Choose files
          </Button>
          <Label id="file-helper" htmlFor="file-input" className="m-0 p-0">
            <span className="text-sm text-muted-foreground">
              {props.files.length > 0
                ? `${props.files.length} file${props.files.length > 1 ? "s" : ""}`
                : "No files chosen"}
            </span>
          </Label>
        </div>
      </section>

      {!isAudio && (
        <p className="text-xs text-muted-foreground">
          Tip: For better OCR results and to avoid missing text, consider
          converting images to PDF before uploading.
        </p>
      )}

      {totalFiles > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-medium">Selected files</div>
              {!isAudio ? (
                <p className="text-xs text-muted-foreground">
                  {totalFiles.toLocaleString()} file
                  {totalFiles === 1 ? "" : "s"}
                  {" • "}
                  {plannedRequests.toLocaleString()} request
                  {plannedRequests === 1 ? "" : "s"} planned
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {Math.min(totalFiles, 10).toLocaleString()} audio file
                  {totalFiles === 1 ? "" : "s"}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                props.clearAllFiles();
                if (inputRef.current) {
                  inputRef.current.value = "";
                  mirrorFileListToInput(inputRef.current, null);
                }
              }}
            >
              Clear all
            </Button>
          </div>
          <ScrollArea className="h-48 sm:h-64 w-full rounded border">
            <div className="flex flex-wrap gap-2 p-2 pr-4">
              {props.files.map((item, idx) => (
                <div
                  key={`${item.file.name}-${item.file.size}-${item.file.lastModified}-${idx}`}
                  className="border rounded px-2 py-1 text-xs flex items-center gap-2 bg-background/80"
                >
                  <span className="max-w-40 truncate" title={item.file.name}>
                    {item.file.name}
                  </span>
                  <button
                    type="button"
                    className="opacity-70 hover:opacity-100"
                    onClick={() => props.removeFile(idx)}
                    aria-label={`Remove ${item.file.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </section>
  );
}
