"use client";

import { RotateCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STORAGE_KEYS } from "@/lib/constants";
import { DEFAULT_GEMINI_MODEL, fetchGeminiModels } from "@/lib/gemini-models";

const DEFAULT_OPTION = {
  id: DEFAULT_GEMINI_MODEL,
  name: "Gemini 2.5 Flash",
};

export function ModelPicker({ apiKey }: { apiKey: string }) {
  const [selectedModel, setSelectedModel] = useState(DEFAULT_GEMINI_MODEL);
  const [models, setModels] = useState([DEFAULT_OPTION]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const activeRequest = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    const savedModel = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL);
    if (!savedModel) return;

    setSelectedModel(savedModel);
    setModels((current) =>
      current.some(({ id }) => id === savedModel)
        ? current
        : [{ id: savedModel, name: savedModel }, ...current],
    );
  }, []);

  const loadModels = useCallback(async () => {
    if (!apiKey) return;

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setIsLoading(true);
    setError(undefined);

    try {
      const availableModels = await fetchGeminiModels(
        apiKey,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (availableModels.length === 0) {
        setError("No compatible models found");
        return;
      }

      const savedModel =
        localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || DEFAULT_GEMINI_MODEL;
      const nextModel =
        availableModels.find(({ id }) => id === savedModel)?.id ??
        availableModels.find(({ id }) => id === DEFAULT_GEMINI_MODEL)?.id ??
        availableModels[0].id;

      setModels(availableModels);
      setSelectedModel(nextModel);
      localStorage.setItem(STORAGE_KEYS.GEMINI_MODEL, nextModel);
    } catch (loadError) {
      if (controller.signal.aborted) return;
      console.error("Failed to load Gemini models:", loadError);
      setError("Couldn’t refresh models");
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey) {
      setIsLoading(false);
      setError(undefined);
      return;
    }

    void loadModels();
    return () => activeRequest.current?.abort();
  }, [apiKey, loadModels]);

  function selectModel(model: string) {
    setSelectedModel(model);
    localStorage.setItem(STORAGE_KEYS.GEMINI_MODEL, model);
  }

  let status = "";
  if (isLoading) status = "Loading…";
  else if (!apiKey) status = "Save a key first";
  else if (!error) status = `${models.length} available`;

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex min-h-4 items-center justify-between gap-2">
        <label
          htmlFor="gemini-model"
          className="text-xs font-medium text-muted-foreground"
        >
          Gemini model
        </label>
        <span className="text-[11px] text-muted-foreground" aria-live="polite">
          {status}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={selectedModel}
          onValueChange={selectModel}
          disabled={!apiKey || isLoading}
        >
          <SelectTrigger
            id="gemini-model"
            className="w-full min-w-0"
            aria-label="Gemini model"
          >
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {error ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void loadModels()}
            aria-label="Refresh Gemini models"
            title="Refresh models"
          >
            <RotateCw />
          </Button>
        ) : null}
      </div>

      {error ? (
        <output className="block text-[11px] text-destructive">{error}</output>
      ) : null}
    </div>
  );
}
