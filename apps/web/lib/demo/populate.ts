import { eq, sql } from "drizzle-orm";
import * as schema from "@opentab/db/schema";
import type { db as prodDb } from "@/lib/db";
import { calculateLineTotal } from "@/lib/invoicing/calculations";
import { ensureCategoriesSeeded } from "@/lib/expenses/category-seed";
import { createRng, type Rng } from "./rng";

type Db = typeof prodDb;
import {
  DEMO_ORG,
  CLIENTS,
  SUPPLIERS,
  PRODUCTS,
  REVENUE_CURVE,
  INVOICE_NARRATIVES,
  EXPENSE_MEMOS,
  type ClientSeed,
  type SupplierSeed,
  type ProductSeed,
} from "./data-pool";

const {
  contacts,
  products,
  invoices,
  invoiceItems,
  expenses,
  expenseItems,
  expenseCategories,
  invoiceSequences,
  activities,
  users,
} = schema;

// Activity types used by the seed. Kept inline (not imported from
// @/lib/entities/activity) to avoid coupling the demo seed to an
// app-side module — populate.ts is intentionally db-only.
const ACTIVITY = {
  CREATED: "invoice.created",
  SENT: "invoice.sent",
  PAID: "invoice.paid",
  CANCELLED: "invoice.cancelled",
} as const;

// VAT rate mapping for GR tax categories. Kept local to demo — the
// real runtime derives this per country provider, but the demo only
// needs a representative number so the math looks right.
const VAT_RATES: Record<string, string> = {
  standard: "24",
  reduced: "13",
  super_reduced: "6",
  zero_rated: "0",
  exempt: "0",
  reverse_charge: "0",
};

// Invoice-line quantity range per product unit. Uniform rng.int(1, 60) on
// fixed-price items (e.g. "Tech due-diligence report", €4,500 flat) would
// blow a single line up to €270K and wreck the dashboard P&L — so the
// range is unit-aware.
function pickInvoiceQty(unit: string, rng: Rng): number {
  switch (unit) {
    case "hour":
      return rng.int(8, 80); // ~a week to a couple months of work
    case "day":
      return rng.int(1, 10); // up to two work weeks
    case "unit":
      return rng.int(1, 5); // 1–5 workstations per resale order
    case "kg":
      return rng.int(1, 20);
    case "item":
    case "service":
    default:
      return 1; // fixed-bundle or monthly retainer — one unit per line
  }
}

// Expense-row amount range per expense-group code. Without this the
// dashboard shows €600/month in expenses when the narrative claims €38K
// (payroll alone is ~€6.6K/month in a real tech SME). Keyed on the
// stable `groupCode` (not the country-prefixed `code`).
const EXPENSE_AMOUNT_BY_GROUP: Record<string, [number, number]> = {
  salaries: [2800, 3800], // monthly payroll per engineer
  rent: [1800, 1800], // monthly office rent
  servers: [600, 1500], // AWS / Hetzner / Vercel monthly
  utilities: [200, 350], // DEI bill
  telecom: [180, 280], // Cosmote Business monthly
  hardware: [2400, 4800], // laptop / monitor
  software: [50, 400], // GitHub / Linear / Figma / JetBrains
  travel: [380, 1600], // flights + hotels
  meals: [35, 140], // team lunch
  professional_services: [800, 800], // accountant quarterly
  car: [450, 450], // lease quarterly
  bank_fees: [20, 80],
  marketing: [500, 2500],
  training: [400, 2400],
  taxes_contributions: [500, 3000],
  transport: [30, 120],
  insurance: [150, 400],
  employee_benefits: [100, 600],
  repairs_maintenance: [150, 1500],
  purchases: [200, 2000],
  other: [100, 500],
};

function pickExpenseUnitPrice(groupCode: string, rng: Rng): string {
  const [lo, hi] = EXPENSE_AMOUNT_BY_GROUP[groupCode] ?? [100, 500];
  const cents = rng.int(lo * 100, hi * 100);
  return (cents / 100).toFixed(2);
}

export interface PopulateResult {
  contactCount: number;
  productCount: number;
  invoiceCount: number;
  expenseCount: number;
}

export async function populateOrgDemo(
  db: Db,
  orgId: string,
  seed = 0xdeadbeef,
): Promise<PopulateResult> {
  const rng = createRng(seed);
  const today = new Date();

  // Fixes the silent-zero-expenses bug: expense categories are seeded
  // lazily on /expenses/* route visits, so a freshly-provisioned demo org
  // had none and seedExpenses hit its empty-array guard.
  await ensureCategoriesSeeded(orgId, DEMO_ORG.countryCode, db);

  const insertedContacts = await seedContacts(db, orgId, rng);
  const insertedProducts = await seedProducts(db, orgId);
  const categoryRows = await db
    .select({
      id: expenseCategories.id,
      code: expenseCategories.code,
      groupCode: expenseCategories.groupCode,
    })
    .from(expenseCategories)
    .where(eq(expenseCategories.orgId, orgId));
  await seedInvoices(
    db,
    orgId,
    insertedContacts.clients,
    insertedProducts,
    rng,
    today,
  );
  await seedExpenses(
    db,
    orgId,
    insertedContacts.suppliers,
    categoryRows,
    rng,
    today,
  );

  const result: PopulateResult = {
    contactCount:
      insertedContacts.clients.length + insertedContacts.suppliers.length,
    productCount: insertedProducts.length,
    invoiceCount: INVOICE_COUNT,
    expenseCount: EXPENSE_COUNT,
  };

  await assertPopulateResult(db, orgId, result);

  return result;
}

const INVOICE_COUNT = 48;
const EXPENSE_COUNT = 70;

interface InsertedContact {
  id: string;
  displayName: string;
  email: string | null;
  vat: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
  countryCode: string;
  paymentTerms: number;
}

interface InsertedProduct {
  id: string;
  name: string;
  unitPrice: string;
  unit: string;
  taxCategory: string;
}

async function seedContacts(
  db: Db,
  orgId: string,
  _rng: Rng,
): Promise<{ clients: InsertedContact[]; suppliers: InsertedContact[] }> {
  const clients: InsertedContact[] = [];
  for (const c of CLIENTS) {
    const [row] = await db
      .insert(contacts)
      .values(clientRow(orgId, c))
      .returning();
    clients.push({
      id: row.id,
      displayName: row.displayName,
      email: row.email,
      vat: row.vatNumber,
      addressLine1: row.addressLine1,
      city: row.city,
      postalCode: row.postalCode,
      countryCode: row.countryCode ?? c.countryCode,
      paymentTerms: c.paymentTerms,
    });
  }
  const suppliers: InsertedContact[] = [];
  for (const s of SUPPLIERS) {
    const [row] = await db
      .insert(contacts)
      .values(supplierRow(orgId, s))
      .returning();
    suppliers.push({
      id: row.id,
      displayName: row.displayName,
      email: row.email,
      vat: row.vatNumber,
      addressLine1: null,
      city: null,
      postalCode: null,
      countryCode: row.countryCode ?? s.countryCode,
      paymentTerms: 30,
    });
  }
  return { clients, suppliers };
}

function clientRow(orgId: string, c: ClientSeed) {
  const displayName = c.company;
  return {
    orgId,
    type: "client" as const,
    classification: c.classification,
    company: c.company,
    firstName: c.firstName ?? null,
    lastName: c.lastName ?? null,
    displayName,
    email: c.email,
    phone: c.phone,
    vatNumber: c.vat,
    vatValidated: c.vat !== null,
    countryCode: c.countryCode,
    addressLine1: c.addressLine1,
    city: c.city,
    postalCode: c.postalCode,
    defaultCurrency: "EUR",
    defaultPaymentTerms: c.paymentTerms,
  };
}

function supplierRow(orgId: string, s: SupplierSeed) {
  return {
    orgId,
    type: "supplier" as const,
    classification: s.classification,
    company: s.company,
    displayName: s.company,
    email: s.email,
    phone: s.phone,
    vatNumber: s.vat,
    vatValidated: s.vat !== null,
    countryCode: s.countryCode,
    defaultCurrency: "EUR",
  };
}

async function seedProducts(db: Db, orgId: string): Promise<InsertedProduct[]> {
  const rows: InsertedProduct[] = [];
  for (const p of PRODUCTS) {
    const [r] = await db
      .insert(products)
      .values(productRow(orgId, p))
      .returning();
    rows.push({
      id: r.id,
      name: r.name,
      unitPrice: r.unitPrice,
      unit: r.unit,
      taxCategory: r.taxCategory,
    });
  }
  return rows;
}

function productRow(orgId: string, p: ProductSeed) {
  return {
    orgId,
    name: p.name,
    description: p.description,
    unitPrice: p.unitPrice,
    unit: p.unit,
    taxCategory: p.taxCategory,
    vatRate: VAT_RATES[p.taxCategory],
    active: true,
  };
}

async function seedInvoices(
  db: Db,
  orgId: string,
  clients: InsertedContact[],
  productRows: InsertedProduct[],
  rng: Rng,
  today: Date,
): Promise<void> {
  if (clients.length === 0) return;

  // Look up the demo org's owning user once so the seeded activities
  // attribute to a real user rather than the system. Falls back to
  // null (isSystem=true) if the demo user hasn't been provisioned yet
  // — first-run ordering of seed vs user creation isn't guaranteed.
  const [demoUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "demo@opentab.dev"));
  const seedUserId: string | null = demoUser?.id ?? null;

  // Distribute INVOICE_COUNT across 8 months using REVENUE_CURVE
  // weights so newer months have more volume — gives the dashboard a
  // believable upward hockey-stick. Uses the largest-remainder method
  // to guarantee the per-month counts sum to exactly INVOICE_COUNT
  // (plain Math.round drifts by ±1, which the postcondition catches).
  const totalWeight = REVENUE_CURVE.reduce((a, b) => a + b, 0);
  const raw = REVENUE_CURVE.map((w) => (w / totalWeight) * INVOICE_COUNT);
  const perMonth = raw.map((n) => Math.floor(n));
  const fracs = raw
    .map((n, i) => ({ i, frac: n - Math.floor(n) }))
    .sort((a, b) => b.frac - a.frac);
  let remaining = INVOICE_COUNT - perMonth.reduce((a, b) => a + b, 0);
  for (const { i } of fracs) {
    if (remaining <= 0) break;
    perMonth[i]++;
    remaining--;
  }

  let number = 1;
  const year = today.getFullYear();

  for (let m = 0; m < perMonth.length; m++) {
    const monthDate = new Date(
      today.getFullYear(),
      today.getMonth() - (7 - m),
      1,
    );
    const daysInMonth = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0,
    ).getDate();

    for (let i = 0; i < perMonth[m]; i++) {
      const client = rng.pick(clients);
      const day = rng.int(1, daysInMonth);
      const issueDate = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth(),
        day,
      );
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + (client.paymentTerms || 0));

      const lineCount = rng.int(1, 3);
      const chosen = rng.pickN(productRows, lineCount);
      // GR-domestic invoice → use the product's VAT band (standard/reduced).
      // Everything else (EU B2B cross-border or non-EU) → 0% manually.
      // No reverse-charge schema flag per product decision.
      const clientVatRate = client.countryCode === "GR" ? null : ("0" as const);
      const itemsInput = chosen.map((p) => {
        const qty = pickInvoiceQty(p.unit, rng);
        const taxRate = clientVatRate ?? VAT_RATES[p.taxCategory] ?? "24";
        const calc = calculateLineTotal({
          quantity: String(qty),
          unitPrice: p.unitPrice,
          taxRate,
          usesInclusiveTax: false,
        });
        return {
          productId: p.id,
          name: rng.pick(INVOICE_NARRATIVES) + " — " + p.name,
          description: null,
          quantity: String(qty),
          unitPrice: p.unitPrice,
          unit: p.unit,
          taxCategory: p.taxCategory,
          taxRate,
          taxAmount: calc.taxAmount,
          lineTotal: calc.lineTotal,
          netAmount: calc.netAmount,
        };
      });

      const subtotal = sumStr(itemsInput.map((it) => it.netAmount));
      const tax = sumStr(itemsInput.map((it) => it.taxAmount));
      const total = sumStr(itemsInput.map((it) => it.lineTotal));

      // Status distribution skewed by recency: older → more likely paid.
      const monthsOld = 7 - m;
      const statusRoll = rng.next();
      let status: 1 | 2 | 3 | 4 | 5;
      let amountPaid: string;
      let sentAt: Date | null = null;
      let paidAt: Date | null = null;
      if (monthsOld >= 3) {
        if (statusRoll < 0.75) {
          status = 4; // paid
          amountPaid = total;
          sentAt = issueDate;
          paidAt = dueDate;
        } else if (statusRoll < 0.9) {
          status = 3; // partial
          amountPaid = (parseFloat(total) * 0.4).toFixed(2);
          sentAt = issueDate;
        } else {
          status = 5; // cancelled
          amountPaid = "0.00";
        }
      } else {
        if (statusRoll < 0.35) {
          status = 2; // sent
          amountPaid = "0.00";
          sentAt = issueDate;
        } else if (statusRoll < 0.6) {
          status = 4; // paid (quick)
          amountPaid = total;
          sentAt = issueDate;
          paidAt = issueDate;
        } else {
          status = 1; // draft
          amountPaid = "0.00";
        }
      }
      const balance = (parseFloat(total) - parseFloat(amountPaid)).toFixed(2);

      // #132: drafts (status=1) seed with no invoice number — they
      // hold a slot in the table but don't reserve a number until
      // they're published/sent. This mirrors what real users see now.
      const seededNumber =
        status === 1 ? null : `INV-${year}-${String(number).padStart(4, "0")}`;
      const [inv] = await db
        .insert(invoices)
        .values({
          orgId,
          contactId: client.id,
          status,
          invoiceNumber: seededNumber,
          issueDate: toDateStr(issueDate),
          dueDate: toDateStr(dueDate),
          currencyCode: "EUR",
          subtotal,
          taxAmount: tax,
          total,
          amountPaid,
          balance,
          contactName: client.displayName,
          contactEmail: client.email,
          contactVatNumber: client.vat,
          contactAddress:
            [client.addressLine1, client.postalCode, client.city]
              .filter(Boolean)
              .join(", ") || null,
          sentAt,
          paidAt,
        })
        .returning();

      await db.insert(invoiceItems).values(
        itemsInput.map((it, idx) => ({
          invoiceId: inv.id,
          productId: it.productId,
          sortOrder: idx,
          name: it.name,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          unit: it.unit,
          taxCategory: it.taxCategory,
          taxRate: it.taxRate,
          taxAmount: it.taxAmount,
          lineTotal: it.lineTotal,
        })),
      );

      // Activity backfill (#131): synthesize a plausible audit trail
      // matching this invoice's terminal status. created → (sent) →
      // (paid|cancelled). Timestamps are anchored to issueDate /
      // paidAt so the CSV reads like a real timeline. status codes:
      // 1=DRAFT, 2=SENT, 3=PARTIAL, 4=PAID, 5=CANCELLED.
      const activityRows: Array<typeof activities.$inferInsert> = [];
      const createdAt = new Date(issueDate.getTime() - 60_000); // ~1 min before issue
      activityRows.push({
        orgId,
        entityType: "invoice",
        entityId: inv.id,
        userId: seedUserId,
        type: ACTIVITY.CREATED,
        payload: { status: 1, total, currency: "EUR" },
        isSystem: seedUserId === null,
        createdAt,
      });
      if (sentAt && status !== 1) {
        activityRows.push({
          orgId,
          entityType: "invoice",
          entityId: inv.id,
          userId: seedUserId,
          type: ACTIVITY.SENT,
          payload: { from: 1, to: 2, recipientEmail: client.email },
          isSystem: seedUserId === null,
          createdAt: sentAt,
        });
      }
      if (status === 4 && paidAt) {
        activityRows.push({
          orgId,
          entityType: "invoice",
          entityId: inv.id,
          userId: seedUserId,
          type: ACTIVITY.PAID,
          payload: { from: 2, to: 4, amount: total, currency: "EUR" },
          isSystem: seedUserId === null,
          createdAt: paidAt,
        });
      }
      if (status === 5) {
        // Cancelled invoices flip from whatever they were before; the
        // demo doesn't track that intermediate state, so anchor the
        // cancel slightly after issueDate.
        activityRows.push({
          orgId,
          entityType: "invoice",
          entityId: inv.id,
          userId: seedUserId,
          type: ACTIVITY.CANCELLED,
          payload: { from: sentAt ? 2 : 1, to: 5 },
          isSystem: seedUserId === null,
          createdAt: new Date(issueDate.getTime() + 24 * 60 * 60 * 1000),
        });
      }
      await db.insert(activities).values(activityRows);

      // #132: only non-DRAFT seeded invoices consume a sequence
      // number — drafts hold the row but no number, matching the
      // real run-time behaviour after this issue.
      if (status !== 1) number++;
    }
  }

  // Seed a next-number row for invoices so post-clear creation resumes
  // cleanly (a real app would also seed for quotes/expenses; scoped to
  // what the demo exercises).
  await db
    .insert(invoiceSequences)
    .values({ orgId, type: "invoice", nextNumber: number, prefix: "INV-" })
    .onConflictDoNothing();
}

async function seedExpenses(
  db: Db,
  orgId: string,
  suppliers: InsertedContact[],
  categories: { id: string; code: string; groupCode: string }[],
  rng: Rng,
  today: Date,
): Promise<void> {
  if (categories.length === 0) return;
  const firstMonth = new Date(today.getFullYear(), today.getMonth() - 7, 1);
  let number = 1;

  for (let i = 0; i < EXPENSE_COUNT; i++) {
    const monthOffset = rng.int(0, 7);
    const base = new Date(
      firstMonth.getFullYear(),
      firstMonth.getMonth() + monthOffset,
      1,
    );
    const day = rng.int(1, 28);
    const expenseDate = new Date(base.getFullYear(), base.getMonth(), day);
    const supplier =
      suppliers.length > 0 && rng.chance(0.7) ? rng.pick(suppliers) : null;
    const category = rng.pick(categories);
    const qty = "1";
    const unitPrice = pickExpenseUnitPrice(category.groupCode, rng);
    // GR-domestic supplier → 24%. Everything else (EU cross-border AWS/Hetzner,
    // non-EU US) → 0%. Suppliers that are null (e.g. payroll rows seeded
    // without a counterpart) → 0% — payroll is out-of-scope for VAT.
    const taxRate = supplier?.countryCode === "GR" ? "24" : "0";
    const calc = calculateLineTotal({
      quantity: qty,
      unitPrice,
      taxRate,
      usesInclusiveTax: false,
    });

    const [exp] = await db
      .insert(expenses)
      .values({
        orgId,
        contactId: supplier?.id ?? null,
        categoryId: category.id,
        expenseNumber: `EXP-${String(number).padStart(4, "0")}`,
        expenseDate: toDateStr(expenseDate),
        paymentDate: rng.chance(0.7) ? toDateStr(expenseDate) : null,
        currencyCode: "EUR",
        subtotal: calc.netAmount,
        taxAmount: calc.taxAmount,
        total: calc.lineTotal,
        contactName: supplier?.displayName ?? null,
        contactVatNumber: supplier?.vat ?? null,
        description: rng.pick(EXPENSE_MEMOS),
        source: "manual",
      })
      .returning();

    await db.insert(expenseItems).values({
      expenseId: exp.id,
      sortOrder: 0,
      name: rng.pick(EXPENSE_MEMOS),
      quantity: qty,
      unitPrice,
      taxRate,
      taxAmount: calc.taxAmount,
      lineTotal: calc.lineTotal,
    });

    number++;
  }

  // Seed the next-number row for expenses so a user creating their
  // first expense in the demo org continues from EXP-<EXPENSE_COUNT+1>
  // instead of colliding with the seeded EXP-0001. Symmetric with the
  // invoice-sequence seed inside seedInvoices.
  await db
    .insert(invoiceSequences)
    .values({ orgId, type: "expense", nextNumber: number, prefix: "EXP-" })
    .onConflictDoNothing();
}

function sumStr(values: string[]): string {
  const sum = values.reduce((a, b) => a + parseFloat(b), 0);
  return sum.toFixed(2);
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Postcondition guardrail — after every seed* completes, re-query each
// entity count filtered by orgId and compare to what populateOrgDemo
// claims in its return value. Catches future silent-skip regressions
// (the class of bug that let seedExpenses ship producing 0 rows).
async function assertPopulateResult(
  db: Db,
  orgId: string,
  expected: PopulateResult,
): Promise<void> {
  const [contactRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(contacts)
    .where(eq(contacts.orgId, orgId));
  const [productRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.orgId, orgId));
  const [invoiceRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(invoices)
    .where(eq(invoices.orgId, orgId));
  const [expenseRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(expenses)
    .where(eq(expenses.orgId, orgId));

  const diffs: string[] = [];
  if (contactRow.n !== expected.contactCount)
    diffs.push(
      `contacts: expected=${expected.contactCount} actual=${contactRow.n}`,
    );
  if (productRow.n !== expected.productCount)
    diffs.push(
      `products: expected=${expected.productCount} actual=${productRow.n}`,
    );
  if (invoiceRow.n !== expected.invoiceCount)
    diffs.push(
      `invoices: expected=${expected.invoiceCount} actual=${invoiceRow.n}`,
    );
  if (expenseRow.n !== expected.expenseCount)
    diffs.push(
      `expenses: expected=${expected.expenseCount} actual=${expenseRow.n}`,
    );

  if (diffs.length > 0) {
    throw new Error(
      `populateOrgDemo postcondition failed for org ${orgId}: ${diffs.join("; ")}`,
    );
  }
}

export async function clearOrgData(
  db: Db,
  orgId: string,
): Promise<{ deleted: Record<string, number> }> {
  // Delete in reverse FK order. Preserve organisation, memberships,
  // user preferences, and AI settings — the demo-org stays alive, just
  // empty of business records.
  const counts: Record<string, number> = {};

  // expenses + line items + attachments
  await db.execute(sql`
    DELETE FROM ${schema.expenseItems}
    WHERE expense_id IN (SELECT id FROM ${schema.expenses} WHERE org_id = ${orgId})
  `);
  await db.execute(sql`
    DELETE FROM ${schema.expenseAttachments}
    WHERE expense_id IN (SELECT id FROM ${schema.expenses} WHERE org_id = ${orgId})
  `);
  const deletedExp = await db
    .delete(schema.expenses)
    .where(eq(schema.expenses.orgId, orgId));
  counts.expenses = (deletedExp as { rowCount?: number }).rowCount ?? 0;

  // invoices + line items
  await db.execute(sql`
    DELETE FROM ${schema.invoiceItems}
    WHERE invoice_id IN (SELECT id FROM ${schema.invoices} WHERE org_id = ${orgId})
  `);
  const deletedInv = await db
    .delete(schema.invoices)
    .where(eq(schema.invoices.orgId, orgId));
  counts.invoices = (deletedInv as { rowCount?: number }).rowCount ?? 0;

  // Products and contacts (leaf rows now that invoices/expenses are gone).
  const deletedProducts = await db
    .delete(schema.products)
    .where(eq(schema.products.orgId, orgId));
  counts.products = (deletedProducts as { rowCount?: number }).rowCount ?? 0;
  const deletedContacts = await db
    .delete(schema.contacts)
    .where(eq(schema.contacts.orgId, orgId));
  counts.contacts = (deletedContacts as { rowCount?: number }).rowCount ?? 0;

  // Reset invoice numbering so the next invoice starts at 1.
  await db
    .delete(schema.invoiceSequences)
    .where(eq(schema.invoiceSequences.orgId, orgId));

  return { deleted: counts };
}
