"use client";

import { useEffect, useMemo, useState } from "react";
import { ModelPicker } from "@/components/model-picker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLocalStorageString } from "@/hooks/use-local-storage";
import { STORAGE_KEYS } from "@/lib/constants";
import { parseKeys } from "@/lib/key-pool";
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
  const [apiKeySaveCount, setApiKeySaveCount] = useState(0);
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
  const savedKeys = useMemo(() => parseKeys(saved), [saved]);
  const savedKeysLabel = `${savedKeys.length} ${savedKeys.length === 1 ? "key" : "keys"}`;

  return (
    <div
      className={cn(
        "grid gap-3 rounded-md border p-3 lg:grid-cols-[minmax(0,1fr)_18rem]",
        className,
      )}
    >
      <div className="min-w-0">
        <label
          htmlFor="gemini-api-key"
          className="mb-1 block text-xs font-medium text-muted-foreground"
        >
          Gemini API keys, one per line (stored locally)
        </label>

        <div className="flex flex-col gap-2 md:flex-row md:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <Textarea
              id="gemini-api-key"
              placeholder="AIxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={key}
              spellCheck={false}
              autoComplete="off"
              className={cn(
                "min-h-9 min-w-0 font-mono text-sm",
                masked && "[-webkit-text-security:disc]",
              )}
              onChange={(e) => {
                const v = e.target.value;
                setKey(v);
                onStatusChange?.({
                  savedPresent: !!saved,
                  draftPresent: !!v.trim(),
                });
              }}
              aria-label="Gemini API keys"
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
                  setApiKeySaveCount((count) => count + 1);
                  onKeyChange?.(true);
                  onStatusChange?.({ savedPresent: true, draftPresent: true });
                  onToast?.("API keys saved", "success");
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
                  onStatusChange?.({
                    savedPresent: false,
                    draftPresent: false,
                  });
                  onToast?.("API keys cleared", "success");
                }
              }}
              disabled={!saved}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="mt-1 text-[11px] text-muted-foreground">
          <span
            className={
              isDirty ? "text-amber-600 dark:text-amber-400" : undefined
            }
          >
            {isDirty
              ? "Unsaved keys — press Save to enable Submit"
              : saved
                ? `${savedKeysLabel} saved`
                : "Not set"}
          </span>
          {savedKeys.length > 1 &&
            " — rate-limited requests switch to the next key. Use one key per Google project; keys from the same project share limits."}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>
            API keys are saved in your browser. Requests go directly to Google;
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

      {/* Remount after every save so saving the same key refreshes the list. */}
      <ModelPicker key={apiKeySaveCount} apiKey={savedKeys[0] ?? ""} />
    </div>
  );
}
