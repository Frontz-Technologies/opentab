import { db } from "@/lib/db";
import { contacts } from "@opentab/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface SupplierMatch {
  contactId: string;
  displayName: string;
  matchType: "vat_exact" | "name_fuzzy";
  confidence: number;
}

export async function matchSupplier(
  orgId: string,
  extractedSupplier: { name?: string; vatNumber?: string },
): Promise<SupplierMatch | null> {
  // Step 1: Exact VAT match (highest confidence)
  if (extractedSupplier.vatNumber) {
    const suppliers = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.orgId, orgId),
          eq(contacts.vatNumber, extractedSupplier.vatNumber),
          inArray(contacts.type, ["supplier", "both"]),
        ),
      );

    if (suppliers.length > 0) {
      return {
        contactId: suppliers[0].id,
        displayName: suppliers[0].displayName,
        matchType: "vat_exact",
        confidence: 1.0,
      };
    }
  }

  // Step 2: Fuzzy name match (suggestion only)
  if (extractedSupplier.name) {
    const suppliers = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.orgId, orgId),
          inArray(contacts.type, ["supplier", "both"]),
        ),
      );

    const match = findBestFuzzyMatch(extractedSupplier.name, suppliers);
    if (match && match.score > 0.7) {
      return {
        contactId: match.contact.id,
        displayName: match.contact.displayName,
        matchType: "name_fuzzy",
        confidence: match.score,
      };
    }
  }

  return null;
}

interface FuzzyMatchResult {
  contact: { id: string; displayName: string };
  score: number;
}

function findBestFuzzyMatch(
  name: string,
  suppliers: Array<{ id: string; displayName: string; company: string | null }>,
): FuzzyMatchResult | null {
  const normalizedName = name.toLowerCase().trim();
  let bestMatch: FuzzyMatchResult | null = null;

  for (const supplier of suppliers) {
    const candidates = [
      supplier.displayName.toLowerCase().trim(),
      supplier.company?.toLowerCase().trim(),
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      const score = calculateSimilarity(normalizedName, candidate);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { contact: supplier, score };
      }
    }
  }

  return bestMatch;
}

function calculateSimilarity(a: string, b: string): number {
  // Exact match
  if (a === b) return 1.0;

  // Contains match
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return 0.7 + 0.3 * (shorter / longer);
  }

  // Trigram similarity
  const trigramsA = getTrigrams(a);
  const trigramsB = getTrigrams(b);
  const intersection = trigramsA.filter((t) => trigramsB.includes(t));
  const union = new Set([...trigramsA, ...trigramsB]);

  if (union.size === 0) return 0;
  return intersection.length / union.size;
}

function getTrigrams(s: string): string[] {
  const padded = `  ${s} `;
  const trigrams: string[] = [];
  for (let i = 0; i < padded.length - 2; i++) {
    trigrams.push(padded.substring(i, i + 3));
  }
  return trigrams;
}
