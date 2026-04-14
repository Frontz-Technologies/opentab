import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getAiSettingsSecret } from "@/lib/actions/ai-settings";
import { createAiProvider } from "@/lib/ai/provider";
import { aiRateLimiter } from "@/lib/ai/rate-limiter";
import { getSystemPrompt } from "@/lib/ai/system-prompt";
import { createTools } from "@/lib/ai/tools";
import type { ConfirmToolCall } from "@/lib/ai/types";
import { getSession } from "@/lib/session";

type ChatRequestBody = {
  messages?: UIMessage[];
  confirmToolCall?: ConfirmToolCall;
};

export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const settings = await getAiSettingsSecret(session.org.id);
  if (!settings?.enabled || !settings.apiKey) {
    return new Response("AI not configured", { status: 400 });
  }

  const rateLimit = aiRateLimiter.check(session.org.id);
  if (!rateLimit.allowed) {
    return new Response("AI rate limit exceeded", { status: 429 });
  }

  const body = (await req.json()) as ChatRequestBody;
  const messages = await convertToModelMessages(body.messages ?? []);
  const model = createAiProvider(settings.apiKey, settings.model);
  const tools = createTools(session.org.id, {
    role: session.role,
    confirmToolCall: body.confirmToolCall,
  });
  const system = getSystemPrompt(session);

  const result = streamText({
    model,
    system,
    messages,
    tools,
  });

  return result.toUIMessageStreamResponse();
}
