import { z } from "zod";
import { products } from "@opentab/db/schema";

export { products };

export const createProductSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional().default(""),
  unitPrice: z.coerce.number().min(0, "Price must be non-negative"),
  unit: z.enum(["item", "hour", "day", "service", "kg", "unit"]),
  taxCategory: z.enum([
    "standard",
    "reduced",
    "super_reduced",
    "zero_rated",
    "exempt",
    "reverse_charge",
  ]),
  vatRate: z.coerce.number().min(0).max(100).optional(),
  active: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "on"),
});

export const updateProductSchema = createProductSchema;

export type ProductCreateInput = z.infer<typeof createProductSchema>;
export type ProductUpdateInput = z.infer<typeof updateProductSchema>;
