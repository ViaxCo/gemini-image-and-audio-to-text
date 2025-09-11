"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  // Back-compat for caller
  onKeyChange?: (present: boolean) => void;
  onStatusChange?: (status: {
    savedPresent: boolean;
    draftPresent: boolean;
  }) => void;
  onToast?: (
    msg: string,
    variant?: "success" | "warning" | "destructive",
  ) => void;
};

const STORAGE_KEY = "gemini_api_key";

export function ApiKeyBar({
  className,
  onKeyChange,
  onStatusChange,
  onToast,
}: Props) {
  const [key, setKey] = useState<string>("");
  const [masked, setMasked] = useState(true);
  const [saved, setSaved] = useState<string>("");

  useEffect(() => {
    try {
      const savedKey = localStorage.getItem(STORAGE_KEY) || "";
      setKey(savedKey);
      setSaved(savedKey);
      onKeyChange?.(!!savedKey);
      onStatusChange?.({ savedPresent: !!savedKey, draftPresent: !!savedKey });
    } catch {
      // ignore
    }
  }, []);

  const save = () => {
    try {
      const trimmed = key.trim();
      if (!trimmed) return;
      localStorage.setItem(STORAGE_KEY, trimmed);
      setSaved(trimmed);
      onKeyChange?.(true);
      onStatusChange?.({ savedPresent: true, draftPresent: true });
      onToast?.("API key saved", "success");
    } catch {
      // ignore
    }
  };

  const clear = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setSaved("");
      setKey("");
      onKeyChange?.(false);
      onStatusChange?.({ savedPresent: false, draftPresent: false });
      onToast?.("API key cleared", "success");
    } catch {
      // ignore
    }
  };

  const hasKey = key.trim().length > 0;
  const isDirty = key.trim() !== saved.trim();

  return (
    <div className={cn("rounded-md border p-3", className)}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        Gemini API Key (stored locally)
      </label>

      {/* Row: input + show/hide + save/clear */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex flex-1 items-center gap-2">
          <Input
            type={masked ? "password" : "text"}
            placeholder="AIxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={key}
            className="text-sm"
            onChange={(e) => {
              const v = e.target.value;
              setKey(v);
              onStatusChange?.({
                savedPresent: !!saved,
                draftPresent: !!v.trim(),
              });
            }}
            aria-label="Gemini API Key"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setMasked((v) => !v)}
            aria-label={masked ? "Show key" : "Hide key"}
            title={masked ? "Show" : "Hide"}
          >
            {masked ? "Show" : "Hide"}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            type="button"
            onClick={save}
            disabled={!hasKey}
          >
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={clear}
            disabled={!saved}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Status */}
      <div className="mt-1 text-[11px] text-muted-foreground">
        <span
          className={isDirty ? "text-amber-600 dark:text-amber-400" : undefined}
        >
          {isDirty
            ? "Unsaved key — press Save to enable Submit"
            : saved
              ? "Saved"
              : "Not set"}
        </span>
      </div>

      {/* Privacy */}
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>
          Saved in your browser. Requests go directly to Google; nothing is sent
          to our server.
        </span>
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
          title="Open Google AI Studio in a new tab"
        >
          Get an API key
        </a>
      </div>
    </div>
  );
}
