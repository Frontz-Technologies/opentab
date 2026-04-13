import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { invoices, invoiceItems, organisations } from "@opentab/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { generatePdfFromHtml } from "@/lib/invoicing/pdf";
import { renderInvoicePdfHtml } from "@/components/invoicing/invoice-pdf-template";
import { generateMyDataQR } from "@/lib/mydata/qr";

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
  if (invoice.mydataQrUrl) {
    mydataQrDataUrl = await generateMyDataQR(invoice.mydataQrUrl);
  }

  const html = renderInvoicePdfHtml({ invoice, items, org, mydataQrDataUrl });
  const pdf = await generatePdfFromHtml(html);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
