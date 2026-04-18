import { NextResponse } from "next/server";
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
import { generateMyDataQR } from "@/lib/country/providers/gr/integrations/mydata/qr";
import { getCountryProvider } from "@/lib/country";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.orgId, session.org.id)));

  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id))
    .orderBy(asc(invoiceItems.sortOrder));

  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, session.org.id));

  let mydataQrDataUrl: string | undefined;
  let mydataMark: string | undefined;
  const provider = getCountryProvider(session.org.countryCode);
  const mydataIntegration = provider.integrations.find(
    (i) => i.kind === "mydata",
  );
  if (mydataIntegration) {
    const [confirmedSub] = await db
      .select()
      .from(countryIntegrationSubmissions)
      .where(
        and(
          eq(countryIntegrationSubmissions.invoiceId, id),
          eq(countryIntegrationSubmissions.countryCode, provider.code),
          eq(countryIntegrationSubmissions.kind, "mydata"),
          eq(
            countryIntegrationSubmissions.status,
            COUNTRY_INTEGRATION_SUBMISSION_STATUS.CONFIRMED,
          ),
        ),
      )
      .orderBy(desc(countryIntegrationSubmissions.createdAt))
      .limit(1);
    if (confirmedSub?.qrUrl) {
      mydataQrDataUrl = await generateMyDataQR(confirmedSub.qrUrl);
    }
    if (confirmedSub?.externalId) {
      mydataMark = confirmedSub.externalId;
    }
  }

  const html = renderInvoicePdfHtml({
    invoice,
    items,
    org,
    mydataQrDataUrl,
    mydataMark,
  });
  const pdf = await generatePdfFromHtml(html);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
