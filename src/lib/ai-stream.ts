// Centralized helpers for reading AI SDK data stream responses (SSE over fetch body)
// This consolidates identical logic used by submit/retry flows while preserving behavior.

export type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
};

// Subset of events we care about from AI SDK data stream
export type StreamEvent =
  | { type: "text-delta"; textDelta?: string; delta?: string }
  | {
      type: "finish";
      totalUsage?: Usage;
      usage?: Usage;
      data?: { totalUsage?: Usage; usage?: Usage };
      messageMetadata?: { totalUsage?: Usage; usage?: Usage };
    }
  | {
      type: "message-metadata";
      metadata?: { totalUsage?: Usage; usage?: Usage };
      data?: { totalUsage?: Usage; usage?: Usage };
    }
  | { type: "error"; error?: unknown; errorText?: string }
  | { type: string };

export type StreamHandlers = {
  onTextDelta: (delta: string) => void;
  onUsage: (usage: Usage | undefined) => void;
  onError: (message: string) => void;
};

// Normalizes various provider-specific shapes into a single Usage object when available.
function extractUsageFromFinish(evt: StreamEvent): Usage | undefined {
  const e = evt as {
    totalUsage?: Usage;
    usage?: Usage;
    data?: { totalUsage?: Usage; usage?: Usage };
    messageMetadata?: { totalUsage?: Usage; usage?: Usage };
  };
  return (
    e?.totalUsage ||
    e?.usage ||
    e?.data?.totalUsage ||
    e?.data?.usage ||
    e?.messageMetadata?.totalUsage ||
    e?.messageMetadata?.usage ||
    undefined
  );
}

function extractUsageFromMetadata(evt: StreamEvent): Usage | undefined {
  const e = evt as {
    metadata?: { totalUsage?: Usage; usage?: Usage };
    data?: { totalUsage?: Usage; usage?: Usage };
  };
  const meta = (e?.metadata ||
    e?.data ||
    (evt as unknown as Record<string, unknown>)) as
    | { totalUsage?: Usage; usage?: Usage }
    | undefined;
  return meta?.totalUsage || meta?.usage || undefined;
}

// Reads an AI SDK data stream from a fetch Response body and dispatches events.
// Returns a boolean indicating whether any text delta was received (for empty-response handling).
export async function readAiSdkStream(
  body: ReadableStream<Uint8Array>,
  handlers: StreamHandlers,
): Promise<boolean> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let gotData = false;
  let done = false;

  const handleEvent = (evt: StreamEvent) => {
    if (!evt || typeof evt !== "object") return;
    switch (evt.type) {
      case "text-delta": {
        const delta: string =
          (evt as { textDelta?: string; delta?: string }).textDelta ||
          (evt as { textDelta?: string; delta?: string }).delta ||
          "";
        if (delta) {
          gotData = true;
          handlers.onTextDelta(delta);
        }
        break;
      }
      case "finish": {
        const usage = extractUsageFromFinish(evt);
        handlers.onUsage(usage);
        break;
      }
      case "message-metadata": {
        const usage = extractUsageFromMetadata(evt);
        if (usage) handlers.onUsage(usage);
        break;
      }
      case "error": {
        const message =
          typeof (evt as { error?: unknown }).error === "string"
            ? ((evt as { error?: string }).error as string)
            : (evt as { errorText?: string }).errorText ||
              (evt as { error?: { message?: string } }).error?.message ||
              "Unknown error";
        handlers.onError(message);
        break;
      }
      default:
        break;
    }
  };

  const processBuffer = () => {
    // SSE events are separated by double newlines
    let sepIndex = buffer.indexOf("\n\n");
    while (sepIndex !== -1) {
      const rawEvent = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      sepIndex = buffer.indexOf("\n\n");
      const lines = rawEvent.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;
        try {
          const evt = JSON.parse(jsonStr) as StreamEvent;
          handleEvent(evt);
        } catch {
          // ignore parse errors for non-JSON data lines
        }
      }
    }
  };

  while (!done) {
    const { value, done: d } = await reader.read();
    done = d;
    if (value) {
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      processBuffer();
    }
  }
  // Flush any remaining buffered event
  if (buffer.length) processBuffer();

  return gotData;
}

// Small math helper used by callers for consistent total computation.
export function computeUsageTotal(usage?: Usage): number | undefined {
  return (
    usage?.totalTokens ??
    (typeof usage?.inputTokens === "number" &&
    typeof usage?.outputTokens === "number"
      ? usage.inputTokens + usage.outputTokens
      : undefined)
  );
}
