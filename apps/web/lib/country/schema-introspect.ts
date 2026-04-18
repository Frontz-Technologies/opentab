import type { z } from "zod";

export interface IntrospectedField {
  name: string;
  kind: "string" | "enum" | "boolean" | "number";
  required: boolean;
  options?: string[];
}

/**
 * Walks a zod object schema and extracts a flat field list suitable
 * for rendering the generic integration credentials form. Supports
 * strings, enums, booleans, and numbers. Anything more exotic should
 * ship its own settingsPage component.
 */
export function introspectZodSchema(schema: z.ZodSchema): IntrospectedField[] {
  const anySchema = schema as unknown as { shape?: unknown; _def?: unknown };
  let shape: Record<string, unknown> | undefined;

  if (anySchema.shape && typeof anySchema.shape === "object") {
    shape = anySchema.shape as Record<string, unknown>;
  } else if (
    anySchema._def &&
    typeof anySchema._def === "object" &&
    "shape" in (anySchema._def as Record<string, unknown>)
  ) {
    const inner = (anySchema._def as Record<string, unknown>).shape;
    if (typeof inner === "function") {
      shape = (inner as () => Record<string, unknown>)();
    } else if (typeof inner === "object" && inner !== null) {
      shape = inner as Record<string, unknown>;
    }
  }

  if (!shape) return [];

  const fields: IntrospectedField[] = [];
  for (const [name, raw] of Object.entries(shape)) {
    fields.push(describe(name, raw));
  }
  return fields;
}

function getTypeName(schema: unknown): string | undefined {
  const s = schema as { _def?: { typeName?: string; type?: string } } | null;
  return s?._def?.typeName ?? s?._def?.type;
}

function describe(name: string, schema: unknown): IntrospectedField {
  let required = true;
  let inner: unknown = schema;

  while (true) {
    const typeName = getTypeName(inner);
    if (
      typeName === "ZodOptional" ||
      typeName === "optional" ||
      typeName === "ZodNullable" ||
      typeName === "nullable"
    ) {
      required = false;
      const def = (inner as { _def?: Record<string, unknown> })._def;
      inner = def && "innerType" in def ? def.innerType : undefined;
      if (!inner) break;
      continue;
    }
    if (typeName === "ZodDefault" || typeName === "default") {
      required = false;
      const def = (inner as { _def?: Record<string, unknown> })._def;
      inner = def && "innerType" in def ? def.innerType : undefined;
      if (!inner) break;
      continue;
    }
    break;
  }

  const innerTypeName = getTypeName(inner);

  if (innerTypeName === "ZodEnum" || innerTypeName === "enum") {
    const def =
      (inner as { _def?: Record<string, unknown> } | null)?._def ?? {};
    let values: string[] = [];
    if (Array.isArray(def.values)) {
      values = def.values as string[];
    } else if (def.entries && typeof def.entries === "object") {
      values = Object.values(def.entries as Record<string, string>);
    } else if (def.options && Array.isArray(def.options)) {
      values = def.options as string[];
    }
    return { name, kind: "enum", required, options: values };
  }
  if (innerTypeName === "ZodBoolean" || innerTypeName === "boolean") {
    return { name, kind: "boolean", required };
  }
  if (innerTypeName === "ZodNumber" || innerTypeName === "number") {
    return { name, kind: "number", required };
  }
  return { name, kind: "string", required };
}
