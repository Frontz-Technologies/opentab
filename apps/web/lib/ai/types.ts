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
  toolCallId: string;
  approved: boolean;
};
