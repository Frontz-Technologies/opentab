import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import {
  invoices,
  invoiceItems,
  organisations,
  countryIntegrationSubmissions,
  COUNTRY_INTEGRATION_SUBMISSION_STATUS,
} from "@opentab/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { generatePdfFromHtml } from "@/lib/invoicing/pdf";
import { renderInvoicePdfHtml } from "@/components/invoicing/invoice-pdf-template";
import { getCountryProvider } from "@/lib/country";
import { createLogger } from "@/lib/logging/logger";

const log = createLogger("invoice-pdf-route");

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

  const done = log.time("pdf-generate");

  try {
    const [[invoice], items, [org]] = await Promise.all([
      db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id))),
      db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, id))
        .orderBy(asc(invoiceItems.sortOrder)),
      db
        .select()
        .from(organisations)
        .where(eq(organisations.id, session.org.id)),
    ]);

    if (!invoice) {
      log.warn("invoice not found", {
        requestId,
        invoiceId: id,
        orgId: session.org.id,
      });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const provider = getCountryProvider(session.org.countryCode);

    const pdfBlocks: { footer: string[] } = { footer: [] };
    for (const integration of provider.integrations) {
      if (!integration.renderOnPdf) continue;
      const [confirmedSub] = await db
        .select()
        .from(countryIntegrationSubmissions)
        .where(
          and(
            eq(countryIntegrationSubmissions.invoiceId, id),
            eq(countryIntegrationSubmissions.countryCode, provider.code),
            eq(countryIntegrationSubmissions.kind, integration.kind),
            eq(
              countryIntegrationSubmissions.status,
              COUNTRY_INTEGRATION_SUBMISSION_STATUS.CONFIRMED,
            ),
          ),
        )
        .orderBy(desc(countryIntegrationSubmissions.createdAt))
        .limit(1);
      if (!confirmedSub) continue;
      const block = await integration.renderOnPdf({
        invoice: { invoiceNumber: invoice.invoiceNumber },
        submission: {
          externalId: confirmedSub.externalId,
          qrUrl: confirmedSub.qrUrl,
        },
      });
      if (block) pdfBlocks.footer.push(block);
    }

    const html = renderInvoicePdfHtml({
      invoice,
      items,
      org,
      pdfBlocks,
    });
    const pdf = await generatePdfFromHtml(html);

    done("pdf generated", {
      requestId,
      invoiceId: id,
      orgId: session.org.id,
      countryCode: provider.code,
      itemCount: items.length,
      footerBlockCount: pdfBlocks.footer.length,
      htmlBytes: html.length,
      pdfBytes: pdf.length,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (err) {
    const errorName = err instanceof Error ? err.name : "Unknown";
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error("pdf generation failed", {
      requestId,
      invoiceId: id,
      orgId: session.org.id,
      errorName,
      errorMessage,
    });
    return NextResponse.json(
      {
        error: "PDF generation failed. Please try again.",
        requestId,
      },
      { status: 500 },
    );
  }
}
