export type AiStreamState =
  | { type: "system"; threadId: string }
  | { type: "textDelta"; text: string }
  | { type: "toolCall"; toolCallId: string; toolName: string; args: unknown }
  | {
      type: "toolResult";
      toolCallId: string;
      toolName: string;
      result: unknown;
    }
  | {
      type: "confirmation";
      toolCallId: string;
      toolName: string;
      summary: unknown;
    }
  | { type: "error"; message: string }
  | { type: "done" };

export type ConfirmToolCall = {
  approved: boolean;
  toolName: string;
  args: unknown;
};

export type PendingConfirmation = {
  confirmation: true;
  toolName: string;
  args: unknown;
  summary: {
    title: string;
    details: string[];
  };
};

export function isPendingConfirmation(
  value: unknown,
): value is PendingConfirmation {
  return (
    typeof value === "object" &&
    value !== null &&
    "confirmation" in value &&
    (value as { confirmation?: unknown }).confirmation === true &&
    "toolName" in value &&
    typeof (value as { toolName?: unknown }).toolName === "string"
  );
}
