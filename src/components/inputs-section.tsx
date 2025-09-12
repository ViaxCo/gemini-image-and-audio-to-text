"use client";

import { type FileItem, FilePicker } from "@/components/file-picker";
import { ModeToggle } from "@/components/mode-toggle";
import { PromptEditor } from "@/components/prompt-editor";
import { Button } from "@/components/ui/button";

type Mode = "image" | "audio";

export function InputsSection(props: {
  mode: Mode;
  onModeRequestChange: (mode: Mode) => void;

  files: FileItem[];
  onPickFiles: (files: FileList | null) => void;
  onDrop: React.DragEventHandler<HTMLElement>;
  removeFile: (idx: number) => void;
  clearAllFiles: () => void;

  prompt: string;
  setPrompt: (p: string) => void;
  onResetPrompt: () => void;

  canSubmit: boolean;
  onSubmit: () => void | Promise<void>;
  submitTitle?: string;
}) {
  const {
    mode,
    onModeRequestChange,
    files,
    onPickFiles,
    onDrop,
    removeFile,
    clearAllFiles,
    prompt,
    setPrompt,
    onResetPrompt,
    canSubmit,
    onSubmit,
    submitTitle,
  } = props;

  return (
    <section className="space-y-4">
      <ModeToggle
        mode={mode}
        onChange={(next) => {
          if (next === mode) return;
          onModeRequestChange(next);
        }}
      />

      <FilePicker
        files={files}
        mode={mode}
        onPickFiles={onPickFiles}
        onDrop={onDrop}
        removeFile={removeFile}
        clearAllFiles={clearAllFiles}
      />

      <PromptEditor
        prompt={prompt}
        setPrompt={setPrompt}
        onReset={onResetPrompt}
      />

      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={onSubmit}
          disabled={!canSubmit}
          title={submitTitle}
        >
          Submit
        </Button>
      </div>
    </section>
  );
}
