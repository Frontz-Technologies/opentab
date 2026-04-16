import { tool, zodSchema } from "ai";
import type { z } from "zod";

/**
 * Wrapper around AI SDK's tool() that handles Zod v4 type incompatibility.
 * The zodSchema() function works correctly at runtime with Zod v4, but
 * TypeScript overload resolution fails. This helper bypasses the type check.
 */
export function defineTool<T extends z.ZodType>(options: {
  description: string;
  parameters: T;
  execute: (args: z.infer<T>) => Promise<unknown>;
}) {
  return (tool as Function)({
    description: options.description,
    parameters: zodSchema(options.parameters),
    execute: options.execute,
  });
}
