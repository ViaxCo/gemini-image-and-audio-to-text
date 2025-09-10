"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function PromptEditor(props: {
  prompt: string;
  setPrompt: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium" htmlFor="prompt">
          Prompt
        </label>
        <Button variant="ghost" onClick={props.onReset}>
          Reset to default
        </Button>
      </div>
      <Textarea
        rows={12}
        id="prompt"
        className="text-sm"
        value={props.prompt}
        onChange={(e) => props.setPrompt(e.target.value)}
      />
    </div>
  );
}
