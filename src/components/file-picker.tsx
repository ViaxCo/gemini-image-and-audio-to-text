"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Image → Markdown OCR</h1>
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
          try {
            if (inputRef.current) {
              const dt = new DataTransfer();
              Array.from(e.dataTransfer.files || []).forEach((f) =>
                dt.items.add(f),
              );
              (inputRef.current as unknown as { files: FileList }).files =
                dt.files;
            }
          } catch {
            // Non-fatal: some browsers may disallow programmatic assignment.
          }
        }}
        aria-label="File dropzone"
        className={cn(
          "border-2 border-dashed rounded-md p-6 text-sm text-muted-foreground transition-colors",
          dragActive ? "bg-accent/40 border-ring ring-2" : "hover:bg-accent/30",
        )}
      >
        Drag & drop JPEG/PNG here, or
        <div className="mt-2 flex items-center gap-3">
          <Input
            id="file-input"
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
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

      {props.files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-6">
            <div className="text-sm font-medium">Selected files</div>
            <div className="flex items-center flex-wrap gap-2 text-xs">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  props.clearAllFiles();
                  try {
                    if (inputRef.current) {
                      // Reset the native input to reflect cleared state
                      inputRef.current.value = "";
                      const dt = new DataTransfer();
                      (
                        inputRef.current as unknown as { files: FileList }
                      ).files = dt.files;
                    }
                  } catch {
                    // non-fatal
                  }
                }}
              >
                Clear all
              </Button>
            </div>
          </div>
          {/* Always render compact view */}
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
        </div>
      )}
    </section>
  );
}
