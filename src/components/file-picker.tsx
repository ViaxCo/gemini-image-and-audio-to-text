"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type FileItem = {
  file: File;
  previewUrl?: string;
};

export function FilePicker(props: {
  files: FileItem[];
  onPickFiles: (files: FileList | null) => void;
  onDrop: React.DragEventHandler<HTMLDivElement>;
  removeFile: (idx: number) => void;
  clearAllFiles: () => void;
  fileView: "list" | "compact";
  setFileView: (v: "list" | "compact") => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Image → Markdown OCR</h1>
      <section
        onDragOver={(e) => e.preventDefault()}
        onDrop={props.onDrop}
        aria-label="File dropzone"
        className="border-2 border-dashed rounded-md p-6 text-sm text-muted-foreground hover:bg-accent/30 transition-colors"
      >
        Drag & drop JPEG/PNG here, or
        <div className="mt-2 flex items-center gap-2">
          <Input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            onChange={(e) => props.onPickFiles(e.currentTarget.files)}
          />
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            Browse
          </Button>
        </div>
      </section>

      {props.files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Selected files</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="opacity-70">View:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  props.setFileView(
                    props.fileView === "list" ? "compact" : "list",
                  )
                }
              >
                {props.fileView === "list" ? "Compact" : "List"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={props.clearAllFiles}
              >
                Clear all
              </Button>
            </div>
          </div>
          {props.fileView === "list" ? (
            <div className="space-y-2">
              {props.files.map((item, idx) => (
                <div
                  key={`${item.file.name}-${item.file.size}-${item.file.lastModified}-${idx}`}
                  className="flex items-center gap-3"
                >
                  <div className="text-sm text-muted-foreground truncate">
                    {item.file.name}{" "}
                    <span className="opacity-60">
                      ({Math.round(item.file.size / 1024)} KB)
                    </span>
                  </div>
                  <Button variant="ghost" onClick={() => props.removeFile(idx)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {props.files.map((item, idx) => (
                <div
                  key={`${item.file.name}-${item.file.size}-${item.file.lastModified}-${idx}`}
                  className="border rounded px-2 py-1 text-xs flex items-center gap-2"
                >
                  <span className="max-w-40 truncate">{item.file.name}</span>
                  <button
                    type="button"
                    className="opacity-70 hover:opacity-100"
                    onClick={() => props.removeFile(idx)}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
