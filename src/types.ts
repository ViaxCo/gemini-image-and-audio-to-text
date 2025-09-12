export type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
};

export type FileMeta = { name: string; size: number; type: string };

export type Card = {
  id: string;
  mode?: "image" | "audio";
  prompt: string;
  files: FileMeta[];
  filesBlob?: { file: File }[]; // for Retry only
  status: "processing" | "complete" | "failed";
  resultText?: string;
  error?: string;
  createdAt: number;
  usage?: Usage;
  // Extra guard: store a computed total for display reliability
  usageTotal?: number;
};
