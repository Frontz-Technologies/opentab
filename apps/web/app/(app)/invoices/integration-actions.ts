"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  submitInvoiceThroughPlugins,
  cancelInvoiceOnPlugins,
} from "@/lib/country/submit-invoice";

export async function retryIntegrationSubmission(invoiceId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const results = await submitInvoiceThroughPlugins(invoiceId, {
    id: session.org.id,
    taxId: session.org.taxId,
    countryCode: session.org.countryCode,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);

  const firstFail = results.find((r) => !r.ok);
  if (firstFail) return { success: false, error: firstFail.error };
  return { success: true };
}

export async function cancelIntegrationSubmission(invoiceId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const results = await cancelInvoiceOnPlugins(invoiceId, {
    id: session.org.id,
    taxId: session.org.taxId,
    countryCode: session.org.countryCode,
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);

  const firstFail = results.find((r) => !r.ok);
  if (firstFail) return { success: false, error: firstFail.error };
  return { success: true };
}
