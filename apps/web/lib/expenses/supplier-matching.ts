import { db } from "@/lib/db";
import { contacts } from "@opentab/db/schema";
import { eq, and, or, ilike } from "drizzle-orm";

interface SupplierMatch {
  contactId: string;
  displayName: string;
  confidence: "exact_vat" | "fuzzy_name";
}

export async function matchSupplier(
  orgId: string,
  vatNumber: string | null,
  name: string | null,
): Promise<SupplierMatch | null> {
  // Exact VAT match first
  if (vatNumber) {
    const [match] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.orgId, orgId),
          eq(contacts.vatNumber, vatNumber),
          or(eq(contacts.type, "supplier"), eq(contacts.type, "both")),
        ),
      )
      .limit(1);

    if (match) {
      return {
        contactId: match.id,
        displayName: match.displayName,
        confidence: "exact_vat",
      };
    }
  }

  // Fuzzy name match
  if (name && name.length >= 3) {
    const [match] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.orgId, orgId),
          or(eq(contacts.type, "supplier"), eq(contacts.type, "both")),
          or(
            ilike(contacts.displayName, `%${name}%`),
            ilike(contacts.company, `%${name}%`),
          ),
        ),
      )
      .limit(1);

    if (match) {
      return {
        contactId: match.id,
        displayName: match.displayName,
        confidence: "fuzzy_name",
      };
    }
  }

  return null;
}
