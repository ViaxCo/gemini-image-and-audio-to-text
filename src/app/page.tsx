"use client";

import { useCallback, useState } from "react";
import { ApiKeyBar } from "@/components/api-key-bar";
import { InputsSection } from "@/components/inputs-section";
import { RequestsSection } from "@/components/requests-section";
import { ResultDialog } from "@/components/result-dialog";
import { SwitchModeDialog } from "@/components/switch-mode-dialog";
import { Toasts } from "@/components/toasts";
import { useCards } from "@/hooks/use-cards";
import { useFiles } from "@/hooks/use-files";
import { usePromptAndMode } from "@/hooks/use-prompt-and-mode";
import { useStreaming } from "@/hooks/use-streaming";
import { useToasts } from "@/hooks/use-toasts";

export default function Home() {
  // Prompt + mode
  const { mode, setMode, prompt, setPrompt, resetPromptToDefault } =
    usePromptAndMode();

  // Toasts
  const { toasts, addToast } = useToasts(2400);

  // Files
  const { files, onPickFiles, onDrop, removeFile, clearAllFiles } = useFiles(
    mode,
    addToast,
  );

  // Cards
  const {
    cards,
    setCards,
    expandedId,
    setExpandedId,
    rawViewById,
    setRawViewById,
    controllersRef,
    clearAllRequests,
    removeCard,
    selectedCard,
  } = useCards();

  // Streaming actions
  const { submit, retry, retrySubRequest, cancelCard, copy } = useStreaming({
    mode,
    prompt,
    files,
    cards,
    setCards,
    controllersRef,
    clearAllFiles,
    addToast,
  });

  // API key presence flags
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [hasDraftKey, setHasDraftKey] = useState<boolean>(false);

  // UI dialogs
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<"image" | "audio" | null>(
    null,
  );

  // Handlers moved into hooks above

  const canSubmit = files.length > 0 && prompt.trim().length > 0 && hasApiKey;

  // Handlers for copy/retry/submit are provided by useStreaming

  const submitTitle = hasApiKey
    ? undefined
    : hasDraftKey
      ? "Press Save in the API key bar to enable Submit"
      : "Add your Gemini API key to submit";

  return (
    <div className="min-h-dvh w-full p-6 md:p-10">
      <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <ApiKeyBar
            onKeyChange={useCallback((p: boolean) => {
              setHasApiKey(!!p);
            }, [])}
            onStatusChange={useCallback(
              ({
                savedPresent,
                draftPresent,
              }: {
                savedPresent: boolean;
                draftPresent: boolean;
              }) => {
                setHasApiKey(!!savedPresent);
                setHasDraftKey(!!draftPresent);
              },
              [],
            )}
            onToast={(msg, variant) => addToast(msg, variant)}
          />
        </div>

        {/* Left: Inputs */}
        <InputsSection
          mode={mode}
          onModeRequestChange={(next) => {
            if (next === mode) return;
            if (files.length > 0) {
              setPendingMode(next);
              setConfirmOpen(true);
              return;
            }
            setMode(next);
          }}
          files={files}
          onPickFiles={onPickFiles}
          onDrop={onDrop}
          removeFile={removeFile}
          clearAllFiles={clearAllFiles}
          prompt={prompt}
          setPrompt={setPrompt}
          onResetPrompt={resetPromptToDefault}
          canSubmit={canSubmit}
          onSubmit={submit}
          submitTitle={submitTitle}
        />

        {/* Right: Cards */}
        <RequestsSection
          cards={cards}
          rawViewById={rawViewById}
          onToggleRaw={(id) => setRawViewById((m) => ({ ...m, [id]: !m[id] }))}
          onCopy={copy}
          onExpand={(id) => setExpandedId(id)}
          onCancel={(id) => {
            const card = cards.find((c) => c.id === id);
            if (card) cancelCard(card);
          }}
          onRetry={retry}
          onRetrySubRequest={retrySubRequest}
          onClearAll={clearAllRequests}
          onClose={removeCard}
        />
      </div>

      {/* Confirm clear files on mode switch */}
      <SwitchModeDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          clearAllFiles();
          if (pendingMode) setMode(pendingMode);
          setPendingMode(null);
        }}
      />

      {/* Result Dialog */}
      <ResultDialog
        openId={expandedId}
        onOpenChange={(open) => {
          if (!open) setExpandedId(null);
        }}
        card={selectedCard}
        text={selectedCard?.resultText}
        files={selectedCard?.files}
        audioFile={
          selectedCard?.mode === "audio" && selectedCard.status === "complete"
            ? (selectedCard?.filesBlob?.[0]?.file ?? null)
            : null
        }
        raw={!!(expandedId && rawViewById[expandedId])}
        onToggleRaw={() =>
          expandedId &&
          setRawViewById((m) => ({
            ...m,
            [expandedId]: !m[expandedId],
          }))
        }
        onCopy={(text) => copy(text)}
      />

      <Toasts toasts={toasts} />
    </div>
  );
}
