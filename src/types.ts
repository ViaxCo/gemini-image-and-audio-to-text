export type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
};

export type FileMeta = { name: string; size: number; type: string };

export type SubRequest = {
  id: string;
  index: number;
  label: string;
  status: "queued" | "running" | "complete" | "failed" | "canceled";
  fileCount: number;
  resultText?: string;
  error?: string;
  usage?: Usage;
  startedAt?: number;
  finishedAt?: number;
};

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
  isBatch?: boolean;
  totalFiles?: number;
  batchSize?: number;
  batchConfig?: {
    maxFilesPerRequest: number;
    maxRequestsPerMinute: number;
  };
  subRequests?: SubRequest[];
  completedPrefixCount?: number;
  combinedText?: string;
  pendingRetryCount?: number;
  nextWaveEta?: number | null;
};
