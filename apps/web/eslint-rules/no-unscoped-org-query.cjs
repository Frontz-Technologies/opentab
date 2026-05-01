"use strict";

/**
 * Org-owned tables — every entry below has an `orgId` column in
 * `packages/db/src/schema`. Items / line tables (e.g. `invoiceItems`,
 * `expenseItems`) inherit scope through their parent FK and are NOT in
 * this list — they have no `orgId` of their own.
 */
const ORG_OWNED_TABLES = new Set([
  "activities",
  "aiSettings",
  "contacts",
  "countryIntegrationCredentials",
  "countryIntegrationSubmissions",
  "creditNotes",
  "expenseCategories",
  "expenses",
  "inboundDocuments",
  "invoiceSequences",
  "invoices",
  "products",
  "quotes",
  "recurringExpenses",
  "recurringInvoices",
]);

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Detect `db.select/insert/update/delete(<orgEntity>).where(...)` chains that don't filter by `<orgEntity>.orgId`. See docs/CONVENTIONS.md → Cross-org safety.",
    },
    schema: [],
    messages: {
      missingOrgScope:
        "Drizzle query against org-owned table `{{table}}` does not filter by `{{table}}.orgId`. Add `eq({{table}}.orgId, session.org.id)` (or a verified `orgId` parameter) to the WHERE / SET clause. See docs/CONVENTIONS.md → Cross-org safety.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        // Match the pattern: <something>.<verb>(<tableIdent>) where verb is from/update/delete.
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;
        const verb = callee.property && callee.property.name;
        if (verb !== "from" && verb !== "update" && verb !== "delete") return;

        const arg = node.arguments[0];
        if (!arg || arg.type !== "Identifier") return;
        const tableName = arg.name;
        if (!ORG_OWNED_TABLES.has(tableName)) return;

        // Walk up the chain looking for a `.where(...)` call. If there's
        // no `.where`, the query may legitimately fetch all rows (e.g.,
        // a count for the org via inner-join of session) — skip rather
        // than false-positive.
        let current = node;
        let whereArg = null;
        while (current && current.parent) {
          const parent = current.parent;
          if (
            parent.type === "MemberExpression" &&
            parent.object === current &&
            parent.parent &&
            parent.parent.type === "CallExpression" &&
            parent.parent.callee === parent
          ) {
            if (parent.property && parent.property.name === "where") {
              whereArg = parent.parent.arguments[0];
              break;
            }
            // Continue walking up the chained call.
            current = parent.parent;
            continue;
          }
          break;
        }

        // No .where() in the chain → likely a list/scan that's already
        // scoped via the calling-site's session check. Skip to avoid
        // noisy false positives.
        if (!whereArg) return;

        // Tighten heuristic: only fire when the WHERE clause looks like
        // a row-lookup (contains `eq(<table>.id, ...)`) — that's the
        // exact bug pattern the audit closed. Broad scans without an
        // id-equality are typically legitimate org-scoped lists.
        let hasIdEquality = false;
        let hasOrgIdRef = false;

        const seen = new WeakSet();
        const visit = (n) => {
          if (!n || typeof n !== "object" || seen.has(n)) return;
          seen.add(n);
          if (n.type === "MemberExpression" && n.object && n.object.type === "Identifier" && n.object.name === tableName && n.property) {
            if (n.property.name === "orgId") {
              hasOrgIdRef = true;
            }
            if (n.property.name === "id") {
              // Look for `eq(<table>.id, …)` — i.e., this MemberExpression
              // is the first argument of an `eq(...)` call.
              const parent = n.parent;
              if (
                parent &&
                parent.type === "CallExpression" &&
                parent.callee &&
                parent.callee.type === "Identifier" &&
                parent.callee.name === "eq" &&
                parent.arguments[0] === n
              ) {
                hasIdEquality = true;
              }
            }
          }
          for (const key of Object.keys(n)) {
            if (key === "parent") continue;
            const v = n[key];
            if (Array.isArray(v)) v.forEach(visit);
            else if (v && typeof v === "object" && v.type) visit(v);
          }
        };
        visit(whereArg);

        if (hasIdEquality && !hasOrgIdRef) {
          context.report({
            node,
            messageId: "missingOrgScope",
            data: { table: tableName },
          });
        }
      },
    };
  },
};
