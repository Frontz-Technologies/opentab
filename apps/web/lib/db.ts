import { createDb } from "@opentab/db";

export const db = createDb(process.env.DATABASE_URL!);
