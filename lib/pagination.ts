// Cursor-less offset/limit pagination helper. Most master-data lists are
// small enough that page-based pagination is more familiar; we can switch to
// keyset pagination later if any list grows past ~100k rows.

export interface PaginationInput {
  page?: number | string | null;
  pageSize?: number | string | null;
  defaultPageSize?: number;
  maxPageSize?: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function parsePagination({
  page,
  pageSize,
  defaultPageSize = 20,
  maxPageSize = 100,
}: PaginationInput): Pagination {
  const rawPage = typeof page === "string" ? parseInt(page, 10) : (page ?? 1);
  const rawSize = typeof pageSize === "string" ? parseInt(pageSize, 10) : (pageSize ?? defaultPageSize);

  const safePage = Number.isFinite(rawPage) && rawPage && rawPage > 0 ? Math.floor(rawPage) : 1;
  const safeSize = Number.isFinite(rawSize) && rawSize && rawSize > 0
    ? Math.min(Math.floor(rawSize), maxPageSize)
    : defaultPageSize;

  return {
    page: safePage,
    pageSize: safeSize,
    skip: (safePage - 1) * safeSize,
    take: safeSize,
  };
}

export interface PageResult<T> {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function buildPageResult<T>(
  rows: T[],
  total: number,
  pagination: Pagination,
): PageResult<T> {
  return {
    rows,
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
  };
}
