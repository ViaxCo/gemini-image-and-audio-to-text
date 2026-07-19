export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

const EXCLUDED_MODEL_PARTS = [
  "antigravity",
  "computer-use",
  "deep-research",
  "embedding",
  "image",
  "imagen",
  "live",
  "lyria",
  "music",
  "native-audio",
  "omni",
  "robotics",
  "tts",
  "veo",
];

function isEligibleModel(model: {
  name?: string;
  supportedGenerationMethods?: string[];
}) {
  const id = model.name?.replace(/^models\//, "") ?? "";

  return (
    id.startsWith("gemini-") &&
    model.supportedGenerationMethods?.includes("generateContent") === true &&
    !EXCLUDED_MODEL_PARTS.some((part) => id.includes(part))
  );
}

function modelLabel(id: string, displayName?: string) {
  const name = displayName || id;
  let variant = "";

  if (id.includes("experimental") || id.includes("-exp")) {
    variant = "Experimental";
  } else if (id.includes("preview")) {
    variant = "Preview";
  } else if (id.includes("latest")) {
    variant = "Latest";
  }

  return variant && !name.toLowerCase().includes(variant.toLowerCase())
    ? `${name} (${variant})`
    : name;
}

function modelRank(id: string) {
  if (id === DEFAULT_GEMINI_MODEL) return 0;
  if (id.includes("experimental") || id.includes("-exp")) return 4;
  if (id.includes("preview")) return 3;
  if (id.includes("latest")) return 2;
  return 1;
}

export async function fetchGeminiModels(apiKey: string, signal?: AbortSignal) {
  const models: { id: string; name: string }[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      "https://generativelanguage.googleapis.com/v1beta/models",
    );
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { "x-goog-api-key": apiKey },
      signal,
    });

    if (!response.ok) {
      throw new Error(`Gemini model request failed (${response.status})`);
    }

    const data = (await response.json()) as {
      models?: {
        name?: string;
        displayName?: string;
        supportedGenerationMethods?: string[];
      }[];
      nextPageToken?: string;
    };

    for (const model of data.models ?? []) {
      if (!isEligibleModel(model)) continue;
      const id = model.name?.replace(/^models\//, "");
      if (id) models.push({ id, name: modelLabel(id, model.displayName) });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return [...new Map(models.map((model) => [model.id, model])).values()].sort(
    (a, b) => modelRank(a.id) - modelRank(b.id) || a.name.localeCompare(b.name),
  );
}
