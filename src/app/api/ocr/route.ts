import { google } from "@ai-sdk/google";
import { streamText } from "ai";

export const runtime = "nodejs";
// Allow longer streaming for many images
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const prompt = String(form.get("prompt") || "");
    const files = form.getAll("files") as File[];
    if (!files.length) {
      return Response.json(
        { ok: false, error: "No files uploaded." },
        { status: 400 },
      );
    }

    type UserContent =
      | { type: "text"; text: string }
      | { type: "file"; data: Uint8Array; mediaType: string };

    const content: UserContent[] = [{ type: "text", text: prompt }];
    for (const f of files) {
      content.push({
        type: "file",
        data: new Uint8Array(await f.arrayBuffer()),
        mediaType: f.type || "image/jpeg",
      });
    }

    const result = streamText({
      model: google("gemini-2.5-flash"),
      messages: [{ role: "user", content }],
    });

    // Use AI SDK data stream so client can read usage (token counts)
    // Also emit message-level metadata with usage for broader compatibility.
    return result.toUIMessageStreamResponse({
      messageMetadata: ({ part }) => {
        if (part.type === "finish") {
          // Prefer normalized totalUsage; fall back to Google provider's usageMetadata
          const googleMeta = (
            part as unknown as {
              response?: {
                providerMetadata?: { google?: { usageMetadata?: unknown } };
              };
            }
          )?.response?.providerMetadata?.google;
          const usageFromProvider = googleMeta?.usageMetadata;
          const fallback = usageFromProvider
            ? {
                inputTokens: usageFromProvider.promptTokenCount,
                outputTokens: usageFromProvider.candidatesTokenCount,
                totalTokens: usageFromProvider.totalTokenCount,
              }
            : undefined;
          return { totalUsage: part.totalUsage ?? fallback } as unknown;
        }
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unexpected server error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
