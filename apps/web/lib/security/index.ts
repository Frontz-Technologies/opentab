/**
 * Cross-org safety helpers. Every Drizzle query against an org-owned table
 * must scope by `orgId`; these helpers verify the caller is operating on
 * the session's org. See `docs/CONVENTIONS.md` "Cross-org safety".
 */
export {
  assertContactInOrg,
  assertExpenseCategoryInOrg,
  assertInvoiceInOrg,
  assertProductsInOrg,
  CROSS_ORG_ACCESS_ERROR,
} from "./assert-same-org";
