"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocalStorageString } from "@/hooks/use-local-storage";
import { STORAGE_KEYS } from "@/lib/constants";
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

export function ApiKeyBar({
  className,
  onKeyChange,
  onStatusChange,
  onToast,
}: Props) {
  const [masked, setMasked] = useState(true);
  const {
    value: key,
    setValue: setKey,
    saved,
    isDirty,
    save,
    clear,
  } = useLocalStorageString(STORAGE_KEYS.GEMINI_API_KEY);

  // Announce state to parent consistently
  useEffect(() => {
    onKeyChange?.(!!saved);
    // For initial load, treat draft as whatever input shows
    onStatusChange?.({ savedPresent: !!saved, draftPresent: !!key.trim() });
  }, [saved, key, onKeyChange, onStatusChange]);

  const hasKey = useMemo(() => key.trim().length > 0, [key]);

  return (
    <div className={cn("rounded-md border p-3", className)}>
      <label
        htmlFor="gemini-api-key"
        className="mb-1 block text-xs font-medium text-muted-foreground"
      >
        Gemini API Key (stored locally)
      </label>

      {/* Row: input + show/hide + save/clear */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex flex-1 items-center gap-2">
          <Input
            id="gemini-api-key"
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
            onClick={() => {
              const ok = save();
              if (ok) {
                onKeyChange?.(true);
                onStatusChange?.({ savedPresent: true, draftPresent: true });
                onToast?.("API key saved", "success");
              }
            }}
            disabled={!hasKey}
          >
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const ok = clear();
              if (ok) {
                onKeyChange?.(false);
                onStatusChange?.({ savedPresent: false, draftPresent: false });
                onToast?.("API key cleared", "success");
              }
            }}
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
          The API key is saved in your browser. Requests go directly to Google;
          nothing is sent to our server.
        </span>
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
          title="Open Google AI Studio in a new tab"
        >
          Get a free API key
        </a>
      </div>
    </div>
  );
}
