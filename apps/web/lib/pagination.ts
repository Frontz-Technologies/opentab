export const DEFAULT_PAGE_SIZE = 25;

export function parsePage(
  searchParams: Record<string, string | string[] | undefined>,
): number {
  const raw = searchParams?.page;
  const page = typeof raw === "string" ? parseInt(raw, 10) : 1;
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function paginationOffset(
  page: number,
  pageSize = DEFAULT_PAGE_SIZE,
): number {
  return (page - 1) * pageSize;
}
