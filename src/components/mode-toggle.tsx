"use client";

import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function ModeToggle(props: {
  mode: "image" | "audio";
  onChange: (m: "image" | "audio") => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Label htmlFor="mode-toggle" className="text-sm font-medium">
        Mode:
      </Label>
      <ToggleGroup
        id="mode-toggle"
        type="single"
        variant="outline"
        size="sm"
        value={props.mode}
        onValueChange={(v) => {
          if (v === "image" || v === "audio") props.onChange(v);
        }}
        aria-label="Pipeline mode"
      >
        <ToggleGroupItem
          value="image"
          className="px-3 sm:px-4"
          aria-pressed={props.mode === "image"}
        >
          Image OCR
        </ToggleGroupItem>
        <ToggleGroupItem
          value="audio"
          className="px-3 sm:px-4"
          aria-pressed={props.mode === "audio"}
        >
          Audio
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
