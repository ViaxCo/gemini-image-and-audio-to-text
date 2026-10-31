"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { ModelPicker } from "@/components/model-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STORAGE_KEYS } from "@/lib/constants";
import { parseKeys } from "@/lib/key-pool";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
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
  const [keys, setKeys] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setKeys(parseKeys(localStorage.getItem(STORAGE_KEYS.GEMINI_API_KEY)));
  }, []);

  useEffect(() => {
    onKeyChange?.(keys.length > 0);
    onStatusChange?.({
      savedPresent: keys.length > 0,
      draftPresent: draft.trim().length > 0,
    });
  }, [keys, draft, onKeyChange, onStatusChange]);

  function saveKeys(next: string[]) {
    if (next.length > 0) {
      localStorage.setItem(STORAGE_KEYS.GEMINI_API_KEY, next.join("\n"));
    } else {
      localStorage.removeItem(STORAGE_KEYS.GEMINI_API_KEY);
    }
    setKeys(next);
  }

  function addKeys(raw: string) {
    const added = parseKeys(raw).filter((key) => !keys.includes(key));
    setDraft("");
    if (added.length === 0) return;
    saveKeys([...keys, ...added]);
    onToast?.(
      added.length === 1 ? "API key added" : `${added.length} API keys added`,
      "success",
    );
  }

  return (
    <div
      className={cn(
        "grid gap-4 rounded-md border p-3 lg:grid-cols-[minmax(0,1fr)_18rem]",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="gemini-api-key"
            className="text-xs font-medium text-muted-foreground"
          >
            Gemini API keys
          </label>
          <span className="text-[11px] text-muted-foreground">
            {keys.length === 0
              ? "None saved"
              : `${keys.length} saved in this browser`}
          </span>
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addKeys(draft);
          }}
        >
          <Input
            id="gemini-api-key"
            type="password"
            placeholder="Paste one or more keys"
            value={draft}
            autoComplete="off"
            className="min-w-0 font-mono text-sm"
            onChange={(e) => setDraft(e.target.value)}
            onPaste={(e) => {
              e.preventDefault();
              addKeys(e.clipboardData.getData("text"));
            }}
          />
          <Button type="submit" variant="secondary" disabled={!draft.trim()}>
            Add
          </Button>
        </form>

        {keys.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Saved API keys">
            {keys.map((key) => (
              <li key={key}>
                <Badge
                  variant="outline"
                  className="gap-0.5 py-0 pr-0 font-mono"
                >
                  …{key.slice(-4)}
                  <button
                    type="button"
                    className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
                    aria-label={`Remove key ending ${key.slice(-4)}`}
                    onClick={() => saveKeys(keys.filter((k) => k !== key))}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] text-muted-foreground">
          {keys.length > 1 &&
            "Rate-limited requests switch to the next key. Use one key per Google project. "}
          Requests go straight to Google.{" "}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Get a free API key
          </a>
        </p>
      </div>

      <ModelPicker apiKey={keys[0] ?? ""} />
    </div>
  );
}
