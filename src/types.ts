export type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
};

export type FileMeta = { name: string; size: number; type: string };

export type Card = {
  id: string;
  prompt: string;
  files: FileMeta[];
  filesBlob?: { file: File }[]; // for Retry only
  status: "processing" | "complete" | "failed";
  resultMarkdown?: string;
  error?: string;
  createdAt: number;
  usage?: Usage;
  // Extra guard: store a computed total for display reliability
  usageTotal?: number;
};
