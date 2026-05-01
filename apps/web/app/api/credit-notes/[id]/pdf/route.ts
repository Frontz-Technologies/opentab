import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import {
  creditNotes,
  creditNoteItems,
  invoices,
  organisations,
} from "@opentab/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { generatePdfFromHtml } from "@/lib/invoicing/pdf";
import { renderCreditNotePdfHtml } from "@/components/invoicing/credit-note-pdf-template";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("credit-note-pdf-route");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const requestId = randomUUID();
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const done = log.time("credit-note-pdf-generate");

  try {
    const [[creditNote], items, [org]] = await Promise.all([
      db
        .select()
        .from(creditNotes)
        .where(
          and(eq(creditNotes.id, id), eq(creditNotes.orgId, session.org.id)),
        ),
      db
        .select()
        .from(creditNoteItems)
        .where(eq(creditNoteItems.creditNoteId, id))
        .orderBy(asc(creditNoteItems.sortOrder)),
      db
        .select()
        .from(organisations)
        .where(eq(organisations.id, session.org.id)),
    ]);

    if (!creditNote) {
      log.warn("credit note not found", {
        requestId,
        creditNoteId: id,
        orgId: session.org.id,
      });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // #274: scope the parent-invoice lookup by orgId. creditNote.invoiceId
    // is a foreign-key field that the create/update flow does not
    // validate as same-org (the schema accepts any UUID). Without the
    // orgId clause, an attacker who set creditNote.invoiceId to another
    // org's invoice would have that org's invoice number embedded in
    // the rendered PDF. Mirror of the credit-notes/[id]/page.tsx fix.
    let invoiceNumber: string | null = null;
    if (creditNote.invoiceId) {
      const [inv] = await db
        .select({ invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .where(
          and(
            eq(invoices.id, creditNote.invoiceId),
            eq(invoices.orgId, session.org.id),
          ),
        );
      invoiceNumber = inv?.invoiceNumber ?? null;
    }

    const html = renderCreditNotePdfHtml({
      creditNote,
      items,
      org,
      invoiceNumber,
    });
    const pdf = await generatePdfFromHtml(html);

    done("credit note pdf generated", {
      requestId,
      creditNoteId: id,
      orgId: session.org.id,
      itemCount: items.length,
      htmlBytes: html.length,
      pdfBytes: pdf.length,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${creditNote.creditNoteNumber ?? `draft-cn-${creditNote.id.slice(0, 8)}`}.pdf"`,
      },
    });
  } catch (err) {
    const errorName = err instanceof Error ? err.name : "Unknown";
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error("credit note pdf failed", {
      requestId,
      creditNoteId: id,
      orgId: session.org.id,
      errorName,
      errorMessage,
    });
    return NextResponse.json(
      { error: "PDF generation failed. Please try again.", requestId },
      { status: 500 },
    );
  }
}
