import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { getAiSettingsSecret } from "@/lib/actions/ai-settings";
import { createAiProvider } from "@/lib/ai/provider";
import { aiRateLimiter } from "@/lib/ai/rate-limiter";
import { getSystemPrompt } from "@/lib/ai/system-prompt";
import { createTools } from "@/lib/ai/tools";
import type { ConfirmToolCall } from "@/lib/ai/types";
import { getSession } from "@/lib/session";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("ai-chat");

type ChatRequestBody = {
  messages?: UIMessage[];
  confirmToolCall?: ConfirmToolCall;
};

export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const orgId = session.org.id;

  const settings = await getAiSettingsSecret(orgId);
  if (!settings?.enabled || !settings.apiKey) {
    log.warn("AI chat request with no config", { orgId });
    return new Response("AI not configured", { status: 400 });
  }

  const rateLimit = aiRateLimiter.check(orgId);
  if (!rateLimit.allowed) {
    log.warn("AI rate limit exceeded", {
      orgId,
      remaining: rateLimit.remaining,
    });
    return new Response("AI rate limit exceeded", { status: 429 });
  }

  log.info("AI chat request", {
    orgId,
    model: settings.model,
    remaining: rateLimit.remaining,
  });

  const done = log.time("ai-chat-stream");

  const body = (await req.json()) as ChatRequestBody;
  const messages = await convertToModelMessages(body.messages ?? []);
  const model = createAiProvider(settings.apiKey, settings.model);
  const tools = createTools(orgId, {
    role: session.role,
    confirmToolCall: body.confirmToolCall,
  });
  const system = await getSystemPrompt(session);

  const result = streamText({
    model,
    system,
    messages,
    tools,
    stopWhen: stepCountIs(5),
  });

  done("AI chat stream initiated", {
    orgId,
    messageCount: messages.length,
  });

  return result.toUIMessageStreamResponse();
}
